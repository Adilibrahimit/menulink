-- ============================================================================
-- MenuLink · 0017_loyalty
--
-- Phase 1 of the loyalty service. This migration only adds the schema +
-- the auto-earn trigger; rewards CRUD, redemption flow, and customer
-- account page link the existing tables but are built in app code.
--
-- Safety notes (per pre-build review):
--   1. The existing touch_customer_last_seen trigger is extended additively
--      to also maintain orders_count + lifetime_spend. These are needed for
--      tier computation REGARDLESS of whether the loyalty addon is on,
--      so a tenant who enables loyalty months later still gets correct
--      tier on their next order.
--   2. The new loyalty earn logic lives in a SEPARATE trigger wrapped in
--      EXCEPTION WHEN OTHERS THEN RAISE WARNING. A bug in the loyalty
--      branch can never break order insertion for the tenant.
--   3. customers.auth_user_id added now; the phone-link logic in the
--      account page guards against hijack by refusing to link when an
--      existing row with that phone already has auth_user_id set.
--   4. Full migration body wrapped in BEGIN/COMMIT for atomic apply.
-- ============================================================================

begin;

-- --- 1. loyalty_settings (one row per tenant) ----------------------------
create table if not exists public.loyalty_settings (
  restaurant_id        uuid primary key references public.restaurants(id) on delete cascade,
  enabled              boolean not null default true,
  points_per_sar       numeric(6,3) not null default 1.000,
  redemption_value_sar numeric(6,3) not null default 0.100,
  tier_thresholds_json jsonb not null default '{
    "bronze":   {"orders": 0,  "spend": 0},
    "silver":   {"orders": 5,  "spend": 500},
    "gold":     {"orders": 20, "spend": 2000},
    "platinum": {"orders": 50, "spend": 5000}
  }'::jsonb,
  welcome_bonus_points  int not null default 50,
  birthday_bonus_points int not null default 100,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists loyalty_settings_set_updated_at on public.loyalty_settings;
create trigger loyalty_settings_set_updated_at
  before update on public.loyalty_settings
  for each row execute function public.set_updated_at();

-- --- 2. loyalty_rewards (catalog — used in slice 2) ----------------------
create table if not exists public.loyalty_rewards (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name_ar       text not null,
  description_ar text,
  points_cost   int not null check (points_cost > 0),
  image_url     text,
  min_tier      text not null default 'bronze'
                check (min_tier in ('bronze','silver','gold','platinum')),
  max_per_customer int,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists loyalty_rewards_restaurant_idx
  on public.loyalty_rewards(restaurant_id, sort_order)
  where active = true;

-- --- 3. loyalty_transactions (append-only ledger) ------------------------
create table if not exists public.loyalty_transactions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  order_id      uuid references public.orders(id) on delete set null,
  kind          text not null check (kind in ('earn','redeem','adjust','bonus','expire')),
  points        int not null,                            -- signed
  reason        text,
  created_at    timestamptz not null default now()
);

create index if not exists loyalty_tx_customer_idx
  on public.loyalty_transactions(restaurant_id, customer_id, created_at desc);

-- --- 4. loyalty_redemptions (slice 2 placeholder) ------------------------
create table if not exists public.loyalty_redemptions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  reward_id     uuid not null references public.loyalty_rewards(id) on delete restrict,
  points_cost   int not null,
  status        text not null default 'pending'
                check (status in ('pending','fulfilled','cancelled')),
  order_id      uuid references public.orders(id) on delete set null,
  redeemed_at   timestamptz not null default now(),
  fulfilled_at  timestamptz,
  cancelled_at  timestamptz,
  notes         text
);

create index if not exists loyalty_redemptions_status_idx
  on public.loyalty_redemptions(restaurant_id, status, redeemed_at desc);

-- --- 5. customers columns ------------------------------------------------
alter table public.customers
  add column if not exists auth_user_id            uuid references auth.users(id) on delete set null,
  add column if not exists orders_count            int          not null default 0,
  add column if not exists lifetime_spend          numeric(12,2) not null default 0,
  add column if not exists loyalty_points_balance  int          not null default 0,
  add column if not exists loyalty_lifetime_points int          not null default 0,
  add column if not exists loyalty_tier            text         not null default 'bronze'
                                                 check (loyalty_tier in ('bronze','silver','gold','platinum'));

