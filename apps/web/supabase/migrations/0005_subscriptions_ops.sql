-- ============================================================================
-- MenuLink · 0005_subscriptions_ops
--
-- Platform-level concepts:
--   - platform_admins : the "ops" user(s) — sees and manages all tenants
--   - subscriptions   : one row per tenant restaurant; status drives whether
--                       the PWA is_published flag is allowed to be true
--   - payments        : log of received payments (manual collection for now)
--
-- Plus the triggers that write `role` and `restaurant_id` JWT claims into
-- raw_app_meta_data on auth.users, so the existing RLS policies (which read
-- auth.jwt() ->> 'restaurant_id' / 'role') work transparently after sign-in.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Platform admins (you, the ops operator)
-- ---------------------------------------------------------------------------

create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- Only ops can see ops list (mostly themselves)
create policy "ops_select_platform_admins"
  on public.platform_admins for select to authenticated
  using ((auth.jwt() ->> 'role') = 'platform_admin');

-- ---------------------------------------------------------------------------
-- 2. Subscriptions
--   New tenants default to status='pending_payment' (no-trial flow).
--   Ops logs a payment → status flips to 'active' + period_end set.
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  restaurant_id         uuid not null unique references public.restaurants(id) on delete cascade,
  plan                  text not null default 'yearly' check (plan in ('monthly','yearly')),
  status                text not null default 'pending_payment'
                        check (status in ('pending_payment','active','overdue','cancelled')),
  amount_sar            numeric(10,2) not null default 499.00,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  last_payment_at       timestamptz,
  cancelled_at          timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index subscriptions_status_idx on public.subscriptions(status);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- When subscription becomes 'overdue' or 'cancelled', auto-unpublish the
-- restaurant so the public PWA stops serving the menu.
create or replace function public.sync_restaurant_published_from_subscription()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('overdue','cancelled') then
    update public.restaurants
       set is_published = false, is_active = case when new.status = 'cancelled' then false else is_active end
     where id = new.restaurant_id;
  end if;
  return new;
end;
$$;

create trigger subscriptions_sync_published
  after insert or update of status on public.subscriptions
  for each row execute function public.sync_restaurant_published_from_subscription();

alter table public.subscriptions enable row level security;

create policy "ops_all_subscriptions"
  on public.subscriptions for all to authenticated
  using ((auth.jwt() ->> 'role') = 'platform_admin')
  with check ((auth.jwt() ->> 'role') = 'platform_admin');

create policy "owner_select_subscription"
  on public.subscriptions for select to authenticated
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));

-- ---------------------------------------------------------------------------
-- 3. Payments (manual collection, logged by ops)
-- ---------------------------------------------------------------------------

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  amount_sar      numeric(10,2) not null check (amount_sar > 0),
  method          text not null check (method in ('bank_transfer','mada','cash','card','manual')),
  reference       text,
  paid_at         timestamptz not null default now(),
  recorded_by     uuid references auth.users(id),
  notes           text,
  created_at      timestamptz not null default now()
);

create index payments_subscription_idx on public.payments(subscription_id, paid_at desc);

-- On payment insert, advance the subscription period and mark active.
create or replace function public.apply_payment_to_subscription()
returns trigger
language plpgsql
as $$
declare
  v_plan text;
  v_period interval;
  v_now timestamptz := now();
begin
  select plan into v_plan from public.subscriptions where id = new.subscription_id;
  v_period := case when v_plan = 'monthly' then interval '30 days' else interval '365 days' end;

  update public.subscriptions
     set status               = 'active',
         current_period_start = coalesce(
                                  case when current_period_end > v_now then current_period_end else null end,
                                  v_now
                                ),
         current_period_end   = coalesce(
                                  case when current_period_end > v_now then current_period_end else v_now end,
                                  v_now
                                ) + v_period,
         last_payment_at      = new.paid_at,
         cancelled_at         = null
   where id = new.subscription_id;

  -- Republish the restaurant if it was unpublished due to overdue/cancelled
  update public.restaurants r
     set is_published = true, is_active = true
   where r.id = (select restaurant_id from public.subscriptions where id = new.subscription_id);

  return new;
end;
$$;

create trigger payments_apply_to_subscription
  after insert on public.payments
  for each row execute function public.apply_payment_to_subscription();

alter table public.payments enable row level security;

create policy "ops_all_payments"
  on public.payments for all to authenticated
  using ((auth.jwt() ->> 'role') = 'platform_admin')
  with check ((auth.jwt() ->> 'role') = 'platform_admin');

create policy "owner_select_own_payments"
  on public.payments for select to authenticated
  using (exists (
    select 1 from public.subscriptions s
    where s.id = payments.subscription_id
      and s.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ));

-- ---------------------------------------------------------------------------
-- 4. JWT-claim triggers
--   Whenever platform_admins or restaurant_owners changes, we write the
--   appropriate role / restaurant_id claim into auth.users.raw_app_meta_data
--   so Supabase Auth includes it in JWTs on next sign-in.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_user_app_metadata(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_platform_admin boolean;
  v_restaurant_id     uuid;
  v_meta              jsonb;
begin
  select exists (select 1 from public.platform_admins where user_id = p_user_id)
    into v_is_platform_admin;

  -- Pick the first restaurant the user owns (most users will have exactly one)
  select restaurant_id into v_restaurant_id
    from public.restaurant_owners
   where user_id = p_user_id
   order by created_at
   limit 1;

  v_meta := coalesce(
    (select raw_app_meta_data from auth.users where id = p_user_id),
    '{}'::jsonb
  );

  -- Platform admin role wins over restaurant_owner if a user is both
  if v_is_platform_admin then
    v_meta := v_meta || jsonb_build_object('role', 'platform_admin');
    v_meta := v_meta - 'restaurant_id';
  elsif v_restaurant_id is not null then
    v_meta := v_meta || jsonb_build_object(
      'role', 'restaurant_owner',
      'restaurant_id', v_restaurant_id::text
    );
  else
    v_meta := v_meta - 'role' - 'restaurant_id';
  end if;

  update auth.users
     set raw_app_meta_data = v_meta
   where id = p_user_id;
end;
$$;

create or replace function public.refresh_app_metadata_on_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_user_app_metadata(old.user_id);
  else
    perform public.refresh_user_app_metadata(new.user_id);
  end if;
  return null;
end;
$$;

create trigger platform_admins_refresh_meta
  after insert or update or delete on public.platform_admins
  for each row execute function public.refresh_app_metadata_on_change();

create trigger restaurant_owners_refresh_meta
  after insert or update or delete on public.restaurant_owners
  for each row execute function public.refresh_app_metadata_on_change();

-- ---------------------------------------------------------------------------
-- 5. Seed: create a KO-KO subscription row (status pending_payment)
--   We don't insert a payment yet — that happens via /ops/payments once you
--   confirm the real owner has paid. For dev, this gives us a row to work with.
-- ---------------------------------------------------------------------------

insert into public.subscriptions (restaurant_id, plan, status, amount_sar, notes)
values (
  '11111111-1111-1111-1111-111111111111',
  'yearly',
  'pending_payment',
  499.00,
  'KO-KO subscription seed — awaiting first payment via /ops/payments'
)
on conflict (restaurant_id) do nothing;
