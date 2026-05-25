-- ============================================================================
-- MenuLink · 0037_branch_foundation
--
-- Phase 3 of Global Operations Core:
--   1. restaurant_branches — one row per physical location
--   2. Auto-seed one "main" branch per existing restaurant
--   3. orders.branch_id — nullable FK, auto-filled by trigger for new orders
--   4. restaurant_tables.branch_id — nullable FK, backfilled to main branch
--   5. order_reasons.branch_id — nullable FK for future branch-scoped reasons
--   6. Update submit_order RPC to resolve + store branch_id
--   7. RLS policies for restaurant_branches
--
-- Backwards compatible: single-branch tenants continue working unchanged.
-- Multi-branch UI gated by the multi_branch addon.
-- ============================================================================

-- --- 1. restaurant_branches -------------------------------------------------

create table if not exists public.restaurant_branches (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants(id) on delete cascade,
  name_ar           text not null,
  name_en           text,
  slug              text not null,
  whatsapp          text,
  phone             text,
  address_ar        text,
  address_en        text,
  lat               numeric(9,6),
  lng               numeric(9,6),
  timezone          text not null default 'Asia/Riyadh',
  business_day_start time default '06:00',
  business_day_end   time default '04:00',
  supports_delivery  boolean not null default false,
  supports_pickup    boolean not null default true,
  supports_dine_in   boolean not null default false,
  supports_car       boolean not null default false,
  is_default         boolean not null default false,
  is_active          boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists idx_branches_restaurant
  on public.restaurant_branches(restaurant_id, sort_order);

create unique index if not exists idx_branches_restaurant_slug
  on public.restaurant_branches(restaurant_id, slug);

-- Only one default branch per restaurant
create unique index if not exists idx_branches_default
  on public.restaurant_branches(restaurant_id)
  where is_default = true;

-- --- 2. Auto-seed one "main" branch per existing restaurant -----------------

insert into public.restaurant_branches (
  restaurant_id, name_ar, name_en, slug, whatsapp, address_ar,
  lat, lng, timezone,
  supports_delivery, supports_pickup, supports_dine_in, supports_car,
  is_default
)
select
  r.id,
  'الفرع الرئيسي',
  'Main Branch',
  'main',
  r.whatsapp_phone,
  r.address_ar,
  r.lat,
  r.lng,
  coalesce(r.timezone, 'Asia/Riyadh'),
  true,   -- supports_delivery
  true,   -- supports_pickup
  true,   -- supports_dine_in (conservative: enable all)
  true,   -- supports_car
  true    -- is_default
from public.restaurants r
on conflict do nothing;

-- --- 3. orders.branch_id ----------------------------------------------------

alter table public.orders
  add column if not exists branch_id uuid references public.restaurant_branches(id);

create index if not exists idx_orders_branch
  on public.orders(branch_id, created_at desc)
  where branch_id is not null;

-- Backfill existing orders with the restaurant's default branch
update public.orders o
set branch_id = b.id
from public.restaurant_branches b
where b.restaurant_id = o.restaurant_id
  and b.is_default = true
  and o.branch_id is null;

-- --- 4. restaurant_tables.branch_id -----------------------------------------

alter table public.restaurant_tables
  add column if not exists branch_id uuid references public.restaurant_branches(id);

-- Backfill existing tables with the restaurant's default branch
update public.restaurant_tables t
set branch_id = b.id
from public.restaurant_branches b
where b.restaurant_id = t.restaurant_id
  and b.is_default = true
  and t.branch_id is null;

-- --- 5. Helper: get default branch for a restaurant -------------------------

create or replace function public.get_default_branch_id(p_restaurant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.restaurant_branches
  where restaurant_id = p_restaurant_id and is_default = true
  limit 1;
$$;

-- --- 6. Update submit_order to resolve branch_id ----------------------------

create or replace function public.submit_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid := (p_order ->> 'restaurant_id')::uuid;
  v_phone         text := p_order ->> 'phone';
  v_customer_id   uuid;
  v_order_id      uuid;
  v_branch_id     uuid;
  v_items         jsonb := coalesce(p_order -> 'items', '[]'::jsonb);
  v_item          jsonb;
  v_real_price    numeric;
  v_claimed_price numeric;
  v_max_delta     numeric := 30;
begin
  if v_restaurant_id is null then raise exception 'restaurant_id is required'; end if;
  if v_phone is null or length(trim(v_phone)) = 0 then raise exception 'phone is required'; end if;
  if jsonb_array_length(v_items) = 0 then raise exception 'items must be a non-empty array'; end if;

  if not exists (select 1 from public.restaurants r where r.id = v_restaurant_id and r.is_active) then
    raise exception 'restaurant % is not active', v_restaurant_id;
  end if;

  -- Resolve branch: explicit branch_id from client, or default branch
  v_branch_id := coalesce(
    (p_order ->> 'branch_id')::uuid,
    public.get_default_branch_id(v_restaurant_id)
  );

  -- Validate item prices when item_id + variant_key are provided
  for v_item in select * from jsonb_array_elements(v_items) loop
    if v_item ->> 'item_id' is not null and v_item ->> 'variant_key' is not null then
      select miv.price into v_real_price
        from public.menu_item_variants miv
        join public.menu_items mi on mi.id = miv.menu_item_id
       where mi.id = (v_item ->> 'item_id')::uuid
         and mi.restaurant_id = v_restaurant_id
         and miv.variant_key = v_item ->> 'variant_key'
         and miv.is_active;

      if v_real_price is null then
        raise exception 'invalid item/variant: % / %', v_item ->> 'item_id', v_item ->> 'variant_key';
      end if;

      v_claimed_price := coalesce((v_item ->> 'unit_price')::numeric, 0);

      if v_claimed_price < v_real_price then
        raise exception 'unit_price % below menu price % for item %',
          v_claimed_price, v_real_price, v_item ->> 'item_name';
      end if;

      if (v_claimed_price - v_real_price) > v_max_delta then
        raise exception 'modifier delta % exceeds maximum % for item %',
          v_claimed_price - v_real_price, v_max_delta, v_item ->> 'item_name';
      end if;
    end if;
  end loop;

  insert into public.customers (
    restaurant_id, phone, name, default_address, default_lat, default_lng
  ) values (
    v_restaurant_id,
    v_phone,
    nullif(p_order ->> 'name', ''),
    nullif(p_order ->> 'address', ''),
    nullif(p_order ->> 'lat', '')::numeric,
    nullif(p_order ->> 'lng', '')::numeric
  )
  on conflict (restaurant_id, phone) do update set
    name            = coalesce(excluded.name, public.customers.name),
    default_address = coalesce(excluded.default_address, public.customers.default_address),
    default_lat     = coalesce(excluded.default_lat, public.customers.default_lat),
    default_lng     = coalesce(excluded.default_lng, public.customers.default_lng),
    last_seen_at    = now(),
    updated_at      = now()
  returning id into v_customer_id;

  insert into public.orders (
    restaurant_id, customer_id, branch_id, order_type, channel,
    subtotal, delivery_fee, total,
    address, lat, lng, notes,
    car_plate, car_color,
    table_label
  ) values (
    v_restaurant_id,
    v_customer_id,
    v_branch_id,
    p_order ->> 'order_type',
    coalesce(nullif(p_order ->> 'channel', ''), 'whatsapp'),
    coalesce((p_order ->> 'subtotal')::numeric, 0),
    coalesce((p_order ->> 'delivery_fee')::numeric, 0),
    coalesce((p_order ->> 'total')::numeric, 0),
    nullif(p_order ->> 'address', ''),
    nullif(p_order ->> 'lat', '')::numeric,
    nullif(p_order ->> 'lng', '')::numeric,
    nullif(p_order ->> 'notes', ''),
    nullif(p_order ->> 'car_plate', ''),
    nullif(p_order ->> 'car_color', ''),
    nullif(p_order ->> 'table_label', '')
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, item_name, variant, qty, unit_price, line_total)
  select
    v_order_id,
    i ->> 'item_name',
    nullif(i ->> 'variant', ''),
    coalesce((i ->> 'qty')::int, 1),
    coalesce((i ->> 'unit_price')::numeric, 0),
    coalesce((i ->> 'unit_price')::numeric, 0) * coalesce((i ->> 'qty')::int, 1)
  from jsonb_array_elements(v_items) as i;

  return jsonb_build_object(
    'customer_id', v_customer_id,
    'order_id',    v_order_id,
    'branch_id',   v_branch_id
  );
end;
$$;

-- --- 7. RLS on restaurant_branches ------------------------------------------

alter table public.restaurant_branches enable row level security;

drop policy if exists "owner_manage_branches" on public.restaurant_branches;
create policy "owner_manage_branches" on public.restaurant_branches
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists "ops_manage_branches" on public.restaurant_branches;
create policy "ops_manage_branches" on public.restaurant_branches
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Public read for customer PWA (branch list on menu page)
drop policy if exists "anon_read_branches" on public.restaurant_branches;
create policy "anon_read_branches" on public.restaurant_branches
  for select to anon
  using (is_active = true);