create index if not exists customers_auth_user_idx
  on public.customers(auth_user_id)
  where auth_user_id is not null;

-- Self-read policy: a signed-in customer can read their own customer rows.
drop policy if exists customer_self_read_customers on public.customers;
create policy "customer_self_read_customers"
  on public.customers for select to authenticated
  using (auth_user_id = auth.uid());

-- --- 6. RLS on the new tables --------------------------------------------
alter table public.loyalty_settings     enable row level security;
alter table public.loyalty_rewards      enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.loyalty_redemptions  enable row level security;

-- Settings
drop policy if exists owner_all_loyalty_settings on public.loyalty_settings;
drop policy if exists ops_all_loyalty_settings   on public.loyalty_settings;
create policy "owner_all_loyalty_settings"
  on public.loyalty_settings for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));
create policy "ops_all_loyalty_settings"
  on public.loyalty_settings for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Rewards
drop policy if exists owner_all_loyalty_rewards    on public.loyalty_rewards;
drop policy if exists ops_all_loyalty_rewards      on public.loyalty_rewards;
drop policy if exists anon_read_active_rewards     on public.loyalty_rewards;
drop policy if exists customer_read_active_rewards on public.loyalty_rewards;
create policy "owner_all_loyalty_rewards"
  on public.loyalty_rewards for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));
create policy "ops_all_loyalty_rewards"
  on public.loyalty_rewards for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy "anon_read_active_rewards"
  on public.loyalty_rewards for select to anon
  using (active = true);
create policy "customer_read_active_rewards"
  on public.loyalty_rewards for select to authenticated
  using (active = true);

-- Transactions
drop policy if exists owner_read_loyalty_tx    on public.loyalty_transactions;
drop policy if exists ops_all_loyalty_tx       on public.loyalty_transactions;
drop policy if exists customer_read_own_tx     on public.loyalty_transactions;
create policy "owner_read_loyalty_tx"
  on public.loyalty_transactions for select to authenticated
  using (public.owns_restaurant(restaurant_id));
create policy "ops_all_loyalty_tx"
  on public.loyalty_transactions for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy "customer_read_own_tx"
  on public.loyalty_transactions for select to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = loyalty_transactions.customer_id
      and c.auth_user_id = auth.uid()
  ));

-- Redemptions (placeholder policies — flow built in slice 2)
drop policy if exists owner_all_loyalty_redemptions     on public.loyalty_redemptions;
drop policy if exists ops_all_loyalty_redemptions       on public.loyalty_redemptions;
drop policy if exists customer_read_own_redemptions     on public.loyalty_redemptions;
drop policy if exists customer_create_own_redemption    on public.loyalty_redemptions;
create policy "owner_all_loyalty_redemptions"
  on public.loyalty_redemptions for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));
create policy "ops_all_loyalty_redemptions"
  on public.loyalty_redemptions for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy "customer_read_own_redemptions"
  on public.loyalty_redemptions for select to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = loyalty_redemptions.customer_id
      and c.auth_user_id = auth.uid()
  ));

-- --- 7. Tier helper ------------------------------------------------------
-- Returns the highest tier the customer qualifies for (hybrid: orders OR
-- spend, whichever passes). Defensive against missing/malformed json.
create or replace function public.compute_loyalty_tier(
  p_thresholds jsonb,
  p_orders     int,
  p_spend      numeric
) returns text
language plpgsql
immutable
as $$
declare
  v_tier  text := 'bronze';
  v_tiers text[] := array['platinum','gold','silver','bronze'];
  t       text;
  t_obj   jsonb;
begin
  foreach t in array v_tiers loop
    t_obj := p_thresholds -> t;
    if t_obj is null then continue; end if;
    if p_orders >= coalesce((t_obj ->> 'orders')::int, 999999999)
       or p_spend >= coalesce((t_obj ->> 'spend')::numeric, 999999999) then
      v_tier := t;
      exit;
    end if;
  end loop;
  return v_tier;
end;
$$;

-- --- 8. Extend touch_customer_last_seen (additive bookkeeping) ----------
-- Always tracks orders_count + lifetime_spend, even when loyalty addon
-- is off. Tier computes correctly the moment a tenant enables loyalty.
-- Trigger stays named orders_touch_customer (defined in 0001) — only the
-- function body changes.
create or replace function public.touch_customer_last_seen()
returns trigger
language plpgsql
as $$
begin
  update public.customers
     set last_seen_at   = greatest(last_seen_at, new.created_at),
         orders_count   = orders_count + 1,
         lifetime_spend = lifetime_spend + new.total
   where id = new.customer_id;
  return new;
