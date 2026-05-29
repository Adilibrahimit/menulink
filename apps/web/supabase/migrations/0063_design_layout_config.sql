-- ============================================================================
-- MenuLink · 0063_design_layout_config
--
-- DS-3B-1: extend get_published_design to also return the assigned menu-page-
-- template's layout config (menu_layout_config), and seed existing-flag configs
-- for the page templates. Additive; get_public_menu untouched; no schema change.
-- ============================================================================

create or replace function public.get_published_design(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'template_key',       bt.key,
    'template_name',      bt.name_ar,
    'template_tokens',    coalesce(bt.default_tokens_json, '{}'::jsonb),
    'profile_tokens',     coalesce(p.brand_tokens_json, '{}'::jsonb),
    'menu_page_key',      mt.key,
    'menu_layout_config', coalesce(mt.default_config_json, '{}'::jsonb)
  )
  from public.restaurants r
  join public.restaurant_design_profiles p
    on p.restaurant_id = r.id and p.status = 'published'
  left join public.brand_identity_templates bt on bt.id = p.brand_template_id
  left join public.menu_page_templates     mt on mt.id = p.menu_page_template_id
  where r.slug = p_slug and r.is_active and r.is_published
  limit 1;
$$;

grant execute on function public.get_published_design(text) to anon, authenticated;

update public.menu_page_templates set default_config_json =
  '{"categoryStyle":"pills","headerStyle":"dark-navy","cartBarStyle":"gold-navy","hasItemDetailSheet":true}'::jsonb
where key = 'premium-lounge-grid-v1';

update public.menu_page_templates set default_config_json =
  '{"categoryStyle":"tabs","headerStyle":"brand-filled","cartBarStyle":"brand-default","hasItemDetailSheet":false}'::jsonb
where key = 'fast-food-grid-v1';
