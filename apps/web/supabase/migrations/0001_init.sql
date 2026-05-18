-- ============================================================================
-- MenuLink · 0001_init
-- Core schema: restaurants, customers, orders, order_items, customer_tags,
-- push_subscriptions. Multi-tenant by restaurant_id. RLS on every table.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- restaurants  (tenant root)
-- ---------------------------------------------------------------------------

create table public.restaurants (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  whatsapp_phone  text not null,
  owner_user_id   uuid references auth.users(id) on delete set null,
  plan            text not null default 'monthly' check (plan in ('monthly','yearly','trial')),
  currency        text not null default 'SAR',
  timezone        text not null default 'Asia/Riyadh',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- customers  (per-restaurant, NOT global — a phone can exist at many restaurants)
-- ---------------------------------------------------------------------------

create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  phone               text not null,
  name                text,
  default_address     text,
  default_lat         numeric(9,6),
  default_lng         numeric(9,6),
  marketing_opt_in    boolean not null default true,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (restaurant_id, phone)
);

create index customers_restaurant_idx on public.customers(restaurant_id);
create index customers_phone_idx on public.customers(restaurant_id, phone);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  order_type      text not null check (order_type in ('delivery','pickup','dine_in')),
  channel         text not null default 'whatsapp' check (channel in ('whatsapp','app','pos')),
  status          text not null default 'submitted' check (status in ('submitted','confirmed','preparing','ready','delivered','cancelled')),
  subtotal        numeric(10,2) not null check (subtotal >= 0),
  delivery_fee    numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total           numeric(10,2) not null check (total >= 0),
  address         text,
  lat             numeric(9,6),
  lng             numeric(9,6),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index orders_restaurant_created_idx on public.orders(restaurant_id, created_at desc);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_status_idx on public.orders(restaurant_id, status) where status in ('submitted','confirmed','preparing');

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Touch customers.last_seen_at when a new order arrives
create or replace function public.touch_customer_last_seen()
returns trigger
language plpgsql
as $$
begin
  update public.customers
     set last_seen_at = greatest(last_seen_at, new.created_at)
   where id = new.customer_id;
  return new;
end;
$$;

create trigger orders_touch_customer
  after insert on public.orders
  for each row execute function public.touch_customer_last_seen();

-- ---------------------------------------------------------------------------
-- order_items  (snapshot of item state at order time)
-- ---------------------------------------------------------------------------

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  item_name     text not null,
  variant       text,
  qty           int not null check (qty > 0),
  unit_price    numeric(10,2) not null check (unit_price >= 0),
  line_total    numeric(10,2) not null check (line_total >= 0)
);

create index order_items_order_idx on public.order_items(order_id);
create index order_items_name_idx on public.order_items(item_name);

-- ---------------------------------------------------------------------------
-- customer_tags  (owner-applied labels: VIP, complainer, etc.)
-- ---------------------------------------------------------------------------

create table public.customer_tags (
  customer_id   uuid not null references public.customers(id) on delete cascade,
  tag           text not null,
  created_at    timestamptz not null default now(),
  primary key (customer_id, tag)
);

create index customer_tags_tag_idx on public.customer_tags(tag);

-- ---------------------------------------------------------------------------
-- push_subscriptions  (web push endpoints; OneSignal-compatible structure)
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  endpoint      text not null,
  keys_p256dh   text not null,
  keys_auth     text not null,
  created_at    timestamptz not null default now(),
  unique (endpoint)
);

create index push_subs_customer_idx on public.push_subscriptions(customer_id);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.restaurants        enable row level security;
alter table public.customers          enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.customer_tags      enable row level security;
alter table public.push_subscriptions enable row level security;

-- Service role bypasses RLS by default in Supabase, so seed scripts and
-- server-side Next.js routes using the service key always have full access.

-- Restaurant owner: full access to their own tenant
-- (auth.jwt() ->> 'restaurant_id') is set by the auth flow when an owner signs in.

create policy "owner_read_restaurant"
  on public.restaurants for select
  using (id::text = (auth.jwt() ->> 'restaurant_id'));

create policy "owner_update_restaurant"
  on public.restaurants for update
  using (id::text = (auth.jwt() ->> 'restaurant_id'));

create policy "owner_read_customers"
  on public.customers for select
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));

create policy "owner_write_customers"
  on public.customers for all
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'))
  with check (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));

create policy "owner_read_orders"
  on public.orders for select
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));

create policy "owner_write_orders"
  on public.orders for all
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'))
  with check (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));

create policy "owner_read_order_items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
    )
  );

create policy "owner_write_order_items"
  on public.order_items for all
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
    )
  );

create policy "owner_read_tags"
  on public.customer_tags for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_tags.customer_id
        and c.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
    )
  );

create policy "owner_write_tags"
  on public.customer_tags for all
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_tags.customer_id
        and c.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_tags.customer_id
        and c.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
    )
  );

create policy "owner_read_push"
  on public.push_subscriptions for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = push_subscriptions.customer_id
        and c.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
    )
  );

-- Customer-facing PWA writes (anon role): the PWA submits an order on behalf of
-- a phone-identified customer. We enforce restaurant scope by requiring the
-- caller to provide the restaurant_id matching the slug it loaded.
-- For simplicity in the local dev seed phase, anon role gets insert-only on
-- customers and orders. Tighten in the next migration once auth flow is final.

create policy "anon_insert_customers"
  on public.customers for insert
  to anon
  with check (true);

create policy "anon_insert_orders"
  on public.orders for insert
  to anon
  with check (true);

create policy "anon_insert_order_items"
  on public.order_items for insert
  to anon
  with check (true);
