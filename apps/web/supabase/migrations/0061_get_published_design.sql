-- ============================================================================
-- MenuLink · 0061_get_published_design
--
-- DS-3 support. Additive: one SECURITY DEFINER, anon-callable function that
-- returns the published design profile's tokens for a slug (or null). Lets the
-- public customer page read design data without a public RLS policy on
-- restaurant_design_profiles. No table changes; get_public_menu untouched.
-- ============================================================================

create or replace function public.get_published_design(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'template_key',    bt.key,
    'template_name',   bt.name_ar,
    'template_tokens', coalesce(bt.default_tokens_json, '{}'::jsonb),
    'profile_tokens',  coalesce(p.brand_tokens_json, '{}'::jsonb)
  )
  from public.restaurants r
  join public.restaurant_design_profiles p
    on p.restaurant_id = r.id and p.status = 'published'
  left join public.brand_identity_templates bt
    on bt.id = p.brand_template_id
  where r.slug = p_slug
    and r.is_active
    and r.is_published
  limit 1;
$$;

grant execute on function public.get_published_design(text) to anon, authenticated;