end;
$$;

-- --- 9. Separate loyalty trigger (allowed to fail without breaking order)
-- Reads orders_count + lifetime_spend AFTER touch_customer_last_seen has
-- already updated them. Trigger order is alphabetical, so this function's
-- trigger MUST sort after orders_touch_customer.
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
  -- Quick exit: addon off → do nothing
  select exists(
    select 1 from public.subscription_addons sa
     where sa.restaurant_id = new.restaurant_id
       and sa.addon_key = 'loyalty'
       and sa.enabled = true
       and (sa.trial_ends_at is null or sa.trial_ends_at > now())
  ) into v_loyalty_on;
  if not coalesce(v_loyalty_on, false) then return new; end if;

  -- All loyalty work is in this block. Any failure → log + continue
  -- (order insertion succeeds even if loyalty bookkeeping fails).
  begin
    select * into v_settings from public.loyalty_settings where restaurant_id = new.restaurant_id;
    if not found then
      insert into public.loyalty_settings (restaurant_id) values (new.restaurant_id)
      returning * into v_settings;
    end if;
    if not v_settings.enabled then return new; end if;

    -- Read customer aggregates (touch_customer_last_seen ran first)
    select orders_count, lifetime_spend into v_orders, v_spend
      from public.customers where id = new.customer_id;

    -- Earn = floor(total * points_per_sar)
    v_points := floor(new.total * v_settings.points_per_sar)::int;
    if v_points > 0 then
      insert into public.loyalty_transactions
        (restaurant_id, customer_id, order_id, kind, points, reason)
      values
        (new.restaurant_id, new.customer_id, new.id, 'earn', v_points,
         format('earn for order %s', new.id::text));

      update public.customers
         set loyalty_points_balance  = loyalty_points_balance  + v_points,
             loyalty_lifetime_points = loyalty_lifetime_points + v_points
       where id = new.customer_id;
    end if;

    -- Recompute tier (uses orders_count + lifetime_spend already updated)
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

-- Trigger name starts with 'z_' so it sorts AFTER orders_touch_customer
-- alphabetically. PostgreSQL fires AFTER INSERT triggers in name order.
drop trigger if exists z_loyalty_after_insert on public.orders;
create trigger z_loyalty_after_insert
  after insert on public.orders
  for each row execute function public.loyalty_after_order_insert();

-- --- 10. link_customer_account RPC ---------------------------------------
-- The customer account page calls this after Google sign-in to bind their
-- auth.users row to all existing customers rows that share their phone
-- (across tenants). Returns the number of tenants linked + any conflict
-- detail so the UI can show a meaningful message.
--
-- Hijack guard: refuses to link if ANY existing row with that phone has
-- a different auth_user_id already set. First-claim-wins. Soft check only —
-- when redemption lands we'll need real Unifonic OTP verification.
create or replace function public.link_customer_account(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_phone        text := trim(coalesce(p_phone, ''));
  v_linked_count int  := 0;
  v_conflict_count int := 0;
  v_existing_orders int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if v_phone = '' then
    return jsonb_build_object('ok', false, 'reason', 'phone_required');
  end if;

  -- Count rows already linked to a DIFFERENT user (hijack guard)
  select count(*) into v_conflict_count
    from public.customers
   where phone = v_phone
     and auth_user_id is not null
     and auth_user_id <> v_uid;
  if v_conflict_count > 0 then
    return jsonb_build_object('ok', false, 'reason', 'phone_already_linked');
  end if;

  -- Count orders the customer already placed under that phone (for the
  -- "وجدنا N طلبات" confirmation in the UI)
  select count(*) into v_existing_orders
    from public.orders o
    join public.customers c on c.id = o.customer_id
   where c.phone = v_phone;

  -- Link any unlinked rows for this phone across tenants
  update public.customers
     set auth_user_id = v_uid
   where phone = v_phone
     and auth_user_id is null;
  get diagnostics v_linked_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'linked_count', v_linked_count,
    'existing_orders', v_existing_orders
  );
end;
$$;

revoke all on function public.link_customer_account(text) from public;
grant execute on function public.link_customer_account(text) to authenticated;

commit;
