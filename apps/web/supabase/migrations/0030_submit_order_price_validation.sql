-- ============================================================================
-- MenuLink · 0030_submit_order_price_validation
--
-- Server-side price validation for modifier-adjusted order items.
-- The client now sends item_id + variant_key alongside unit_price.
-- The RPC looks up the real variant price and validates:
--   1. unit_price >= base variant price (modifiers can only add cost)
--   2. modifier delta capped at 30 SAR per item (reasonable ceiling)
--   3. line_total recomputed server-side from validated unit_price * qty
--
-- Backwards compatible: item_id/variant_key are optional. Orders without
-- them (e.g., from older PWA bundles) skip validation and behave as before.
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
    coalesce((i ->> 'unit_price')::numeric, 0) * coalesce((i ->> 'qty')::int, 1)
  from jsonb_array_elements(v_items) as i;

  return jsonb_build_object(
    'customer_id', v_customer_id,
    'order_id',    v_order_id
  );
end;
$$;
