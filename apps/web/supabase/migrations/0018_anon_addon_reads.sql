-- ============================================================================
-- MenuLink · 0018_anon_addon_reads
--
-- Hotfix for a gap shipped in 0016 + 0017:
--   subscription_addons / addon_catalog / loyalty_settings were created with
--   policies scoped to `authenticated` only. But the customer-facing menu
--   (/m/[slug]) and account page (/m/[slug]/account) run as ANON for any
--   visitor who isn't signed in (which is most visitors).
--
--   Result: hasAddon() returned false for anon → ?table= soft-degrade
--   silently ignored, loyalty UI hidden, /m/[slug]/account 404'd because
--   its loyalty gate failed.
--
-- Fix: anon SELECT on the three addon/loyalty config tables. The data isn't
-- sensitive — addon state is operational truth that any visitor would
-- discover by trying the feature. Mutations stay locked to ops/owners.
-- ============================================================================

drop policy if exists anon_read_subscription_addons on public.subscription_addons;
create policy "anon_read_subscription_addons"
  on public.subscription_addons for select to anon
  using (true);

drop policy if exists anon_read_addon_catalog on public.addon_catalog;
create policy "anon_read_addon_catalog"
  on public.addon_catalog for select to anon
  using (true);

drop policy if exists anon_read_loyalty_settings on public.loyalty_settings;
create policy "anon_read_loyalty_settings"
  on public.loyalty_settings for select to anon
  using (true);
