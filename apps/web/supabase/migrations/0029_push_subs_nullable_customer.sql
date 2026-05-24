-- ============================================================================
-- MenuLink · 0029_push_subs_nullable_customer
--
-- push_subscriptions.customer_id was NOT NULL since 0001, but the PWA sends
-- null for anonymous visitors (most users). Every subscribe call has been
-- silently failing. Two changes:
--   1. Make customer_id nullable.
--   2. Rewrite the owner SELECT policy to use restaurant_id (added in 0025)
--      instead of joining through customers — so anonymous subs are visible
--      to the tenant owner for broadcasts.
-- ============================================================================

begin;

-- 1. Drop the NOT NULL constraint on customer_id
alter table public.push_subscriptions
  alter column customer_id drop not null;

-- 2. Replace the owner SELECT policy to use restaurant_id directly
drop policy if exists "rls_push_subs_owner_select" on public.push_subscriptions;

create policy "rls_push_subs_owner_select" on public.push_subscriptions
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

commit;
