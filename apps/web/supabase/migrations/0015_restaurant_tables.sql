-- ============================================================================
-- MenuLink · 0015_restaurant_tables
--
-- Adds physical table management for dine-in. Each restaurant maintains a
-- list of tables (free-form labels: "1", "A1", "بجانب النافذة"). Every
-- table has its own QR encoding ?table=<label>; scanning locks the customer
-- to dine-in with that table tagged on the order.
--
-- Changes:
--   1. restaurant_tables table + index + RLS (0008 pattern: owns_restaurant /
--      is_platform_admin helpers, all policies to authenticated)
--   2. orders.table_label snapshot column
--   3. submit_order RPC extended to persist table_label
--   4. build_pos_outbox_payload extended to include table_label so a future
--      Bridge App can stamp it onto the kitchen ticket without another
--      schema change
-- ============================================================================

-- --- 1. restaurant_tables -------------------------------------------------
create table if not exists public.restaurant_tables (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  label         text not null,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, label)
);

create index if not exists restaurant_tables_restaurant_idx
  on public.restaurant_tables(restaurant_id, sort_order);

alter table public.restaurant_tables enable row level security;

-- Idempotent re-runs in dev
drop policy if exists owner_select_tables       on public.restaurant_tables;
drop policy if exists owner_all_tables          on public.restaurant_tables;
drop policy if exists platform_admin_all_tables on public.restaurant_tables;

create policy "owner_select_tables"
  on public.restaurant_tables for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy "owner_all_tables"
  on public.restaurant_tables for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "platform_admin_all_tables"
  on public.restaurant_tables for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- --- 2. table_label snapshot on orders ------------------------------------
alter table public.orders
  add column if not exists table_label text;

create index if not exists orders_table_label_idx
  on public.orders(restaurant_id, table_label)
  where table_label is not null;

-- --- 3. submit_order: persist table_label ---------------------------------
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
  v_items         jsonb := coalesce(p_order -> 'items', '[]'::jsonb);
begin
  if v_restaurant_id is null then raise exception 'restaurant_id is required'; end if;
  if v_phone is null or length(trim(v_phone)) = 0 then raise exception 'phone is required'; end if;
  if jsonb_array_length(v_items) = 0 then raise exception 'items must be a non-empty array'; end if;

  if not exists (select 1 from public.restaurants r where r.id = v_restaurant_id and r.is_active) then
    raise exception 'restaurant % is not active', v_restaurant_id;
  end if;

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
    restaurant_id, customer_id, order_type, channel,
    subtotal, delivery_fee, total,
    address, lat, lng, notes,
    car_plate, car_color,
    table_label
  ) values (
    v_restaurant_id,
    v_customer_id,
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
    coalesce((i ->> 'line_total')::numeric, 0)
  from jsonb_array_elements(v_items) as i;

  return jsonb_build_object(
    'customer_id', v_customer_id,
    'order_id',    v_order_id
  );
end;
$$;

revoke all on function public.submit_order(jsonb) from public;
grant execute on function public.submit_order(jsonb) to anon, authenticated;

-- --- 4. build_pos_outbox_payload: include table_label --------------------
create or replace function public.build_pos_outbox_payload(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id',              o.id,
      'restaurant_id',   o.restaurant_id,
      'order_type',      o.order_type,
      'channel',         o.channel,
      'status',          o.status,
      'subtotal',        o.subtotal,
      'delivery_fee',    o.delivery_fee,
      'total',           o.total,
      'address',         o.address,
      'lat',             o.lat,
      'lng',             o.lng,
      'notes',           o.notes,
      'car_plate',       o.car_plate,
      'car_color',       o.car_color,
      'car_arrived_at',  o.car_arrived_at,
      'table_label',     o.table_label,
      'created_at',      o.created_at
    ),
    'customer', (
      select jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone)
      from public.customers c where c.id = o.customer_id
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
              where pim.restaurant_id = o.restaurant_id
                and mi.name_ar = oi.item_name
                and (oi.variant is null or pim.pos_variant_key = oi.variant)
              limit 1
            )
          )
          order by oi.id
        )
        from public.order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  from public.orders o
  where o.id = p_order_id;
$$;
