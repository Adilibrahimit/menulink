-- ============================================================================
-- MenuLink · 0045_fix_submit_order_session_id
--
-- Fix regression: Phase 4 (0038) rewrote submit_order but dropped
-- session_id from the INSERT, breaking dine-in table sessions.
-- This restores session_id in the orders INSERT.
-- ============================================================================

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
  v_nums          jsonb;
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

  v_branch_id := coalesce(
    (p_order ->> 'branch_id')::uuid,
    public.get_default_branch_id(v_restaurant_id)
  );

  v_nums := public.next_order_number(v_branch_id);

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
    table_label, session_id,
    business_date, invoice_sequence, daily_order_number, order_number_cycle
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
    nullif(p_order ->> 'table_label', ''),
    nullif(p_order ->> 'session_id', '')::uuid,
    (v_nums ->> 'business_date')::date,
    (v_nums ->> 'invoice_sequence')::bigint,
    (v_nums ->> 'daily_order_number')::int,
    (v_nums ->> 'order_number_cycle')::int
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
    'customer_id',        v_customer_id,
    'order_id',           v_order_id,
    'branch_id',          v_branch_id,
    'business_date',      v_nums ->> 'business_date',
    'daily_order_number', v_nums ->> 'daily_order_number',
    'invoice_sequence',   v_nums ->> 'invoice_sequence'
  );
end;
$$;
