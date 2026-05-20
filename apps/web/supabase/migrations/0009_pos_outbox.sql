-- ============================================================================
-- MenuLink · 0009_pos_outbox
--
-- POS integration plumbing — the queue + item mapping tables that the
-- Bridge App reads to sync MenuLink orders into restaurants' POS systems.
--
-- Design (per .claude/skills/menulink-integration/customers/rzrz-restaurant.md):
--   pos_outbox       — per-restaurant queue of orders awaiting POS sync
--   pos_item_map     — per-restaurant MenuLink-item-id ↔ POS-item-id mapping
--   pos_settings     — per-restaurant POS connection metadata (kind, branch,
--                      online_customer_id, counter_id, invoice_type, etc.)
--
-- The Bridge App subscribes to pos_outbox via Supabase Realtime (with
-- polling fallback). On each new row it builds the POS-specific call
-- (e.g., InsertInvoice XML for RzRz) using pos_item_map to translate IDs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. pos_settings — per-restaurant POS config
-- ---------------------------------------------------------------------------

create table public.pos_settings (
  restaurant_id        uuid primary key references public.restaurants(id) on delete cascade,
  pos_kind             text not null check (pos_kind in ('rzrz','foodics','other','none')) default 'none',
  pos_branch_id        int,                  -- e.g., 2 for Almalaz in RzRz
  online_customer_id   bigint,               -- 999 for MenuLink slot in RzRz OnlineCustomer
  counter_id           bigint,               -- which CounterDetails row to use
  invoice_type         int,                  -- 11 for RzRz Online section
  default_user_id      bigint default 1,     -- CreatedBy / ModifiedBy
  tax_percent          numeric(5,2) default 15.00,
  is_tax_inclusive     boolean default true,
  enabled              boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger pos_settings_set_updated_at
  before update on public.pos_settings
  for each row execute function public.set_updated_at();

alter table public.pos_settings enable row level security;

create policy "rls_pos_settings_owner_select" on public.pos_settings
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy "rls_pos_settings_ops_all" on public.pos_settings
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 2. pos_item_map — per-restaurant MenuLink-item-id ↔ POS-item-id
-- ---------------------------------------------------------------------------

create table public.pos_item_map (
  restaurant_id    uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id     uuid not null references public.menu_items(id) on delete cascade,
  pos_item_id      bigint not null,
  pos_variant_key  text,                     -- maps to RzRz variant if needed
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (restaurant_id, menu_item_id, pos_variant_key)
);

create index pos_item_map_restaurant_idx on public.pos_item_map(restaurant_id);

create trigger pos_item_map_set_updated_at
  before update on public.pos_item_map
  for each row execute function public.set_updated_at();

alter table public.pos_item_map enable row level security;

create policy "rls_pos_item_map_owner_all" on public.pos_item_map
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "rls_pos_item_map_ops_all" on public.pos_item_map
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 3. pos_outbox — the queue
-- ---------------------------------------------------------------------------

create table public.pos_outbox (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  order_id        uuid not null references public.orders(id) on delete cascade,
  payload         jsonb not null,             -- snapshot of the order at enqueue time
  status          text not null default 'pending'
                  check (status in ('pending','claimed','synced','failed','skipped')),
  claimed_by      text,                       -- bridge app instance id that picked it up
  claimed_at      timestamptz,
  pos_invoice_id  text,                       -- the POS-side ID after success (uniqueidentifier for RzRz)
  pos_invoice_no  bigint,                     -- the POS-side invoice number (human-readable)
  pos_bill_no     bigint,                     -- the POS-side bill number (counter)
  attempts        int not null default 0,
  last_error      text,
  last_attempted_at timestamptz,
  synced_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (restaurant_id, order_id)            -- idempotency: one outbox row per order
);

create index pos_outbox_pending_idx
  on public.pos_outbox(restaurant_id, status, created_at)
  where status in ('pending','claimed','failed');

create index pos_outbox_order_idx on public.pos_outbox(order_id);

create trigger pos_outbox_set_updated_at
  before update on public.pos_outbox
  for each row execute function public.set_updated_at();

alter table public.pos_outbox enable row level security;

create policy "rls_pos_outbox_owner_select" on public.pos_outbox
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy "rls_pos_outbox_ops_all" on public.pos_outbox
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 4. Trigger: enqueue an outbox row on each new order
-- ---------------------------------------------------------------------------
-- The Bridge App reads `payload` to build its POS-specific call. We snapshot
-- the order + customer + items at enqueue time so even if the order changes
-- later, the Bridge App sees the order-at-creation-time state.

create or replace function public.enqueue_pos_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pos_enabled boolean;
  v_payload jsonb;
begin
  -- Only enqueue if the restaurant has POS integration enabled
  select coalesce(enabled, false) into v_pos_enabled
  from public.pos_settings
  where restaurant_id = new.restaurant_id;

  if not coalesce(v_pos_enabled, false) then
    return new;
  end if;

  -- Build the payload: order + customer + items (with pos_item_id mapping
  -- included so the Bridge App has everything in one read)
  v_payload := jsonb_build_object(
    'order', jsonb_build_object(
      'id',            new.id,
      'restaurant_id', new.restaurant_id,
      'order_type',    new.order_type,
      'channel',       new.channel,
      'status',        new.status,
      'subtotal',      new.subtotal,
      'delivery_fee',  new.delivery_fee,
      'total',         new.total,
      'address',       new.address,
      'lat',           new.lat,
      'lng',           new.lng,
      'notes',         new.notes,
      'created_at',    new.created_at
    ),
    'customer', (
      select jsonb_build_object(
        'id',    c.id,
        'name',  c.name,
        'phone', c.phone
      ) from public.customers c where c.id = new.customer_id
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'item_name',   oi.item_name,
            'variant',     oi.variant,
            'qty',         oi.qty,
            'unit_price',  oi.unit_price,
            'line_total',  oi.line_total,
            'pos_item_id', (
              select pim.pos_item_id
              from public.pos_item_map pim
              join public.menu_items mi on mi.id = pim.menu_item_id
              where pim.restaurant_id = new.restaurant_id
                and mi.name_ar = oi.item_name
                and (oi.variant is null or pim.pos_variant_key = oi.variant)
              limit 1
            )
          )
          order by oi.id
        )
        from public.order_items oi
        where oi.order_id = new.id
      ),
      '[]'::jsonb
    )
  );

  insert into public.pos_outbox (restaurant_id, order_id, payload)
  values (new.restaurant_id, new.id, v_payload)
  on conflict (restaurant_id, order_id) do nothing;

  return new;
