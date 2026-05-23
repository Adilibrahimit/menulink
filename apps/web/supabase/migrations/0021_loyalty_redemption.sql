-- ============================================================================
-- MenuLink · 0021_loyalty_redemption
--
-- Slice 2 of the loyalty service. Adds the three SECURITY DEFINER RPCs the
-- redemption flow needs:
--
--   redeem_reward(reward_id)      — customer requests a reward. Atomic:
--                                   inserts redemption (pending) + ledger
--                                   row (kind=redeem, negative) + decrements
--                                   customers.loyalty_points_balance.
--   fulfill_redemption(red_id)    — owner marks "handed over to customer".
--   cancel_redemption(red_id)     — owner cancels. Compensating positive
--                                   adjust transaction refunds points to the
--                                   customer's balance.
--
-- Tier hierarchy needed for "is this reward unlocked for this customer":
--   bronze (1) < silver (2) < gold (3) < platinum (4)
-- A small immutable helper avoids repeating the case statement everywhere.
-- ============================================================================

begin;

-- --- Tier ranking helper ---------------------------------------------------
create or replace function public.tier_rank(t text) returns int
language sql immutable
as $$
  select case t
    when 'bronze'   then 1
    when 'silver'   then 2
    when 'gold'     then 3
    when 'platinum' then 4
    else 0
  end;
$$;

-- --- redeem_reward --------------------------------------------------------
-- Returns:
--   { ok: true,  redemption_id, points_after } on success
--   { ok: false, reason } where reason ∈
--     not_signed_in / reward_not_available / not_linked_to_tenant /
--     insufficient_points / tier_too_low (+ required tier)
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_reward        public.loyalty_rewards%rowtype;
  v_customer      public.customers%rowtype;
  v_redemption_id uuid;
  v_settings_on   boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select * into v_reward from public.loyalty_rewards
   where id = p_reward_id and active = true;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'reward_not_available');
  end if;

  -- Tenant must have loyalty addon on AND loyalty_settings.enabled
  if not exists (
    select 1 from public.subscription_addons sa
    where sa.restaurant_id = v_reward.restaurant_id
      and sa.addon_key = 'loyalty'
      and sa.enabled = true
      and (sa.trial_ends_at is null or sa.trial_ends_at > now())
  ) then
    return jsonb_build_object('ok', false, 'reason', 'loyalty_disabled');
  end if;
  select enabled into v_settings_on from public.loyalty_settings where restaurant_id = v_reward.restaurant_id;
  if not coalesce(v_settings_on, false) then
    return jsonb_build_object('ok', false, 'reason', 'loyalty_disabled');
  end if;

  select * into v_customer
    from public.customers
   where restaurant_id = v_reward.restaurant_id
     and auth_user_id  = v_uid
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_linked_to_tenant');
  end if;

  if v_customer.loyalty_points_balance < v_reward.points_cost then
    return jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_points',
      'balance', v_customer.loyalty_points_balance,
      'required', v_reward.points_cost
    );
  end if;

  if public.tier_rank(v_customer.loyalty_tier) < public.tier_rank(v_reward.min_tier) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'tier_too_low',
      'current_tier', v_customer.loyalty_tier,
      'required_tier', v_reward.min_tier
    );
  end if;

  -- max_per_customer cap, if set
  if v_reward.max_per_customer is not null then
    declare v_used int;
    begin
      select count(*) into v_used
        from public.loyalty_redemptions
       where customer_id = v_customer.id
         and reward_id   = v_reward.id
         and status <> 'cancelled';
      if v_used >= v_reward.max_per_customer then
        return jsonb_build_object('ok', false, 'reason', 'limit_reached');
      end if;
    end;
  end if;

  -- Atomic: redemption + ledger + balance decrement (the whole function
  -- runs inside one transaction since plpgsql wraps it).
  insert into public.loyalty_redemptions
    (restaurant_id, customer_id, reward_id, points_cost, status)
  values
    (v_reward.restaurant_id, v_customer.id, v_reward.id, v_reward.points_cost, 'pending')
  returning id into v_redemption_id;

  insert into public.loyalty_transactions
    (restaurant_id, customer_id, kind, points, reason)
  values
    (v_reward.restaurant_id, v_customer.id, 'redeem', -v_reward.points_cost,
     format('redeem reward %s', v_reward.id::text));

  update public.customers
     set loyalty_points_balance = loyalty_points_balance - v_reward.points_cost
   where id = v_customer.id;

  return jsonb_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'points_after', v_customer.loyalty_points_balance - v_reward.points_cost
  );
end;
$$;

revoke all on function public.redeem_reward(uuid) from public;
grant execute on function public.redeem_reward(uuid) to authenticated;

-- --- fulfill_redemption ---------------------------------------------------
create or replace function public.fulfill_redemption(p_redemption_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_red public.loyalty_redemptions%rowtype;
begin
  select * into v_red from public.loyalty_redemptions where id = p_redemption_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not (public.owns_restaurant(v_red.restaurant_id) or public.is_platform_admin()) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if v_red.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_pending', 'current_status', v_red.status);
  end if;
  update public.loyalty_redemptions
     set status = 'fulfilled', fulfilled_at = now()
   where id = p_redemption_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.fulfill_redemption(uuid) from public;
grant execute on function public.fulfill_redemption(uuid) to authenticated;

-- --- cancel_redemption ----------------------------------------------------
-- Refunds points via a compensating positive adjust transaction so the
-- ledger sums match the live balance.
create or replace function public.cancel_redemption(p_redemption_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_red public.loyalty_redemptions%rowtype;
begin
  select * into v_red from public.loyalty_redemptions where id = p_redemption_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not (public.owns_restaurant(v_red.restaurant_id) or public.is_platform_admin()) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if v_red.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_pending', 'current_status', v_red.status);
  end if;

  insert into public.loyalty_transactions
    (restaurant_id, customer_id, kind, points, reason)
  values
    (v_red.restaurant_id, v_red.customer_id, 'adjust', v_red.points_cost,
     coalesce(p_reason, format('refund cancelled redemption %s', v_red.id::text)));

  update public.customers
     set loyalty_points_balance = loyalty_points_balance + v_red.points_cost
   where id = v_red.customer_id;

  update public.loyalty_redemptions
     set status = 'cancelled',
         cancelled_at = now(),
         notes = coalesce(p_reason, notes)
   where id = p_redemption_id;

  return jsonb_build_object('ok', true, 'refunded_points', v_red.points_cost);
end;
$$;

revoke all on function public.cancel_redemption(uuid, text) from public;
grant execute on function public.cancel_redemption(uuid, text) to authenticated;

commit;
