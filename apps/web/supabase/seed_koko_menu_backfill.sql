-- ============================================================================
-- MenuLink · seed_koko_menu_backfill
--
-- One-time backfill of KO-KO's menu from the v6 HTML (the live, customer-
-- facing menu) into menu_categories / menu_items / menu_item_variants.
--
-- Idempotent: uses ON CONFLICT (restaurant_id, slug) DO NOTHING, so re-running
-- is safe. Also flips restaurants.is_published = true once data is in.
-- ============================================================================

do $$
declare
  v_rest_id constant uuid := '11111111-1111-1111-1111-111111111111';

  -- Variant label helpers (matches the v6 PWA's variantLabel() function)
  v_piece_chicken  constant text := '٤ قطع';
  v_meal_chicken   constant text := 'وجبة (٤ قطع)';
  v_piece_burger   constant text := 'قطعة';
  v_meal_burger    constant text := 'وجبة';

  c_broasted uuid; c_tender uuid; c_burger uuid; c_sandwich uuid;
  c_sides    uuid; c_sauces uuid; c_drinks uuid;

  it uuid;  -- reused for each item insert
begin
  -- ----- Categories -----
  insert into public.menu_categories (restaurant_id, slug, name_ar, emoji, info_ar, sort) values
    (v_rest_id, 'cat-broasted', 'بروستد',          '🍗', '⭐ أي قطعة إضافية بـ ٤ ريال', 1),
    (v_rest_id, 'cat-tender',   'تندر',            '🍖', '⭐ أي قطعة إضافية بـ ٤ ريال', 2),
    (v_rest_id, 'cat-burger',   'برجر',            '🍔', null, 3),
    (v_rest_id, 'cat-sandwich', 'ساندويش',         '🌯', null, 4),
    (v_rest_id, 'cat-sides',    'أصناف جانبية',     '🍟', null, 5),
    (v_rest_id, 'cat-sauces',   'صوصات',           '🥫', null, 6),
    (v_rest_id, 'cat-drinks',   'المشروبات',       '🥤', null, 7)
  on conflict (restaurant_id, slug) do nothing;

  select id into c_broasted from public.menu_categories where restaurant_id = v_rest_id and slug = 'cat-broasted';
  select id into c_tender   from public.menu_categories where restaurant_id = v_rest_id and slug = 'cat-tender';
  select id into c_burger   from public.menu_categories where restaurant_id = v_rest_id and slug = 'cat-burger';
  select id into c_sandwich from public.menu_categories where restaurant_id = v_rest_id and slug = 'cat-sandwich';
  select id into c_sides    from public.menu_categories where restaurant_id = v_rest_id and slug = 'cat-sides';
  select id into c_sauces   from public.menu_categories where restaurant_id = v_rest_id and slug = 'cat-sauces';
  select id into c_drinks   from public.menu_categories where restaurant_id = v_rest_id and slug = 'cat-drinks';

  -- ---------------------------------------------------------------------
  -- Broasted (chicken)
  -- ---------------------------------------------------------------------
  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken)
       values (v_rest_id, c_broasted, 'br-reg', 'بروستد عادي', 1, true)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='br-reg'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_chicken, 20.00, 1),
    (it, 'meal',  v_meal_chicken,  24.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_broasted, 'br-hot', 'بروستد حار', 2, true,
               '[{"type":"hot","label":"حار","emoji":"🌶️"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='br-hot'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_chicken, 20.00, 1),
    (it, 'meal',  v_meal_chicken,  24.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_broasted, 'br-jal', 'بروستد لهاليبو', 3, true,
               '[{"type":"premium","label":"مميز","emoji":"✨"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='br-jal'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_chicken, 22.00, 1),
    (it, 'meal',  v_meal_chicken,  26.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_broasted, 'br-nash', 'بروستد ناشفل', 4, true,
               '[{"type":"premium","label":"مميز","emoji":"✨"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='br-nash'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_chicken, 24.00, 1),
    (it, 'meal',  v_meal_chicken,  28.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  -- ---------------------------------------------------------------------
  -- Tender (chicken)
  -- ---------------------------------------------------------------------
  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken)
       values (v_rest_id, c_tender, 'tn-reg', 'تندر عادي', 1, true)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='tn-reg'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_chicken, 20.00, 1), (it, 'meal', v_meal_chicken, 24.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_tender, 'tn-hot', 'تندر حار', 2, true,
               '[{"type":"hot","label":"حار","emoji":"🌶️"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='tn-hot'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_chicken, 20.00, 1), (it, 'meal', v_meal_chicken, 24.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_tender, 'tn-jal', 'تندر لهاليبو', 3, true,
               '[{"type":"premium","label":"مميز","emoji":"✨"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='tn-jal'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_chicken, 22.00, 1), (it, 'meal', v_meal_chicken, 26.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_tender, 'tn-nash', 'تندر ناشفل', 4, true,
               '[{"type":"premium","label":"مميز","emoji":"✨"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='tn-nash'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_chicken, 24.00, 1), (it, 'meal', v_meal_chicken, 28.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  -- ---------------------------------------------------------------------
  -- Burger (not chicken)
  -- ---------------------------------------------------------------------
  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, description_ar, sort, is_chicken)
       values (v_rest_id, c_burger, 'bg-crispy', 'كرسبي برجر', 'عادي · حار', 1, false)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='bg-crispy'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_burger, 17.00, 1), (it, 'meal', v_meal_burger, 25.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_burger, 'bg-maple', 'ميبل برجر', 2, false,
               '[{"type":"premium","label":"مميز","emoji":"✨"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='bg-maple'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_burger, 20.00, 1), (it, 'meal', v_meal_burger, 28.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_burger, 'bg-nash', 'ناشفل برجر', 3, false,
               '[{"type":"premium","label":"مميز","emoji":"✨"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='bg-nash'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_burger, 20.00, 1), (it, 'meal', v_meal_burger, 28.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  -- ---------------------------------------------------------------------
  -- Twister / Sandwich (not chicken)
  -- ---------------------------------------------------------------------
  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken)
       values (v_rest_id, c_sandwich, 'tw-reg', 'تويستر', 1, false)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='tw-reg'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_burger, 15.00, 1), (it, 'meal', v_meal_burger, 23.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_sandwich, 'tw-hot', 'تويستر حار', 2, false,
               '[{"type":"hot","label":"حار","emoji":"🌶️"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='tw-hot'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_burger, 15.00, 1), (it, 'meal', v_meal_burger, 23.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, sort, is_chicken, badges_json)
       values (v_rest_id, c_sandwich, 'tw-maple', 'تويستر ميبل', 3, false,
               '[{"type":"premium","label":"مميز","emoji":"✨"}]'::jsonb)
  on conflict (restaurant_id, slug) do nothing returning id into it;
  if it is null then select id into it from public.menu_items where restaurant_id=v_rest_id and slug='tw-maple'; end if;
  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort) values
    (it, 'piece', v_piece_burger, 18.00, 1), (it, 'meal', v_meal_burger, 26.00, 2)
  on conflict (menu_item_id, variant_key) do nothing;

  -- ---------------------------------------------------------------------
  -- Sides (single variants)
  -- ---------------------------------------------------------------------
  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, description_ar, sort, is_chicken) values
    (v_rest_id, c_sides, 'sd-cf',    'تشيكن فرايز',  null,                 1, false),
    (v_rest_id, c_sides, 'sd-chf',   'تشيز فرايز',    null,                 2, false),
    (v_rest_id, c_sides, 'sd-fries', 'فرايز',         null,                 3, false),
    (v_rest_id, c_sides, 'sd-cb',    'تشيكن بايتس',   'بافلو · سويت · عادي', 4, false),
    (v_rest_id, c_sides, 'sd-slaw',  'سلطة ملفوف',    null,                 5, false)
  on conflict (restaurant_id, slug) do nothing;

  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort)
  select mi.id, 'single', '', p.price, 1
  from (values
    ('sd-cf', 17.00::numeric),
    ('sd-chf', 12.00),
    ('sd-fries', 7.00),
    ('sd-cb', 12.00),
    ('sd-slaw', 4.00)
  ) as p(slug, price)
  join public.menu_items mi on mi.restaurant_id = v_rest_id and mi.slug = p.slug
  on conflict (menu_item_id, variant_key) do nothing;

  -- ---------------------------------------------------------------------
  -- Sauces (single variants)
  -- ---------------------------------------------------------------------
  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, description_ar, sort, is_chicken) values
    (v_rest_id, c_sauces, 'sc-koko',   'كوكو صوص',    null,         1, false),
    (v_rest_id, c_sauces, 'sc-ched',   'شيدر صوص',    null,         2, false),
    (v_rest_id, c_sauces, 'sc-spec',   'سبيشل صوص',   null,         3, false),
    (v_rest_id, c_sauces, 'sc-bbq',    'باربكيو صوص', null,         4, false),
    (v_rest_id, c_sauces, 'sc-ranch',  'رانش صوص',    null,         5, false),
    (v_rest_id, c_sauces, 'sc-jal',    'لهاليبو صوص', null,         6, false),
    (v_rest_id, c_sauces, 'sc-garlic', 'صوص ثوم',     null,         7, false),
    (v_rest_id, c_sauces, 'sc-hummus', 'حمص',         'علبة وسط',   8, false)
  on conflict (restaurant_id, slug) do nothing;

  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort)
  select mi.id, 'single', '', p.price, 1
  from (values
    ('sc-koko', 3.00::numeric),
    ('sc-ched', 3.00),
    ('sc-spec', 2.00),
    ('sc-bbq', 2.00),
    ('sc-ranch', 2.00),
    ('sc-jal', 2.00),
    ('sc-garlic', 2.00),
    ('sc-hummus', 4.00)
  ) as p(slug, price)
  join public.menu_items mi on mi.restaurant_id = v_rest_id and mi.slug = p.slug
  on conflict (menu_item_id, variant_key) do nothing;

  -- ---------------------------------------------------------------------
  -- Drinks (single variants)
  -- ---------------------------------------------------------------------
  insert into public.menu_items (restaurant_id, category_id, slug, name_ar, description_ar, sort, is_chicken) values
    (v_rest_id, c_drinks, 'dr-cola-s', 'كولا',         'صغير', 1, false),
    (v_rest_id, c_drinks, 'dr-cola-l', 'كولا',         'كبير', 2, false),
    (v_rest_id, c_drinks, 'dr-oj-s',   'عصير برتقال',  'صغير', 3, false),
    (v_rest_id, c_drinks, 'dr-oj-l',   'عصير برتقال',  'كبير', 4, false),
    (v_rest_id, c_drinks, 'dr-water',  'ماء',          null,   5, false)
  on conflict (restaurant_id, slug) do nothing;

  insert into public.menu_item_variants (menu_item_id, variant_key, variant_label_ar, price, sort)
  select mi.id, 'single', '', p.price, 1
  from (values
    ('dr-cola-s', 4.00::numeric),
    ('dr-cola-l', 6.00),
    ('dr-oj-s', 6.00),
    ('dr-oj-l', 10.00),
    ('dr-water', 1.00)
  ) as p(slug, price)
  join public.menu_items mi on mi.restaurant_id = v_rest_id and mi.slug = p.slug
  on conflict (menu_item_id, variant_key) do nothing;

  -- ---------------------------------------------------------------------
  -- Restaurant info backfill: tagline, address, brand colors. Publish.
  -- ---------------------------------------------------------------------
  update public.restaurants
     set tagline_ar       = coalesce(tagline_ar, 'طعم ما تقدر تقاومه! 🔥'),
         address_ar       = coalesce(address_ar, 'الرياض - حي الروضة، طريق عبد الرحمن الغافقي'),
         city             = coalesce(city, 'الرياض'),
         primary_color    = coalesce(primary_color, '#D32027'),
         background_color = coalesce(background_color, '#FAF6EE'),
         is_published     = true
   where id = v_rest_id;

  raise notice 'KO-KO menu backfill complete';
end $$;
