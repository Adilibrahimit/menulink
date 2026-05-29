-- ============================================================================
-- MenuLink · 0064_velora_layout_flags
--
-- DS-3B-2: turn on the Velora presentation flags for premium-lounge-grid-v1.
-- The clone's published profile already references this template, so the new
-- headerStyle/menuCardStyle flow through get_published_design -> resolveThemeLayout.
-- Additive single update; no schema change.
-- ============================================================================

update public.menu_page_templates set default_config_json =
  '{"categoryStyle":"pills","headerStyle":"velora-hero","cartBarStyle":"gold-navy","hasItemDetailSheet":true,"menuCardStyle":"premium-lounge"}'::jsonb
where key = 'premium-lounge-grid-v1';
