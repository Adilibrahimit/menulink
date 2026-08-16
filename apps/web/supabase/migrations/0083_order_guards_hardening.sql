-- 0083_order_guards_hardening.sql
--
-- Fixes five defects found by review AFTER 0079-0082 were already applied to
-- production. Forward-fix rather than editing those files, so a fresh database
-- replaying the folder ends up where production actually is.
--
-- 1. submit_order trusted the CLIENT's subtotal. 0081 added a delivery-minimum
--    check comparing new.subtotal against the branch zone minimum, but that
--    number came straight from the payload, so items worth 12 could carry
--    "subtotal": 35 and clear a 35 minimum. Worse, the per-item price floor only
--    ran when an item carried BOTH item_id and variant_key, so omitting
--    variant_key skipped price validation entirely. Both are closed here:
--    item_id + variant_key are mandatory, and subtotal is summed server-side
--    from the validated items.
--
-- 2. No idempotency. A retry after an ambiguous failure (RPC committed, response
--    lost - routine on mobile) inserted a SECOND order and deducted loyalty
--    points twice. The new blocking error UI actively invites that retry.
--
-- 3. hours_window_contains fails CLOSED on a parseable-but-invalid time. Its
--    regex accepts '25:00' and '12:60'; the ::time cast then raises, and because
--    the trigger is deliberately not exception-wrapped, EVERY order insert for
--    that tenant fails. 0080's own header promises the opposite ("a typo in the
--    hours field must not take a restaurant offline"). Dormant only because no
--    tenant has hours_json set yet - and the owner-facing editor ships now.
--
-- 4. is_within_hours fails CLOSED on a bad timezone string, while lib/hours.ts
--    catches it and falls back to Asia/Riyadh. The two halves must agree.
--
-- 5. pos_outbox_mark_synced / mark_failed update by id with no status predicate.
--    Harmless until 0079 made a row reclaimable; now a stalled bridge waking up
--    after its row was reclaimed and re-synced by another instance can flip a
--    synced row back to pending (re-injecting it) or park it as failed.

-- --- 1. shared shape of submit_order's return value -------------------------
-- Extracted so the idempotent-retry paths hand back a byte-identical payload.
-- Text casts on the three number-ish fields preserve the original shape, which
-- built them from next_order_number()'s jsonb via ->> (i.e. text).
create or replace function public.order_submit_result(o public.orders)
returns jsonb
language sql
stable
as $fn$
  select jsonb_build_object(
    'customer_id',             o.customer_id,
    'order_id',                o.id,
    'branch_id',               o.branch_id,
    'business_date',           o.business_date::text,
    'daily_order_number',      o.daily_order_number::text,
    'invoice_sequence',        o.invoice_sequence::text,
    'discount_amount',         o.discount_amount,
    'loyalty_points_redeemed', o.loyalty_points_redeemed
  );
$fn$;

-- --- 2. idempotency key -----------------------------------------------------
alter table public.orders
  add column if not exists client_ref text;

comment on column public.orders.client_ref is
  'Client-generated id for one checkout attempt-set. Lets a retry after a lost '
  'response return the original order instead of creating a duplicate. NULL for '
  'orders placed by older clients.';

-- Partial: pre-existing rows and any non-PWA insert path stay unconstrained.
create unique index if not exists orders_restaurant_client_ref_uniq
  on public.orders (restaurant_id, client_ref)
  where client_ref is not null;

