-- 0031: Per-item modifiers_json column
-- Moves modifier configuration from hardcoded TypeScript to the database,
-- editable by restaurant owners from /admin/menu.

-- 1. Add column
alter table public.menu_items
  add column if not exists modifiers_json jsonb default null;

comment on column public.menu_items.modifiers_json is
  'Per-item modifier config: {groups: [{key, label, type, required, max, defaultOption?, options: [{label, priceDelta}]}], notesEnabled, notesMaxLength, notesPlaceholder}';

-- 2. Rewrite get_public_menu to include modifiers_json
create or replace function public.get_public_menu(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant jsonb;
  v_categories jsonb;
begin
  select to_jsonb(r) - 'owner_user_id'
    into v_restaurant
  from (
    select
      r.id, r.slug, r.name, r.whatsapp_phone, r.currency, r.timezone,
      r.address_ar, r.city, r.lat, r.lng,
      r.contact_email, r.instagram_handle, r.tiktok_handle,
      r.hours_json, r.logo_url, r.cover_image_url, r.tagline_ar,
      r.primary_color, r.background_color
    from public.restaurants r
    where r.slug = p_slug
      and r.is_active
      and r.is_published
  ) r;

  if v_restaurant is null then
    return null;
  end if;

  select coalesce(jsonb_agg(cat order by (cat ->> 'sort')::int), '[]'::jsonb)
    into v_categories
  from (
    select jsonb_build_object(
      'id',         c.id,
      'slug',       c.slug,
      'name_ar',    c.name_ar,
      'emoji',      c.emoji,
      'info_ar',    c.info_ar,
      'sort',       c.sort,
      'items', (
        select coalesce(jsonb_agg(it order by (it ->> 'sort')::int), '[]'::jsonb)
        from (
          select jsonb_build_object(
            'id',             mi.id,
            'slug',           mi.slug,
            'name_ar',        mi.name_ar,
            'description_ar', mi.description_ar,
            'image_url',      mi.image_url,
            'sort',           mi.sort,
            'is_chicken',     mi.is_chicken,
            'badges',         mi.badges_json,
            'calories_kcal',  mi.calories_kcal,
            'sodium_mg',      mi.sodium_mg,
            'caffeine_mg',    mi.caffeine_mg,
            'allergens',      mi.allergens_json,
            'modifiers',      mi.modifiers_json,
            'variants', (
              select coalesce(jsonb_agg(v order by (v ->> 'sort')::int), '[]'::jsonb)
              from (
                select jsonb_build_object(
                  'key',          mv.variant_key,
                  'label',        mv.variant_label_ar,
                  'price',        mv.price,
                  'sort',         mv.sort,
                  'calories_kcal', mv.calories_kcal
                ) as v
                from public.menu_item_variants mv
                where mv.menu_item_id = mi.id and mv.is_active
              ) sv
            )
          ) as it
          from public.menu_items mi
          where mi.category_id = c.id and mi.is_active
        ) si
      )
    ) as cat
    from public.menu_categories c
    where c.restaurant_id = (v_restaurant ->> 'id')::uuid
      and c.is_active
  ) sc;

  return jsonb_build_object(
    'restaurant', v_restaurant,
    'categories', v_categories
  );
end;
$$;
