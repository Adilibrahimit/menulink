-- ============================================================================
-- MenuLink · 0067_get_export_fingerprint  (DS-7)
--
-- Export fingerprint for outdated-detection. md5 over the composed output of
-- the three public RPCs (menu + promotions + published design tokens). Any
-- change to menu/prices/images/promotions/design ⇒ new hash ⇒ a stored export
-- whose data_hash no longer matches is "outdated".
--
-- Additive: new SECURITY DEFINER function only. No table/RLS changes.
-- ============================================================================
create or replace function public.get_export_fingerprint(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5(
    coalesce(public.get_public_menu(p_slug)::text, '') ||
    coalesce(public.get_active_promotions(p_slug)::text, '') ||
    coalesce(public.get_published_design(p_slug)::text, '')
  );
$$;

grant execute on function public.get_export_fingerprint(text) to anon, authenticated;
