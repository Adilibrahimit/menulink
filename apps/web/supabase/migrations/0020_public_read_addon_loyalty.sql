-- ============================================================================
-- MenuLink · 0020_public_read_addon_loyalty
--
-- Third hotfix in the customer-account thread. 0018 and 0019 added anon
-- SELECT policies on the addon + loyalty config tables. But Postgres RLS
-- treats `to anon` and `to authenticated` as distinct policy targets —
-- once a customer signs in with Google their session uses the authenticated
-- role, which only matches owner/ops policies. Result: signed-in customers
-- couldn't read the very rows the OAuth callback needs them to read, so
-- the post-login redirect to /m/<slug>/account 404'd.
--
-- Fix: change `to anon` → `to public` on the four affected policies. The
-- `public` pseudo-role matches BOTH anon and authenticated, so a customer
-- whether signed in or not gets identical read access to these
-- configuration tables. Mutations remain owner/ops-only.
-- ============================================================================

-- restaurants — published + active rows are public regardless of role
drop policy if exists anon_read_published_restaurants on public.restaurants;
drop policy if exists public_read_published_restaurants on public.restaurants;
create policy "public_read_published_restaurants"
  on public.restaurants for select to public
  using (is_active = true and is_published = true);

-- subscription_addons — feature flag state, not sensitive
drop policy if exists anon_read_subscription_addons on public.subscription_addons;
drop policy if exists public_read_subscription_addons on public.subscription_addons;
create policy "public_read_subscription_addons"
  on public.subscription_addons for select to public
  using (true);

-- addon_catalog — the master list, always public
drop policy if exists anon_read_addon_catalog on public.addon_catalog;
drop policy if exists public_read_addon_catalog on public.addon_catalog;
create policy "public_read_addon_catalog"
  on public.addon_catalog for select to public
  using (true);

-- loyalty_settings — earn rates + tier thresholds drive the customer
-- preview; not sensitive
drop policy if exists anon_read_loyalty_settings on public.loyalty_settings;
drop policy if exists public_read_loyalty_settings on public.loyalty_settings;
create policy "public_read_loyalty_settings"
  on public.loyalty_settings for select to public
  using (true);