end;
$$;

drop trigger if exists orders_enqueue_pos_outbox on public.orders;
create trigger orders_enqueue_pos_outbox
  after insert on public.orders
  for each row execute function public.enqueue_pos_outbox();

-- ---------------------------------------------------------------------------
-- 5. RPCs for the Bridge App
-- ---------------------------------------------------------------------------

-- pos_outbox_claim — atomic claim of pending rows for a Bridge App instance.
-- Used by the Bridge App on startup + polling fallback.
create or replace function public.pos_outbox_claim(
  p_restaurant_id uuid,
  p_instance_id   text,
  p_batch_size    int default 10
)
returns setof public.pos_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.pos_outbox o
     set status = 'claimed',
         claimed_by = p_instance_id,
         claimed_at = now(),
         updated_at = now()
   where o.id in (
     select id from public.pos_outbox
      where restaurant_id = p_restaurant_id
        and status = 'pending'
      order by created_at
      limit p_batch_size
      for update skip locked
   )
  returning *;
end;
$$;

revoke all on function public.pos_outbox_claim(uuid, text, int) from public;
grant execute on function public.pos_outbox_claim(uuid, text, int) to authenticated;

-- pos_outbox_mark_synced — record success
create or replace function public.pos_outbox_mark_synced(
  p_outbox_id      uuid,
  p_pos_invoice_id text,
  p_pos_invoice_no bigint,
  p_pos_bill_no    bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pos_outbox
     set status         = 'synced',
         pos_invoice_id = p_pos_invoice_id,
         pos_invoice_no = p_pos_invoice_no,
         pos_bill_no    = p_pos_bill_no,
         synced_at      = now(),
         last_attempted_at = now(),
         attempts       = attempts + 1
   where id = p_outbox_id;
end;
$$;

grant execute on function public.pos_outbox_mark_synced(uuid, text, bigint, bigint) to authenticated;

-- pos_outbox_mark_failed — record failure (Bridge App will retry up to a cap)
create or replace function public.pos_outbox_mark_failed(
  p_outbox_id  uuid,
  p_error      text,
  p_will_retry boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pos_outbox
     set status         = case when p_will_retry then 'pending' else 'failed' end,
         claimed_by     = null,
         claimed_at     = null,
         last_error     = p_error,
         last_attempted_at = now(),
         attempts       = attempts + 1
   where id = p_outbox_id;
end;
$$;

grant execute on function public.pos_outbox_mark_failed(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Add pos_outbox to the realtime publication so the Bridge App can
--    subscribe via Supabase Realtime.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pos_outbox'
  ) then
    alter publication supabase_realtime add table public.pos_outbox;
  end if;
end$$;
