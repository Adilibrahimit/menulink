-- 0032: Table sessions (open tabs for dine-in)
-- Allows customers to submit multiple rounds to the same table session,
-- view a running total, and request checkout when done.

-- 1. table_sessions table
create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_label text not null,
  status text not null default 'open'
    check (status in ('open', 'checkout_requested', 'closed')),
  customer_name text,
  customer_phone text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text
);

-- 2. Link orders to sessions
alter table public.orders
  add column if not exists session_id uuid references public.table_sessions(id);

-- 3. RLS for table_sessions
alter table public.table_sessions enable row level security;

-- Anon/public can create sessions (customer at table)
create policy "anon_insert_sessions" on public.table_sessions
  for insert to public with check (true);

-- Anon/public can read a session by id (customer needs to see their tab)
create policy "anon_select_own_session" on public.table_sessions
  for select to public using (true);

-- Anon can update status to checkout_requested
create policy "anon_update_checkout" on public.table_sessions
  for update to public using (true)
  with check (status in ('open', 'checkout_requested'));

-- Owner can read + update sessions for their restaurant
create policy "owner_select_sessions" on public.table_sessions
  for select to authenticated using (public.owns_restaurant(restaurant_id));

create policy "owner_update_sessions" on public.table_sessions
  for update to authenticated using (public.owns_restaurant(restaurant_id));

-- Platform admin full access
create policy "admin_all_sessions" on public.table_sessions
  for all to authenticated using (public.is_platform_admin());

-- 4. Add to Realtime publication
alter publication supabase_realtime add table public.table_sessions;

-- 5. RPC: open or reuse an active session for a table
create or replace function public.open_table_session(
  p_restaurant_id uuid,
  p_table_label text,
  p_customer_name text default null,
  p_customer_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  -- Check for an existing open session at this table
  select id into v_session_id
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_label = p_table_label
    and status = 'open'
    and opened_at > now() - interval '8 hours'
  order by opened_at desc
  limit 1;

  if v_session_id is not null then
    -- Update name/phone if provided (customer might not have entered on first round)
    if p_customer_name is not null or p_customer_phone is not null then
      update public.table_sessions
      set customer_name = coalesce(p_customer_name, customer_name),
          customer_phone = coalesce(p_customer_phone, customer_phone)
      where id = v_session_id;
    end if;
    return v_session_id;
  end if;

  -- Create new session
  insert into public.table_sessions (restaurant_id, table_label, customer_name, customer_phone)
  values (p_restaurant_id, p_table_label, p_customer_name, p_customer_phone)
  returning id into v_session_id;

  return v_session_id;
end;
$$;

-- 6. RPC: get full session details (all orders + items)
create or replace function public.get_table_session(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_orders jsonb;
begin
  select to_jsonb(s) into v_session
  from (
    select id, restaurant_id, table_label, status,
           customer_name, customer_phone, opened_at, closed_at
    from public.table_sessions
    where id = p_session_id
  ) s;

  if v_session is null then return null; end if;

  select coalesce(jsonb_agg(o order by o ->> 'created_at'), '[]'::jsonb)
    into v_orders
  from (
    select jsonb_build_object(
      'id', ord.id,
      'status', ord.status,
      'total', ord.total,
      'notes', ord.notes,
      'created_at', ord.created_at,
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'item_name', oi.item_name,
          'variant', oi.variant,
          'qty', oi.qty,
          'unit_price', oi.unit_price,
          'line_total', oi.line_total
        )), '[]'::jsonb)
        from public.order_items oi
        where oi.order_id = ord.id
      )
    ) as o
    from public.orders ord
    where ord.session_id = p_session_id
  ) so;

  return v_session || jsonb_build_object('orders', v_orders);
end;
$$;

-- 7. RPC: request checkout
create or replace function public.request_table_checkout(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.table_sessions
  set status = 'checkout_requested'
  where id = p_session_id
    and status = 'open';
end;
$$;

-- 8. Update submit_order to accept session_id (add to the existing RPC)
-- We add session_id to the orders row if provided in the payload.
-- The existing submit_order reads p_payload->>'session_id' and writes it.
-- Rather than rewriting the entire RPC, we just ensure the column accepts it:
-- The INSERT in submit_order uses `p_payload` keys — we need to patch it.

-- 9. Patch submit_order to include session_id in the INSERT
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
    restaurant_id, customer_id, order_type, channel,
    subtotal, delivery_fee, total,
    address, lat, lng, notes,
    car_plate, car_color,
    table_label, session_id
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
    nullif(p_order ->> 'table_label', ''),
    nullif(p_order ->> 'session_id', '')::uuid
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
    'order_id',    v_order_id
  );
end;
$$;

-- Grant execute on new RPCs to anon + authenticated
grant execute on function public.open_table_session(uuid, text, text, text) to anon, authenticated;
grant execute on function public.get_table_session(uuid) to anon, authenticated;
grant execute on function public.request_table_checkout(uuid) to anon, authenticated;
