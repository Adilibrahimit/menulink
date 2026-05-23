-- ============================================================================
-- MenuLink · 0019_anon_read_published_restaurants
--
-- Second hotfix following the customer-facing surfaces opening up. The
-- `restaurants` table had only authenticated-scoped policies, but the
-- get_public_menu() SECURITY DEFINER RPC was hiding that gap: the menu
-- page used the RPC to get a denormalized restaurant + categories + items
-- payload. The new /m/[slug]/account page only needs the restaurant
-- header (id, name, colors, logo) and tried a direct .from("restaurants")
-- read — which RLS blocked for anon → server-side notFound() → 404.
--
-- Fix: anon SELECT on active + published restaurants. These are already
-- public via the RPC; this just lets pages fetch the header columns
-- without dragging the entire menu.
-- ============================================================================

drop policy if exists anon_read_published_restaurants on public.restaurants;
create policy "anon_read_published_restaurants"
  on public.restaurants for select to anon
  using (is_active = true and is_published = true);
