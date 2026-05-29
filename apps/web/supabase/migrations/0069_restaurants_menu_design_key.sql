-- 0069_restaurants_menu_design_key.sql
-- Design library: let any restaurant pick a ready-made full-page menu design
-- (decoupled from slug). Nullable + additive: NULL keeps today's per-slug
-- behavior (getTheme(slug)), so every existing tenant renders unchanged.
-- When set, the customer page (app/m/[slug]/page.tsx) resolves the key against
-- the in-code registry (lib/design-library.ts) and applies that design's theme
-- + tokens + fonts. No backfill. Read path uses the existing
-- anon_read_published_restaurants RLS policy (0019); get_public_menu untouched.

alter table public.restaurants
  add column if not exists menu_design_key text;