-- --- 3. submit_order --------------------------------------------------------
-- Body generated from the live pg_get_functiondef and edited in five hunks, so
-- the nine-times-redefined logic is carried over verbatim rather than retyped
-- (which is how accbccb's regression happened).
CREATE OR REPLACE FUNCTION public.submit_order(p_order jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
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
  v_client_ref    text := nullif(p_order ->> 'client_ref', '');
  v_existing      jsonb;
BEGIN
  IF v_restaurant_id IS NULL THEN RAISE EXCEPTION 'restaurant_id is required'; END IF;
  IF v_phone IS NULL OR length(trim(v_phone)) = 0 THEN RAISE EXCEPTION 'phone is required'; END IF;
  IF jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'items must be a non-empty array'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = v_restaurant_id AND r.is_active) THEN
    RAISE EXCEPTION 'restaurant % is not active', v_restaurant_id;
  END IF;

  -- Idempotent retry: the customer's device sends a stable client_ref per
  -- checkout attempt-set. A retry after an ambiguous failure (RPC committed but
  -- the response was lost — common on mobile) must return the FIRST order, not
  -- insert a second one and deduct points twice.
  -- The advisory lock serializes concurrent submits of the same ref so the
  -- lookup below is authoritative; the unique index is the backstop.
  -- Placed before next_order_number(): that advances a gapless invoice sequence
  -- ZATCA-adjacent bookkeeping relies on, so a retry must not reach it.
  IF v_client_ref IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_restaurant_id::text || ':' || v_client_ref, 0));
    SELECT public.order_submit_result(o) INTO v_existing
      FROM public.orders o
     WHERE o.restaurant_id = v_restaurant_id AND o.client_ref = v_client_ref;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  v_branch_id := coalesce(
    (p_order ->> 'branch_id')::uuid,
    public.get_default_branch_id(v_restaurant_id)
  );
  v_nums := public.next_order_number(v_branch_id);

  -- Price validation. item_id + variant_key are REQUIRED: they are what makes
  -- the menu-price floor check below reachable.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    IF v_item ->> 'item_id' IS NULL OR v_item ->> 'variant_key' IS NULL THEN
      RAISE EXCEPTION 'item_id and variant_key are required for every item';
    END IF;
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
  -- Server-computed from the items just validated above. The client used to
  -- supply this verbatim, so items worth 12 could carry "subtotal": 35 and sail
  -- past the branch delivery minimum (0081). Identical to the cart's own
  -- sum(qty * price) for an honest client.
  SELECT coalesce(sum(coalesce((i ->> 'unit_price')::numeric, 0)
                    * coalesce((i ->> 'qty')::int, 1)), 0)
    INTO v_subtotal
    FROM jsonb_array_elements(v_items) AS i;
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
  END IF;

  v_total := v_subtotal + v_delivery_fee - v_discount;
  IF v_total < 0 THEN v_total := 0; END IF;

  BEGIN
  INSERT INTO public.orders (
    restaurant_id, customer_id, branch_id, order_type, channel,
    subtotal, delivery_fee, discount_amount, loyalty_points_redeemed, total,
    address, lat, lng, notes,
    car_plate, car_color, table_label, session_id,
    business_date, invoice_sequence, daily_order_number, order_number_cycle,
    client_ref
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
    (v_nums ->> 'order_number_cycle')::int,
    v_client_ref
  )
  RETURNING id INTO v_order_id;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent submit with the same client_ref committed first. Nothing has
    -- been deducted yet (the redemption UPDATE runs below), so just hand back
    -- the winning order.
    SELECT public.order_submit_result(o) INTO v_existing
      FROM public.orders o
     WHERE o.restaurant_id = v_restaurant_id AND o.client_ref = v_client_ref;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
    RAISE;
  END;

  -- Deduction + ledger, now that the order row is committed-safe.
  IF v_redeem_points > 0 THEN
    UPDATE public.customers
       SET loyalty_points_balance = loyalty_points_balance - v_redeem_points,
           updated_at = now()
     WHERE id = v_auth_customer;

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
$fn$;


-- --- 4. hours: fail OPEN on bad input, as documented ------------------------
create or replace function public.hours_window_contains(p_window text, p_now time)
returns boolean
language plpgsql
immutable
as $fn$
declare
  v_open  time;
  v_close time;
  v_parts text[];
begin
  if p_window is null then return false; end if;
  p_window := lower(btrim(p_window));

  if p_window in ('closed', $ar$مغلق$ar$) then return false; end if;
  if p_window in ('24/7', '24-7', 'open', $ar$مفتوح$ar$) then return true; end if;

  -- Minutes constrained to 00-59 and hours checked numerically, so '12:60' and
  -- '25:00' reach the fail-open branch instead of a cast that raises.
  v_parts := regexp_match(p_window, '^([0-9]{1,2}):([0-5][0-9])\s*-\s*([0-9]{1,2}):([0-5][0-9])$');
  if v_parts is null then return true; end if;
  if v_parts[1]::int > 24 or v_parts[3]::int > 24 then return true; end if;

  -- '24:00' is a legitimate way to write midnight but is out of range for time.
  v_open  := case when v_parts[1]::int = 24 then time '23:59:59'
                  else (v_parts[1] || ':' || v_parts[2])::time end;
  v_close := case when v_parts[3]::int = 24 then time '23:59:59'
                  else (v_parts[3] || ':' || v_parts[4])::time end;

  if v_close > v_open then
    return p_now >= v_open and p_now < v_close;
  else
    -- wraps past midnight, e.g. 18:00-02:00
    return p_now >= v_open or p_now < v_close;
  end if;
end;
$fn$;

