-- ============================================================================
-- MenuLink · 0014_car_order_type
--
-- Adds curbside / drive-up as a 4th order_type. Customers pick "car",
-- provide a license plate + car color, drive to the restaurant, then tap
-- "I've arrived" in the PWA — which flips orders.car_arrived_at and the
-- /admin/orders Realtime feed fires a louder bell so staff can run the
-- order out.
--
-- Changes:
--   1. Extend orders.order_type CHECK with 'car'
--   2. Add car_plate / car_color / car_arrived_at columns
--   3. Extend submit_order RPC to accept + persist car fields
--   4. Add mark_arrived(order_id, plate) RPC (anon-callable, plate pseudo-auth)
--   5. Extend build_pos_outbox_payload to snapshot car fields
-- ============================================================================

-- --- 1. CHECK constraint --------------------------------------------------
alter table public.orders drop constraint if exists orders_order_type_check;
alter table public.orders
  add constraint orders_order_type_check
  check (order_type in ('delivery','pickup','dine_in','car'));

-- --- 2. Columns ------------------------------------------------------------
alter table public.orders
  add column if not exists car_plate       text,
  add column if not exists car_color       text,
  add column if not exists car_arrived_at  timestamptz;

-- Useful when the admin page wants to highlight "waiting at the curb" orders.
create index if not exists orders_car_arrived_idx
  on public.orders(restaurant_id, car_arrived_at)
  where car_arrived_at is not null;

-- --- 3. submit_order — extract + persist car fields -----------------------
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
    car_plate, car_color
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
    nullif(p_order ->> 'car_color', '')
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

-- --- 4. mark_arrived RPC ---------------------------------------------------
-- The order_id is the unguessable token (uuid v4). The plate is a sanity
-- check so a copy-pasted link can't be marked arrived by someone who didn't
-- place the order. Anon-callable so the customer PWA can fire it directly.
-- Idempotent: calling twice returns ok=true with reason='already_arrived'.
create or replace function public.mark_arrived(p_order_id uuid, p_plate text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_type text;
  v_plate      text;
  v_arrived    timestamptz;
begin
  select order_type, car_plate, car_arrived_at
    into v_order_type, v_plate, v_arrived
    from public.orders
   where id = p_order_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_order_type <> 'car' then
    return jsonb_build_object('ok', false, 'reason', 'not_car_order');
  end if;

  if lower(trim(coalesce(v_plate, ''))) <> lower(trim(coalesce(p_plate, ''))) then
    return jsonb_build_object('ok', false, 'reason', 'plate_mismatch');
  end if;

  if v_arrived is not null then
    return jsonb_build_object('ok', true, 'reason', 'already_arrived', 'arrived_at', v_arrived);
  end if;

  update public.orders
     set car_arrived_at = now(),
         updated_at     = now()
   where id = p_order_id
  returning car_arrived_at into v_arrived;

  return jsonb_build_object('ok', true, 'reason', null, 'arrived_at', v_arrived);
end;
$$;

revoke all on function public.mark_arrived(uuid, text) from public;
grant execute on function public.mark_arrived(uuid, text) to anon, authenticated;

-- --- 5. Extend build_pos_outbox_payload -----------------------------------
-- Additive: existing Bridge App ignores unknown keys; new tenants can map
-- 'car' through pos_settings.invoice_type_map once Samer's workflow patch
-- ships.
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
