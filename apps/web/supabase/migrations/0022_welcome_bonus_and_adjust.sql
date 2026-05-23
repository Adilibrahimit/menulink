-- ============================================================================
-- MenuLink · 0022_welcome_bonus_and_adjust
--
-- Slice 3 additions:
--   1. link_customer_account is rewritten to ALSO grant the per-tenant
--      welcome_bonus_points the first time a customer's auth_user_id is
--      bound to that tenant's customer row, when the tenant has loyalty on
--      AND the customer's loyalty_lifetime_points = 0. One-shot per
--      (customer, tenant). Eligibility is checked per newly-linked row, so
--      a customer who already had points at tenant A but is new at tenant
--      B gets B's welcome bonus only.
--
--   2. adjust_customer_points(customer_id, delta, reason) — owner/ops can
--      grant or deduct points manually. Inserts an `adjust` ledger row +
--      updates customers.loyalty_points_balance. lifetime_points moves
--      only on positive deltas (it's a "never decremented" cumulative
--      counter — refunds via cancel_redemption don't change it either).
-- ============================================================================

begin;

-- --- 1. link_customer_account v2: link + per-tenant welcome bonus -------
create or replace function public.link_customer_account(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_phone         text := trim(coalesce(p_phone, ''));
  v_conflict_count int := 0;
  v_existing_orders int := 0;
  v_linked_count  int := 0;
  v_bonus_count   int := 0;
  v_bonus_total   int := 0;
  rec record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if v_phone = '' then
    return jsonb_build_object('ok', false, 'reason', 'phone_required');
  end if;

  -- Hijack guard
  select count(*) into v_conflict_count
    from public.customers
   where phone = v_phone
     and auth_user_id is not null
     and auth_user_id <> v_uid;
  if v_conflict_count > 0 then
    return jsonb_build_object('ok', false, 'reason', 'phone_already_linked');
  end if;

  select count(*) into v_existing_orders
    from public.orders o
    join public.customers c on c.id = o.customer_id
   where c.phone = v_phone;

  -- Link, capturing IDs of rows we just touched so we can grant bonuses
  for rec in
    update public.customers
       set auth_user_id = v_uid
     where phone = v_phone
       and auth_user_id is null
    returning id, restaurant_id, loyalty_lifetime_points
  loop
    v_linked_count := v_linked_count + 1;

    -- Welcome bonus eligibility:
    --   tenant has loyalty addon enabled
    --   tenant's loyalty_settings.enabled = true
    --   customer's loyalty_lifetime_points = 0 (no prior earning at this tenant)
    --   welcome_bonus_points > 0
    if rec.loyalty_lifetime_points = 0
       and exists (
         select 1 from public.subscription_addons sa
          where sa.restaurant_id = rec.restaurant_id
            and sa.addon_key = 'loyalty'
            and sa.enabled = true
            and (sa.trial_ends_at is null or sa.trial_ends_at > now())
       )
    then
      declare
        v_bonus int;
        v_settings_on boolean;
      begin
        select enabled, welcome_bonus_points
          into v_settings_on, v_bonus
          from public.loyalty_settings
         where restaurant_id = rec.restaurant_id;

        if coalesce(v_settings_on, false) and coalesce(v_bonus, 0) > 0 then
          insert into public.loyalty_transactions
            (restaurant_id, customer_id, kind, points, reason)
          values
            (rec.restaurant_id, rec.id, 'bonus', v_bonus, 'welcome bonus on account link');

          update public.customers
             set loyalty_points_balance  = loyalty_points_balance  + v_bonus,
                 loyalty_lifetime_points = loyalty_lifetime_points + v_bonus
           where id = rec.id;

          v_bonus_count := v_bonus_count + 1;
          v_bonus_total := v_bonus_total + v_bonus;
        end if;
      end;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'linked_count', v_linked_count,
    'existing_orders', v_existing_orders,
    'welcome_bonus_count', v_bonus_count,
    'welcome_bonus_total_points', v_bonus_total
  );
end;
$$;

-- --- 2. adjust_customer_points -------------------------------------------
-- Owner/ops can grant or deduct points with a reason. Use cases:
--   "Customer ordered cash at the till — give them their points"
--   "Customer brought food back — claw back the points earned"
--   "VIP bonus for being a top customer this month"
--
-- Lifetime points only increase (matches our "never decremented" model:
-- tier qualification should never regress because of a refund).
create or replace function public.adjust_customer_points(
  p_customer_id uuid,
  p_delta       int,
  p_reason      text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
begin
  if p_delta = 0 then
    return jsonb_build_object('ok', false, 'reason', 'delta_zero');
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'reason_required');
  end if;

  select * into v_customer from public.customers where id = p_customer_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'customer_not_found');
  end if;

  -- Authorize: owner of this customer's restaurant OR platform admin
  if not (public.owns_restaurant(v_customer.restaurant_id) or public.is_platform_admin()) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  -- Don't let a deduction drive the balance negative
  if p_delta < 0 and v_customer.loyalty_points_balance + p_delta < 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'would_go_negative',
      'current_balance', v_customer.loyalty_points_balance
    );
  end if;

  insert into public.loyalty_transactions
    (restaurant_id, customer_id, kind, points, reason)
  values
    (v_customer.restaurant_id, v_customer.id, 'adjust', p_delta, trim(p_reason));

  -- Balance always tracks the signed delta. Lifetime only goes up so tier
  -- can't regress on a manual deduction.
  update public.customers
     set loyalty_points_balance  = loyalty_points_balance + p_delta,
         loyalty_lifetime_points = case
           when p_delta > 0 then loyalty_lifetime_points + p_delta
           else loyalty_lifetime_points
         end
   where id = v_customer.id;

  return jsonb_build_object(
    'ok', true,
    'new_balance', v_customer.loyalty_points_balance + p_delta
  );
end;
$$;

revoke all on function public.adjust_customer_points(uuid, int, text) from public;
grant execute on function public.adjust_customer_points(uuid, int, text) to authenticated;

commit;
