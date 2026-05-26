-- ============================================================================
-- MenuLink · 0057_instant_loyalty_redemption
--
-- Enables customers to redeem loyalty points as a discount at checkout.
-- Points-as-currency: each point worth redemption_value_sar SAR.
-- Discount applied atomically inside submit_order — no admin approval.
-- ============================================================================

-- 1. Add discount tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed int NOT NULL DEFAULT 0;

-- 2. Rewrite submit_order to accept optional redeem_points
CREATE OR REPLACE FUNCTION public.submit_order(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  v_redeem_points int := coalesce((p_order ->> 'redeem_points')::int, 0);
  v_discount      numeric := 0;
  v_subtotal      numeric;
  v_delivery_fee  numeric;
  v_total         numeric;
  v_rv_sar        numeric;
  v_balance       int;
  v_auth_customer uuid;
  v_auth_uid      uuid;
BEGIN
  IF v_restaurant_id IS NULL THEN RAISE EXCEPTION 'restaurant_id is required'; END IF;
  IF v_phone IS NULL OR length(trim(v_phone)) = 0 THEN RAISE EXCEPTION 'phone is required'; END IF;
  IF jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'items must be a non-empty array'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = v_restaurant_id AND r.is_active) THEN
    RAISE EXCEPTION 'restaurant % is not active', v_restaurant_id;
  END IF;

  v_branch_id := coalesce(
    (p_order ->> 'branch_id')::uuid,
    public.get_default_branch_id(v_restaurant_id)
  );
  v_nums := public.next_order_number(v_branch_id);

  -- Price validation (unchanged)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    IF v_item ->> 'item_id' IS NOT NULL AND v_item ->> 'variant_key' IS NOT NULL THEN
      SELECT miv.price INTO v_real_price
        FROM public.menu_item_variants miv
        JOIN public.menu_items mi ON mi.id = miv.menu_item_id
       WHERE mi.id = (v_item ->> 'item_id')::uuid
         AND mi.restaurant_id = v_restaurant_id
         AND miv.variant_key = v_item ->> 'variant_key'
         AND miv.is_active;

      IF v_real_price IS NULL THEN
        RAISE EXCEPTION 'invalid item/variant: % / %', v_item ->> 'item_id', v_item ->> 'variant_key';
      END IF;
      v_claimed_price := coalesce((v_item ->> 'unit_price')::numeric, 0);
      IF v_claimed_price < v_real_price THEN
        RAISE EXCEPTION 'unit_price % below menu price % for item %',
          v_claimed_price, v_real_price, v_item ->> 'item_name';
      END IF;
      IF (v_claimed_price - v_real_price) > v_max_delta THEN
        RAISE EXCEPTION 'modifier delta % exceeds maximum % for item %',
          v_claimed_price - v_real_price, v_max_delta, v_item ->> 'item_name';
      END IF;
    END IF;
  END LOOP;

  -- Upsert customer
  INSERT INTO public.customers (
    restaurant_id, phone, name, default_address, default_lat, default_lng
  ) VALUES (
    v_restaurant_id, v_phone,
    nullif(p_order ->> 'name', ''),
    nullif(p_order ->> 'address', ''),
    nullif(p_order ->> 'lat', '')::numeric,
    nullif(p_order ->> 'lng', '')::numeric
  )
  ON CONFLICT (restaurant_id, phone) DO UPDATE SET
    name            = coalesce(excluded.name, public.customers.name),
    default_address = coalesce(excluded.default_address, public.customers.default_address),
    default_lat     = coalesce(excluded.default_lat, public.customers.default_lat),
    default_lng     = coalesce(excluded.default_lng, public.customers.default_lng),
    last_seen_at    = now(),
    updated_at      = now()
  RETURNING id INTO v_customer_id;

  -- Compute base totals
  v_subtotal     := coalesce((p_order ->> 'subtotal')::numeric, 0);
  v_delivery_fee := coalesce((p_order ->> 'delivery_fee')::numeric, 0);

  -- Loyalty redemption (points-as-currency)
  IF v_redeem_points > 0 THEN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
      RAISE EXCEPTION 'must be signed in to redeem points';
    END IF;

    SELECT c.id, c.loyalty_points_balance
      INTO v_auth_customer, v_balance
      FROM public.customers c
     WHERE c.auth_user_id = v_auth_uid
       AND c.restaurant_id = v_restaurant_id
     FOR UPDATE;

    IF v_auth_customer IS NULL THEN
      RAISE EXCEPTION 'no linked customer account for redemption';
    END IF;
    IF v_balance < v_redeem_points THEN
      RAISE EXCEPTION 'insufficient points: have %, need %', v_balance, v_redeem_points;
    END IF;

    SELECT ls.redemption_value_sar INTO v_rv_sar
      FROM public.loyalty_settings ls
     WHERE ls.restaurant_id = v_restaurant_id AND ls.enabled;

    IF v_rv_sar IS NULL OR v_rv_sar <= 0 THEN
      RAISE EXCEPTION 'loyalty redemption not configured';
    END IF;

    v_discount := v_redeem_points * v_rv_sar;
    IF v_discount > (v_subtotal + v_delivery_fee) THEN
      v_discount := v_subtotal + v_delivery_fee;
    END IF;

    UPDATE public.customers
       SET loyalty_points_balance = loyalty_points_balance - v_redeem_points,
           updated_at = now()
     WHERE id = v_auth_customer;
  END IF;

  v_total := v_subtotal + v_delivery_fee - v_discount;
  IF v_total < 0 THEN v_total := 0; END IF;

  INSERT INTO public.orders (
    restaurant_id, customer_id, branch_id, order_type, channel,
    subtotal, delivery_fee, discount_amount, loyalty_points_redeemed, total,
    address, lat, lng, notes,
    car_plate, car_color, table_label, session_id,
    business_date, invoice_sequence, daily_order_number, order_number_cycle
  ) VALUES (
    v_restaurant_id, v_customer_id, v_branch_id,
    p_order ->> 'order_type',
    coalesce(nullif(p_order ->> 'channel', ''), 'whatsapp'),
    v_subtotal, v_delivery_fee, v_discount, v_redeem_points, v_total,
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
  RETURNING id INTO v_order_id;

  -- Ledger entry for the redemption
  IF v_redeem_points > 0 THEN
    INSERT INTO public.loyalty_transactions
      (restaurant_id, customer_id, order_id, kind, points, reason)
    VALUES
      (v_restaurant_id, v_auth_customer, v_order_id, 'redeem', -v_redeem_points,
       'خصم فوري: ' || v_discount || ' ر.س');
  END IF;

  INSERT INTO public.order_items (order_id, item_name, variant, qty, unit_price, line_total)
  SELECT
    v_order_id,
    i ->> 'item_name',
    nullif(i ->> 'variant', ''),
    coalesce((i ->> 'qty')::int, 1),
    coalesce((i ->> 'unit_price')::numeric, 0),
    coalesce((i ->> 'unit_price')::numeric, 0) * coalesce((i ->> 'qty')::int, 1)
  FROM jsonb_array_elements(v_items) AS i;

  RETURN jsonb_build_object(
    'customer_id',             v_customer_id,
    'order_id',                v_order_id,
    'branch_id',               v_branch_id,
    'business_date',           v_nums ->> 'business_date',
    'daily_order_number',      v_nums ->> 'daily_order_number',
    'invoice_sequence',        v_nums ->> 'invoice_sequence',
    'discount_amount',         v_discount,
    'loyalty_points_redeemed', v_redeem_points
  );
END;
$$;