-- --- 5. hours: unknown timezone must not close the restaurant ---------------
create or replace function public.is_within_hours(
  p_restaurant_id uuid,
  p_branch_id     uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_hours    jsonb;
  v_tz       text;
  v_local    timestamp;
  v_day      text;
  v_entry    jsonb;
  v_window   text;
begin
  select b.hours_json, b.timezone
    into v_hours, v_tz
    from public.restaurant_branches b
   where b.id = p_branch_id;

  if v_hours is null then
    select r.hours_json, coalesce(v_tz, r.timezone)
      into v_hours, v_tz
      from public.restaurants r
     where r.id = p_restaurant_id;
  end if;

  if v_hours is null or jsonb_typeof(v_hours) <> 'object' then
    return true;                              -- not configured -> open
  end if;

  v_tz := coalesce(v_tz, 'Asia/Riyadh');
  -- timezone is free text with no CHECK; a typo used to raise here and reject
  -- every order. lib/hours.ts localNow() makes the same fallback.
  begin
    v_local := now() at time zone v_tz;
  exception when others then
    v_local := now() at time zone 'Asia/Riyadh';
  end;
  v_day := lower(to_char(v_local, 'dy'));

  v_entry := v_hours -> v_day;
  if v_entry is null or jsonb_typeof(v_entry) = 'null' then
    return true;                              -- day not listed -> open
  end if;

  if jsonb_typeof(v_entry) = 'array' then
    -- An empty array is an unconfigured day, not a closed one: fail open, and
    -- match lib/hours.ts, which treats an empty window list the same way.
    if jsonb_array_length(v_entry) = 0 then return true; end if;
    for v_window in select jsonb_array_elements_text(v_entry) loop
      if public.hours_window_contains(v_window, v_local::time) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  return public.hours_window_contains(v_entry #>> '{}', v_local::time);
end;
$fn$;

-- --- 6. outbox: late writes from a superseded claimer are ignored -----------
-- Both previously updated by id alone. After 0079 a row can legitimately change
-- hands, so a write from the previous claimer must not land. A no-op is the
-- correct outcome: the row already reached its true state via the new claimer.
create or replace function public.pos_outbox_mark_synced(
  p_outbox_id uuid, p_pos_invoice_id text, p_pos_invoice_no bigint, p_pos_bill_no bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.pos_outbox
     set status         = 'synced',
         pos_invoice_id = p_pos_invoice_id,
         pos_invoice_no = p_pos_invoice_no,
         pos_bill_no    = p_pos_bill_no,
         synced_at      = now(),
         last_attempted_at = now(),
         attempts       = attempts + 1
   where id = p_outbox_id
     and status = 'claimed';
end;
$fn$;

create or replace function public.pos_outbox_mark_failed(
  p_outbox_id uuid, p_error text, p_will_retry boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.pos_outbox
     set status         = case when p_will_retry then 'pending' else 'failed' end,
         claimed_by     = null,
         claimed_at     = null,
         last_error     = p_error,
         last_attempted_at = now(),
         attempts       = attempts + 1
   where id = p_outbox_id
     and status = 'claimed';
end;
$fn$;

-- --- 7. outbox: space out retries -------------------------------------------
-- mark_failed(will_retry) returns a row to 'pending' with no delay gate and the
-- bridge polls every 5s, so all 5 attempts burned in ~25 seconds and a POS or
-- LAN blip lasting a minute turned live orders into permanent manual recovery.
-- Skipping recently-attempted rows stretches the same 5 attempts over ~10
-- minutes with no bridge-side change.
create or replace function public.pos_outbox_claim(
  p_restaurant_id uuid, p_instance_id text, p_batch_size integer default 10)
returns setof public.pos_outbox
language plpgsql
security definer
set search_path = public
as $fn$
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
        and (last_attempted_at is null
             or last_attempted_at < now() - interval '2 minutes')
      order by created_at
      limit p_batch_size
      for update skip locked
   )
  returning *;
end;
$fn$;

-- Grants unchanged from 0009/0071: these three stay service_role-only.
revoke all on function public.pos_outbox_claim(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.pos_outbox_mark_synced(uuid, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.pos_outbox_mark_failed(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.pos_outbox_claim(uuid, text, integer)              to service_role;
grant execute on function public.pos_outbox_mark_synced(uuid, text, bigint, bigint) to service_role;
grant execute on function public.pos_outbox_mark_failed(uuid, text, boolean)        to service_role;
grant execute on function public.hours_window_contains(text, time) to anon, authenticated, service_role;
grant execute on function public.is_within_hours(uuid, uuid)       to anon, authenticated, service_role;

-- NOTE (deliberately NOT done here): per-branch outbox routing.
-- State as of this migration, verified against the live database:
--   * pos_outbox.branch_id EXISTS and 25 of 43 rows carry a value, but
--     enqueue_pos_outbox() inserts only (restaurant_id, order_id, payload), so
--     nothing populates it today — those rows predate the current trigger.
--   * build_pos_outbox_payload() does not expose branch at all.
--   * pos_outbox_claim filters on restaurant_id only, so with rzrz-bukhari's two
--     branches whichever bridge instance polls first takes every order.
-- Nearest-branch resolution now makes orders.branch_id vary per order, so this
-- has to be settled before the 2-branch go-live. It is NOT a claim-filter change
-- alone: العزيزية and الملز are separate POS databases while pos_settings is
-- keyed by restaurant with a single pos_branch_id, so the config model changes
-- with it. Deferred to the RzRz server session, where it can be tested against
-- the real POS instead of shipped blind into a live restaurant's order path.
