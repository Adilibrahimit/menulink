-- ============================================================================
-- MenuLink · 0046_rzrz_test_clone
--
-- Phase LAB-1: Create /m/rzrz-bukhari-test — isolated test clone of RzRz.
--
-- Creates a separate restaurant tenant with:
--   - Cloned menu (categories, items, variants) from live RzRz
--   - Dummy WhatsApp number (test orders never reach real restaurant)
--   - Same owner (can manage both from one login)
--   - All addons EXCEPT pos_bridge (POS sync disabled by default)
--   - TEST badge in name and tagline
--   - Reuses image URLs by reference (no asset duplication)
--
-- Safety: does NOT modify KO-KO, live RzRz, or any other tenant.
-- ============================================================================

do $$
declare
  v_src_rid   uuid := 'ef60381c-50db-4379-a9b7-97f5902aa54b';
  v_test_rid  uuid := gen_random_uuid();
  v_owner_uid uuid;
  v_cat_map   jsonb := '{}';
  v_old_cat   uuid;
  v_new_cat   uuid;
  v_item_map  jsonb := '{}';
  v_old_item  uuid;
  v_new_item  uuid;
  v_r         record;
begin
  -- Abort if test tenant already exists
  if exists (select 1 from restaurants where slug = 'rzrz-bukhari-test') then
    raise notice 'rzrz-bukhari-test already exists, skipping';
    return;
  end if;

  -- Get owner user_id
  select user_id into v_owner_uid
    from restaurant_owners
   where restaurant_id = v_src_rid
   limit 1;

  -- 1. Create restaurant
  insert into restaurants (
    id, slug, name, whatsapp_phone, city, timezone,
    primary_color, background_color, logo_url, cover_image_url,
    tagline_ar, is_active, is_published, plan
  )
  select
    v_test_rid,
    'rzrz-bukhari-test',
    'RzRz Bukhari TEST',
    '966500000000',
    city, timezone,
    primary_color, background_color, logo_url, cover_image_url,
    '⚠️ نسخة تجريبية — الطلبات لا تُرسل للمطعم',
    true, true, plan
  from restaurants where id = v_src_rid;

  -- 2. Link owner
  insert into restaurant_owners (user_id, restaurant_id, role)
  values (v_owner_uid, v_test_rid, 'owner');

  -- 3. Link admin
  insert into restaurant_admins (user_id, restaurant_id, role)
  values (v_owner_uid, v_test_rid, 'owner')
  on conflict (user_id, restaurant_id) do nothing;

  -- 4. Subscription (active, test)
  insert into subscriptions (restaurant_id, plan, status, amount_sar)
  values (v_test_rid, 'yearly', 'active', 0);

  -- 5. Default branch
  insert into restaurant_branches (
    restaurant_id, name_ar, name_en, slug, whatsapp,
    supports_delivery, supports_pickup, supports_dine_in, supports_car,
    is_default
  ) values (
    v_test_rid, 'الفرع الرئيسي', 'Main Branch', 'main', '966500000000',
    true, true, true, true, true
  );

  -- 6. Clone menu categories (with ID mapping)
  for v_r in
    select id, slug, name_ar, name_en, emoji, info_ar, sort
      from menu_categories
     where restaurant_id = v_src_rid
     order by sort
  loop
    v_new_cat := gen_random_uuid();
    insert into menu_categories (id, restaurant_id, slug, name_ar, name_en, emoji, info_ar, sort)
    values (v_new_cat, v_test_rid, v_r.slug, v_r.name_ar, v_r.name_en, v_r.emoji, v_r.info_ar, v_r.sort);
    v_cat_map := v_cat_map || jsonb_build_object(v_r.id::text, v_new_cat::text);
  end loop;

  -- 7. Clone menu items (with ID mapping)
  for v_r in
    select id, category_id, slug, name_ar, name_en, description_ar, description_en,
           image_url, sort, is_active, calories_kcal, sodium_mg, caffeine_mg,
           allergens_json, modifiers_json
      from menu_items
     where restaurant_id = v_src_rid
     order by sort
  loop
    v_new_item := gen_random_uuid();
    v_new_cat := (v_cat_map ->> v_r.category_id::text)::uuid;
    insert into menu_items (
      id, restaurant_id, category_id, slug, name_ar, name_en,
      description_ar, description_en, image_url, sort, is_active,
      calories_kcal, sodium_mg, caffeine_mg, allergens_json, modifiers_json
    ) values (
      v_new_item, v_test_rid, v_new_cat, v_r.slug, v_r.name_ar, v_r.name_en,
      v_r.description_ar, v_r.description_en, v_r.image_url, v_r.sort, v_r.is_active,
      v_r.calories_kcal, v_r.sodium_mg, v_r.caffeine_mg, v_r.allergens_json, v_r.modifiers_json
    );
    v_item_map := v_item_map || jsonb_build_object(v_r.id::text, v_new_item::text);
  end loop;

  -- 8. Clone menu item variants
  for v_r in
    select miv.menu_item_id, miv.variant_key, miv.variant_label_ar, miv.price,
           miv.sort, miv.is_active, miv.calories_kcal
      from menu_item_variants miv
      join menu_items mi on mi.id = miv.menu_item_id
     where mi.restaurant_id = v_src_rid
  loop
    v_new_item := (v_item_map ->> v_r.menu_item_id::text)::uuid;
    if v_new_item is not null then
      insert into menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort, is_active, calories_kcal)
      values (v_new_item, v_r.variant_key, v_r.variant_label_ar, v_r.price, v_r.sort, v_r.is_active, v_r.calories_kcal);
    end if;
  end loop;

  -- 9. Addons — all from live RzRz EXCEPT pos_bridge
  insert into subscription_addons (restaurant_id, addon_key, enabled, notes)
  select v_test_rid, addon_key, true, 'cloned from rzrz-bukhari for testing'
    from subscription_addons
   where restaurant_id = v_src_rid
     and enabled = true
     and addon_key != 'pos_bridge'
  on conflict (restaurant_id, addon_key) do nothing;

  -- 10. Seed default cancellation reasons
  insert into order_reasons (restaurant_id, actor_type, reason_ar, reason_en, sort_order)
  values
    (v_test_rid, 'customer',   'غيّرت رأيي',       'Changed my mind',       1),
    (v_test_rid, 'customer',   'وقت الانتظار طويل', 'Wait time too long',    2),
    (v_test_rid, 'customer',   'طلبت بالخطأ',      'Ordered by mistake',    3),
    (v_test_rid, 'restaurant', 'الصنف غير متوفر',  'Item unavailable',      4),
    (v_test_rid, 'restaurant', 'المطعم مغلق',      'Restaurant closed',     5),
    (v_test_rid, 'restaurant', 'مشكلة في الطلب',   'Problem with order',    6);

  raise notice 'Created rzrz-bukhari-test with id: %', v_test_rid;
end;
$$;
