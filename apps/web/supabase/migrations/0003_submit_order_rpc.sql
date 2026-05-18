-- ============================================================================
-- MenuLink · 0003_submit_order_rpc
--
-- Fix two compounding bugs in 0001:
--   1. owner_write_* policies with cmd=ALL scoped to `public` (all roles)
--      fire for anon inserts and reject them when the JWT has no
--      restaurant_id claim. (PostgREST returns 401 + "new row violates RLS".)
--   2. The .upsert(...).select('id').single() pattern from the PWA needs
--      SELECT permission on the table, which we deliberately don't grant
--      to anon for privacy reasons.
--
-- Fix: replace direct-table writes from anon with ONE SECURITY DEFINER RPC.
-- Anon only needs EXECUTE on the function — never any direct table access.
-- Atomic, one round-trip, defence-in-depth.
-- ============================================================================

-- --- 1. Tighten owner policies to authenticated only -----------------------
-- The original owner_* policies were scoped to `public`. That caused them to
-- fire for anon inserts and (because anon has no JWT.restaurant_id claim)
-- reject otherwise-valid anon inserts. Scope them strictly to authenticated.

drop policy if exists owner_read_restaurant     on public.restaurants;
drop policy if exists owner_update_restaurant   on public.restaurants;
drop policy if exists owner_read_customers      on public.customers;
drop policy if exists owner_write_customers     on public.customers;
drop policy if exists owner_read_orders         on public.orders;
drop policy if exists owner_write_orders        on public.orders;
drop policy if exists owner_read_order_items    on public.order_items;
drop policy if exists owner_write_order_items   on public.order_items;
drop policy if exists owner_read_tags           on public.customer_tags;
drop policy if exists owner_write_tags          on public.customer_tags;
drop policy if exists owner_read_push           on public.push_subscriptions;

drop policy if exists anon_insert_customers     on public.customers;
drop policy if exists anon_insert_orders        on public.orders;
drop policy if exists anon_insert_order_items   on public.order_items;

-- Restaurants
create policy "owner_read_restaurant"
  on public.restaurants for select to authenticated
  using (id::text = (auth.jwt() ->> 'restaurant_id'));
create policy "owner_update_restaurant"
  on public.restaurants for update to authenticated
  using (id::text = (auth.jwt() ->> 'restaurant_id'))
  with check (id::text = (auth.jwt() ->> 'restaurant_id'));

-- Customers
create policy "owner_select_customers"
  on public.customers for select to authenticated
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));
create policy "owner_update_customers"
  on public.customers for update to authenticated
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'))
  with check (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));
create policy "owner_delete_customers"
  on public.customers for delete to authenticated
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));

-- Orders
create policy "owner_select_orders"
  on public.orders for select to authenticated
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));
create policy "owner_update_orders"
  on public.orders for update to authenticated
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'))
  with check (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));
create policy "owner_delete_orders"
  on public.orders for delete to authenticated
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));

-- Order items
create policy "owner_select_order_items"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ));
create policy "owner_update_order_items"
  on public.order_items for update to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ))
  with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ));
create policy "owner_delete_order_items"
  on public.order_items for delete to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ));

-- Customer tags
create policy "owner_all_tags"
  on public.customer_tags for all to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = customer_tags.customer_id
      and c.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ))
  with check (exists (
    select 1 from public.customers c
    where c.id = customer_tags.customer_id
      and c.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ));

-- Push subscriptions: owner can read all for their tenant
create policy "owner_select_push"
  on public.push_subscriptions for select to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = push_subscriptions.customer_id
      and c.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ));

-- --- 2. The submit_order RPC ----------------------------------------------
-- One atomic call that upserts the customer, inserts the order, and inserts
-- the order_items. Runs SECURITY DEFINER so it bypasses RLS internally — the
-- function itself is the security boundary.
--
-- The PWA calls it with:
--   sb.rpc('submit_order', { p_order: { restaurant_id, phone, name, address,
--                                       lat, lng, order_type, channel,
--                                       subtotal, delivery_fee, total, notes,
--                                       items: [{ item_name, variant, qty,
--                                                 unit_price, line_total }] } })
-- Returns: { customer_id: uuid, order_id: uuid }

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
  -- Guard rails (defence in depth)
  if v_restaurant_id is null then raise exception 'restaurant_id is required'; end if;
  if v_phone is null or length(trim(v_phone)) = 0 then raise exception 'phone is required'; end if;
  if jsonb_array_length(v_items) = 0 then raise exception 'items must be a non-empty array'; end if;

  -- Confirm restaurant exists and is active. Prevents writes to fabricated IDs.
  if not exists (select 1 from public.restaurants r where r.id = v_restaurant_id and r.is_active) then
    raise exception 'restaurant % is not active', v_restaurant_id;
  end if;

  -- Upsert customer; on conflict keep existing id, refresh metadata.
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

  -- Insert order
  insert into public.orders (
    restaurant_id, customer_id, order_type, channel,
    subtotal, delivery_fee, total,
    address, lat, lng, notes
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
    nullif(p_order ->> 'notes', '')
  )
  returning id into v_order_id;

  -- Insert order items
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

-- Anon can EXECUTE, but has no direct table privileges.
revoke all on function public.submit_order(jsonb) from public;
grant execute on function public.submit_order(jsonb) to anon, authenticated;
