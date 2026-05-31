-- ============================================================================
-- MenuLink · 0070_poster_signature_overrides  (DS-12)
--
-- Lets ops hand-pick the signature poster's HERO dish and OFFER item, instead
-- of the poster's automatic price-rank curation (app/print/[slug]/poster).
--
-- Two nullable pointers on restaurants (mirrors menu_design_key, 0069):
--   NULL              -> automatic price-rank curation (today's behavior)
--   <menu_item id>    -> pin that item into the hero / offer slot
--
-- ON DELETE SET NULL: deleting a pinned item silently reverts that slot to
-- auto. The poster also re-validates the id against the live menu JSON (item
-- must still be active AND have a photo), so a stale/deactivated pin degrades
-- invisibly to price-rank — no broken poster.
--
-- Additive + nullable, no backfill: every existing tenant keeps auto curation.
-- Read path uses the existing public_read_published_restaurants RLS (0020) — the
-- print page reads these columns via the anon client, exactly like
-- menu_design_key. get_public_menu is intentionally NOT touched (the two ids are
-- menu_item ids, already public via that RPC). No cross-tenant CHECK: the ops
-- dropdown only lists this tenant's items, and the poster only matches ids
-- present in this tenant's menu, so a mismatched id falls back to auto.
-- ============================================================================

alter table public.restaurants
  add column if not exists poster_hero_item_id  uuid
    references public.menu_items(id) on delete set null,
  add column if not exists poster_offer_item_id uuid
    references public.menu_items(id) on delete set null;

comment on column public.restaurants.poster_hero_item_id is
  'DS-12: pinned hero (signature dish) for the print poster; NULL = auto price-rank. Re-validated against live menu (active + has photo) at render.';
comment on column public.restaurants.poster_offer_item_id is
  'DS-12: pinned offer item for the print poster; NULL = auto. Re-validated against live menu at render.';
