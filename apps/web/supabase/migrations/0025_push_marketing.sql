-- ============================================================================
-- MenuLink · 0025_push_marketing
--
-- Push marketing infrastructure:
--   1. Add restaurant_id to push_subscriptions (was only customer_id).
--   2. Anon INSERT policy so the PWA can subscribe without auth.
--   3. push_broadcasts table for send history.
--   4. Realtime publication for push_broadcasts (admin sees live stats).
-- ============================================================================

begin;

-- --- 1. push_subscriptions: add restaurant_id --------------------------------
alter table public.push_subscriptions
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete cascade;

create index if not exists push_subs_restaurant_idx
  on public.push_subscriptions(restaurant_id);

-- Backfill restaurant_id from the customer's restaurant
update public.push_subscriptions ps
   set restaurant_id = c.restaurant_id
  from public.customers c
 where ps.customer_id = c.id
   and ps.restaurant_id is null;

-- Make it NOT NULL after backfill
alter table public.push_subscriptions
  alter column restaurant_id set not null;

-- Anon can INSERT their own push subscription (from the PWA)
drop policy if exists rls_push_subs_anon_insert on public.push_subscriptions;
create policy rls_push_subs_anon_insert on public.push_subscriptions
  for insert to public
  with check (true);

-- --- 2. push_broadcasts table ------------------------------------------------
create table if not exists public.push_broadcasts (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(id) on delete cascade,
  title            text not null,
  body             text not null,
  url              text,
  segment_filter   jsonb not null default '[]'::jsonb,
  recipient_count  int not null default 0,
  delivered_count  int not null default 0,
  failed_count     int not null default 0,
  created_at       timestamptz not null default now(),
  sent_by          uuid references auth.users(id)
);

create index push_broadcasts_restaurant_idx
  on public.push_broadcasts(restaurant_id, created_at desc);

alter table public.push_broadcasts enable row level security;

create policy rls_push_broadcasts_owner_select on public.push_broadcasts
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy rls_push_broadcasts_owner_insert on public.push_broadcasts
  for insert to authenticated
  with check (public.owns_restaurant(restaurant_id));

create policy rls_push_broadcasts_ops_all on public.push_broadcasts
  for all to authenticated
  using (public.is_platform_admin());

commit;
