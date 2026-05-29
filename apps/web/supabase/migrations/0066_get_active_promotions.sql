-- ============================================================================
-- MenuLink · 0066_get_active_promotions
--
-- DS-6-1: return a slug's active promotions for the customer menu rail.
-- SECURITY DEFINER (route is anonymous; promotions is RLS ops/owner-only).
-- Additive; get_public_menu untouched.
-- ============================================================================

create or replace function public.get_active_promotions(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.priority desc, x.created_at desc), '[]'::jsonb)
  from (
    select pr.id, pr.title_ar, pr.subtitle_ar, pr.description_ar, pr.badge_text_ar,
           pr.image_url, pr.priority, pr.created_at
    from public.promotions pr
    join public.restaurants r on r.id = pr.restaurant_id
    where r.slug = p_slug and r.is_active and r.is_published
      and pr.is_active and pr.show_on_menu_home
      and (pr.starts_at is null or pr.starts_at <= now())
      and (pr.ends_at is null or pr.ends_at >= now())
  ) x;
$$;

grant execute on function public.get_active_promotions(text) to anon, authenticated;
