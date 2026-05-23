-- ============================================================================
-- MenuLink · 0023_loyalty_expiry_and_realtime
--
-- Slice 4 schema:
--   1. loyalty_settings.points_expiry_days (nullable int) — null/0 = never
--      expire. Lazy expiration: when a customer next earns, we check if
--      their last_loyalty_earn_at is older than the threshold; if so,
--      insert an `expire` ledger row + zero the balance BEFORE the new
--      earn lands. Keeps the policy free of cron / scheduled jobs.
--   2. customers.last_loyalty_earn_at — tracked per earn for the expiry
--      window. Backfilled from last_seen_at for safety (otherwise null
--      means "never expired even if dormant for years").
--   3. Add loyalty_redemptions to the supabase_realtime publication.
--      The admin queue page already subscribes and was likely receiving
--      nothing — this turns it on. Also enables the new customer-side
--      notification (slice 4 task #44).
-- ============================================================================

begin;

-- --- 1. Schema additions -------------------------------------------------
alter table public.loyalty_settings
  add column if not exists points_expiry_days int;
alter table public.loyalty_settings
  add constraint loyalty_settings_expiry_nonneg
  check (points_expiry_days is null or points_expiry_days >= 0);

alter table public.customers
  add column if not exists last_loyalty_earn_at timestamptz;

-- Seed last_loyalty_earn_at on existing customers who already have points
-- so we don't accidentally expire them on the first earn after this migration
-- lands. Use last_seen_at as a reasonable proxy for "most recent activity".
update public.customers
   set last_loyalty_earn_at = coalesce(last_seen_at, now())
 where loyalty_lifetime_points > 0
   and last_loyalty_earn_at is null;

-- --- 2. expire_stale_points_if_needed -----------------------------------
create or replace function public.expire_stale_points_if_needed(p_customer_id uuid)
returns int  -- points expired, 0 if none
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_settings public.loyalty_settings%rowtype;
  v_amount   int;
begin
  select * into v_customer from public.customers where id = p_customer_id;
  if not found then return 0; end if;
  if v_customer.loyalty_points_balance <= 0 then return 0; end if;
  if v_customer.last_loyalty_earn_at is null then return 0; end if;

  select * into v_settings
    from public.loyalty_settings
   where restaurant_id = v_customer.restaurant_id;
  if not found then return 0; end if;
  if v_settings.points_expiry_days is null or v_settings.points_expiry_days <= 0 then
    return 0;
  end if;

  if v_customer.last_loyalty_earn_at < now() - make_interval(days => v_settings.points_expiry_days) then
    v_amount := v_customer.loyalty_points_balance;
    insert into public.loyalty_transactions
      (restaurant_id, customer_id, kind, points, reason)
    values
      (v_customer.restaurant_id, v_customer.id, 'expire', -v_amount,
       format('expired after %s days of inactivity', v_settings.points_expiry_days));
    update public.customers
       set loyalty_points_balance = 0
     where id = p_customer_id;
    return v_amount;
  end if;
  return 0;
end;
$$;

-- --- 3. Update loyalty_after_order_insert -------------------------------
-- BEFORE the earn: call expire_stale_points_if_needed (lazy expiry).
-- AFTER the earn: stamp last_loyalty_earn_at = now() so the expiry window
-- restarts. Both wrapped in the same EXCEPTION-protected block as before.
create or replace function public.loyalty_after_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loyalty_on   boolean;
  v_settings     public.loyalty_settings%rowtype;
  v_points       int;
  v_orders       int;
  v_spend        numeric;
  v_new_tier     text;
begin
  select exists(
    select 1 from public.subscription_addons sa
     where sa.restaurant_id = new.restaurant_id
       and sa.addon_key = 'loyalty'
       and sa.enabled = true
       and (sa.trial_ends_at is null or sa.trial_ends_at > now())
  ) into v_loyalty_on;
  if not coalesce(v_loyalty_on, false) then return new; end if;

  begin
    select * into v_settings from public.loyalty_settings where restaurant_id = new.restaurant_id;
    if not found then
      insert into public.loyalty_settings (restaurant_id) values (new.restaurant_id)
      returning * into v_settings;
    end if;
    if not v_settings.enabled then return new; end if;

    -- Lazy expiry — clears stale balance BEFORE this earn lands
    perform public.expire_stale_points_if_needed(new.customer_id);

    select orders_count, lifetime_spend into v_orders, v_spend
      from public.customers where id = new.customer_id;

    v_points := floor(new.total * v_settings.points_per_sar)::int;
    if v_points > 0 then
      insert into public.loyalty_transactions
        (restaurant_id, customer_id, order_id, kind, points, reason)
      values
        (new.restaurant_id, new.customer_id, new.id, 'earn', v_points,
         format('earn for order %s', new.id::text));

      update public.customers
         set loyalty_points_balance  = loyalty_points_balance  + v_points,
             loyalty_lifetime_points = loyalty_lifetime_points + v_points,
             last_loyalty_earn_at    = now()
       where id = new.customer_id;
    end if;

    v_new_tier := public.compute_loyalty_tier(
      v_settings.tier_thresholds_json,
      coalesce(v_orders, 0),
      coalesce(v_spend, 0)
    );
    update public.customers set loyalty_tier = v_new_tier where id = new.customer_id;

  exception when others then
    raise warning 'loyalty_after_order_insert failed for order %: % %', new.id, sqlstate, sqlerrm;
  end;

  return new;
end;
$$;

-- --- 4. Realtime publication --------------------------------------------
-- The admin redemption queue + the new customer notification BOTH need
-- this. Catching a silent gap that's existed since 0017.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'loyalty_redemptions'
  ) then
    alter publication supabase_realtime add table public.loyalty_redemptions;
  end if;
end $$;

commit;
