-- ============================================================================
-- MenuLink · 0074_mazaj_almosafer_rawdah_tenant
--
-- New tenant: Mazaj Almosafer — Al-Rawdah branch (مزاج المسافر - الروضة)
-- 2nd branch of the existing Mazaj Almosafer deal, onboarded as a SEPARATE page
-- (its own slug/restaurants row), NOT a sub-branch. Riyadh coffee/dessert/shisha
-- lounge — 135 items across 11 categories, area-specific prices.
-- Display-only mode (menu viewing via QR, no ordering). Same visual design as
-- branch 1 (lib/themes.ts → MAZAJ_ALMOSAFER_RAWDAH_THEME, menuLayout "heritage-list",
-- emerald + cream + gold), but BILINGUAL (English shown under Arabic).
-- Data cleaned from C:\Users\USER\Downloads\mazaj-almosafer-alroudah-branch.xlsx
-- (Baladi POS Item Report): kashida stripped, 2 placeholder "-" rows dropped.
-- The POS lists the same 18 shisha flavors at two price tiers (34 / 39 SAR) →
-- modeled as two categories: 'شيشة ٣٤ ريال' (shisha-34) and 'شيشة ٣٩ ريال' (shisha-39).
-- WhatsApp reuses branch 1's number. No calories (matches branch 1).
-- ============================================================================

DO $$
DECLARE
  v_rid uuid;
  v_cat_map jsonb := '{}';
  v_cat_id uuid;
  v_item_id uuid;
  v_item jsonb;
  v_sort int;
  v_price numeric;
  v_cat_name text;
  v_items jsonb;
BEGIN
  -- Guard: skip if already exists
  IF EXISTS (SELECT 1 FROM public.restaurants WHERE slug = 'mazaj-almosafer-rawdah') THEN
    RAISE NOTICE 'mazaj-almosafer-rawdah already exists, skipping';
    RETURN;
  END IF;

  -- 1) Restaurant (menu-only / display-only; whatsapp reuses branch 1; no lat/lng/maps)
  INSERT INTO public.restaurants (
    id, slug, name, whatsapp_phone, city, address_ar,
    primary_color, background_color, tagline_ar, instagram_handle,
    display_only_mode, is_active, is_published, plan, currency, timezone
  ) VALUES (
    gen_random_uuid(), 'mazaj-almosafer-rawdah', 'مزاج المسافر - الروضة', '966553547666',
    'الرياض', '2136 وادي حلفا، الأندلس، الرياض 13212',
    '#0F2D26', '#F4E8D4', 'قهوة · حلى · شيشة', 'almusaferlounge',
    true, true, false, 'yearly', 'SAR', 'Asia/Riyadh'
  ) RETURNING id INTO v_rid;

  -- 2) Categories (11)
  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'hot-drinks', 'المشروبات الساخنة', 'Hot Drinks', 0, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('المشروبات الساخنة', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'cold-drinks', 'المشروبات الباردة', 'Cold Drinks', 1, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('المشروبات الباردة', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'juices', 'العصائر', 'Juices', 2, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('العصائر', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'drinks', 'المشروبات', 'Drinks', 3, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('المشروبات', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'mojito-7up', 'موهيتو سفن اب', 'Mojito 7UP', 4, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('موهيتو سفن اب', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'mojito-code-red', 'موهيتو كود رد', 'Mojito Code Red', 5, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('موهيتو كود رد', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'mojito-red-bull', 'موهيتو رد بول', 'Mojito Red Bull', 6, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('موهيتو رد بول', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'sandwich', 'ساندويش', 'Sandwich', 7, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('ساندويش', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'dessert', 'حلى', 'Dessert', 8, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('حلى', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'shisha-34', 'شيشة ٣٤ ريال', 'Shisha 34 SAR', 9, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('شيشة ٣٤ ريال', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'shisha-39', 'شيشة ٣٩ ريال', 'Shisha 39 SAR', 10, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('شيشة ٣٩ ريال', v_cat_id::text);

  -- 3) Items + variants from JSON (135 items; all single-price; no calories)
  v_items := '[{"price":13,"cat":"المشروبات الساخنة","name_ar":"امريكانو","name_en":"Americano","slug":"americano"},{"price":18,"cat":"المشروبات الساخنة","name_ar":"كابتشينو","name_en":"Cappuccino","slug":"cappuccino"},{"price":18,"cat":"المشروبات الساخنة","name_ar":"كيمكس","name_en":"Chemex","slug":"chemex"},{"price":10,"cat":"المشروبات الساخنة","name_ar":"قهوة اليوم","name_en":"Coffee Day","slug":"coffee-day"},{"price":15,"cat":"المشروبات الساخنة","name_ar":"كورتادو","name_en":"Cortado","slug":"cortado"},{"price":12,"cat":"المشروبات الساخنة","name_ar":"اسبريسو دبل","name_en":"Espresso Double","slug":"espresso-double"},{"price":10,"cat":"المشروبات الساخنة","name_ar":"اسبريسو سنقل","name_en":"Espresso Single","slug":"espresso-single"},{"price":16,"cat":"المشروبات الساخنة","name_ar":"فلات وايت","name_en":"Flat White","slug":"flat-white"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"زنجبيل","name_en":"Ginger Tea","slug":"ginger-tea"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"شاي اخضر","name_en":"Green Tea","slug":"green-tea"},{"price":18,"cat":"المشروبات الساخنة","name_ar":"هوت شوكليت","name_en":"Hot Chocolate","slug":"hot-chocolate"},{"price":16,"cat":"المشروبات الساخنة","name_ar":"لاتيه","name_en":"Latte","slug":"latte"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"شاي نعناع","name_en":"Mint Tea","slug":"mint-tea"},{"price":18,"cat":"المشروبات الساخنة","name_ar":"بستاثيو","name_en":"Pestachio","slug":"pestachio"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"شاي احمر","name_en":"Red Tea","slug":"red-tea"},{"price":18,"cat":"المشروبات الساخنة","name_ar":"سبانيش لاتيه","name_en":"Spanish Latte","slug":"spanish-latte"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"طائفي","name_en":"Taifi","slug":"taifi"},{"price":20,"cat":"المشروبات الساخنة","name_ar":"براد شاي اخضر","name_en":"Tea Pot Green","slug":"tea-pot-green"},{"price":20,"cat":"المشروبات الساخنة","name_ar":"براد شاي احمر","name_en":"Tea Pot Red","slug":"tea-pot-red"},{"price":10,"cat":"المشروبات الساخنة","name_ar":"قهوه تركي","name_en":"Turkish Coffee","slug":"turkish-coffee"},{"price":16,"cat":"المشروبات الساخنة","name_ar":"في ٦٠","name_en":"V60","slug":"v60"},{"price":18,"cat":"المشروبات الساخنة","name_ar":"وايت موكا","name_en":"White Mocha","slug":"white-mocha"},{"price":18,"cat":"المشروبات الباردة","name_ar":"ايس في 60","name_en":"Iced V60","slug":"iced-v60"},{"price":16,"cat":"المشروبات الباردة","name_ar":"ايس امريكانو","name_en":"Iced Americano","slug":"iced-americano"},{"price":18,"cat":"المشروبات الباردة","name_ar":"ايس لاتيه","name_en":"Iced Latte","slug":"iced-latte"},{"price":16,"cat":"المشروبات الباردة","name_ar":"ايس موكا","name_en":"Iced Mocha","slug":"iced-mocha"},{"price":16,"cat":"المشروبات الباردة","name_ar":"ايس سبانيش لاتيه","name_en":"Iced Spanish Latte","slug":"iced-spanish-latte"},{"price":18,"cat":"المشروبات الباردة","name_ar":"بيستاشو لاتيه","name_en":"Pistachio Latte","slug":"pistachio-latte"},{"price":15,"cat":"العصائر","name_ar":"عصير أفوكادو","name_en":"Avocado juice","slug":"avocado-juice"},{"price":12,"cat":"العصائر","name_ar":"عصير موز حليب","name_en":"Banana milk","slug":"banana-milk"},{"price":12,"cat":"العصائر","name_ar":"عصير جوافة","name_en":"Guava juice","slug":"guava-juice"},{"price":15,"cat":"العصائر","name_ar":"عصير جوافة بالحليب","name_en":"Guava milk","slug":"guava-milk"},{"price":15,"cat":"العصائر","name_ar":"عصير كيوي","name_en":"Kiwi juice","slug":"kiwi-juice"},{"price":12,"cat":"العصائر","name_ar":"عصير ليمون نعناع","name_en":"Lemon mint","slug":"lemon-mint"},{"price":15,"cat":"العصائر","name_ar":"عصير مانجو","name_en":"mango","slug":"mango"},{"price":12,"cat":"العصائر","name_ar":"عصير برتقال","name_en":"orange juice","slug":"orange-juice"},{"price":12,"cat":"العصائر","name_ar":"عصير بطيخ","name_en":"Watermelon juice","slug":"watermelon-juice"},{"price":5,"cat":"المشروبات","name_ar":"سفن اب دايت","name_en":"7 UP Diet","slug":"7-up-diet"},{"price":5,"cat":"المشروبات","name_ar":"سفن اب","name_en":"7 Up","slug":"7-up"},{"price":10,"cat":"المشروبات","name_ar":"كود ريد","name_en":"Code Red","slug":"code-red"},{"price":5,"cat":"المشروبات","name_ar":"كولا دايت","name_en":"Cola Diet","slug":"cola-diet"},{"price":10,"cat":"المشروبات","name_ar":"هولستن تفاح","name_en":"Houlsten Apple","slug":"houlsten-apple"},{"price":10,"cat":"المشروبات","name_ar":"هولستن شعير","name_en":"Houlsten Barley","slug":"houlsten-barley"},{"price":10,"cat":"المشروبات","name_ar":"هولستن عنب اسود","name_en":"Houlsten Black Grape","slug":"houlsten-black-grape"},{"price":10,"cat":"المشروبات","name_ar":"هولستن ليمون نعناع","name_en":"Houlsten Lemon Mint","slug":"houlsten-lemon-mint"},{"price":10,"cat":"المشروبات","name_ar":"هولستن فراولة","name_en":"Houlsten Strawberry","slug":"houlsten-strawberry"},{"price":10,"cat":"المشروبات","name_ar":"هولستن توت بري","name_en":"Houlsten Wild Berry","slug":"houlsten-wild-berry"},{"price":8,"cat":"المشروبات","name_ar":"ايس تي مشكل","name_en":"Ice Tea Mix","slug":"ice-tea-mix"},{"price":5,"cat":"المشروبات","name_ar":"ميريندا برقال","name_en":"Orange Miranda","slug":"orange-miranda"},{"price":8,"cat":"المشروبات","name_ar":"ايس تي خوخ","name_en":"Peach Iced Tea","slug":"peach-iced-tea"},{"price":5,"cat":"المشروبات","name_ar":"بيبسي","name_en":"Pepsi","slug":"pepsi"},{"price":3,"cat":"المشروبات","name_ar":"مياه عاديه","name_en":"Plain Water","slug":"plain-water"},{"price":15,"cat":"المشروبات","name_ar":"ريد بول","name_en":"Red Bull","slug":"red-bull"},{"price":10,"cat":"المشروبات","name_ar":"مياه غازية","name_en":"Sparkling water","slug":"sparkling-water"},{"price":5,"cat":"المشروبات","name_ar":"سبرايت","name_en":"Sprite","slug":"sprite"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب توت أسود","name_en":"Mojito 7UP Blackberry","slug":"mojito-7up-blackberry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب بلو","name_en":"Mojito 7UP Blueberry","slug":"mojito-7up-blueberry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب ليمون","name_en":"Mojito 7UP Lemon","slug":"mojito-7up-lemon"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب مكس بيري","name_en":"Mojito 7UP Mixed Berry","slug":"mojito-7up-mixed-berry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب باشن فروت","name_en":"Mojito 7UP Passion Fruit","slug":"mojito-7up-passion-fruit"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب خوخ","name_en":"Mojito 7UP Peach","slug":"mojito-7up-peach"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب رمان","name_en":"Mojito 7UP Pomegranate","slug":"mojito-7up-pomegranate"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب توت أحمر","name_en":"Mojito 7UP Raspberry","slug":"mojito-7up-raspberry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب فراولة","name_en":"Mojito 7UP Strawberry","slug":"mojito-7up-strawberry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب بطيخ","name_en":"Mojito 7UP Watermelon","slug":"mojito-7up-watermelon"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد توت أسود","name_en":"Mojito Code Red Blackberry","slug":"mojito-code-red-blackberry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد بلو","name_en":"Mojito Code Red Blueberry","slug":"mojito-code-red-blueberry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد ليمون","name_en":"Mojito Code Red Lemon","slug":"mojito-code-red-lemon"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد مكس بيري","name_en":"Mojito Code Red Mixed Berry","slug":"mojito-code-red-mixed-berry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد باشن فروت","name_en":"Mojito Code Red Passion Fruit","slug":"mojito-code-red-passion-fruit"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد خوخ","name_en":"Mojito Code Red Peach","slug":"mojito-code-red-peach"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد رمان","name_en":"Mojito Code Red Pomegranate","slug":"mojito-code-red-pomegranate"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد توت أحمر","name_en":"Mojito Code Red Raspberry","slug":"mojito-code-red-raspberry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد فراولة","name_en":"Mojito Code Red Strawberry","slug":"mojito-code-red-strawberry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد بطيخ","name_en":"Mojito Code Red Watermelon","slug":"mojito-code-red-watermelon"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول توت أسود","name_en":"Mojito Red Bull Blackberry","slug":"mojito-red-bull-blackberry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول بلو","name_en":"Mojito Red Bull Blueberry","slug":"mojito-red-bull-blueberry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول ليمون","name_en":"Mojito Red Bull Lemon","slug":"mojito-red-bull-lemon"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول مكس بيري","name_en":"Mojito Red Bull Mixed Berry","slug":"mojito-red-bull-mixed-berry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول باشن فروت","name_en":"Mojito Red Bull Passion Fruit","slug":"mojito-red-bull-passion-fruit"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول خوخ","name_en":"Mojito Red Bull Peach","slug":"mojito-red-bull-peach"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول رمان","name_en":"Mojito Red Bull Pomegranate","slug":"mojito-red-bull-pomegranate"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول توت أحمر","name_en":"Mojito Red Bull Raspberry","slug":"mojito-red-bull-raspberry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول فراولة","name_en":"Mojito Red Bull Strawberry","slug":"mojito-red-bull-strawberry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول بطيخ","name_en":"Mojito Red Bull Watermelon","slug":"mojito-red-bull-watermelon"},{"price":15,"cat":"ساندويش","name_ar":"سيزار دجاج","name_en":"Ceaser Chicken","slug":"ceaser-chicken"},{"price":15,"cat":"ساندويش","name_ar":"فاهيتا","name_en":"Fajita","slug":"fajita"},{"price":15,"cat":"ساندويش","name_ar":"حلومي","name_en":"Halloumi","slug":"halloumi"},{"price":15,"cat":"ساندويش","name_ar":"ماكسيكان","name_en":"Mexican","slug":"mexican"},{"price":15,"cat":"ساندويش","name_ar":"شاورما دجاج","name_en":"Shawarma Chicken","slug":"shawarma-chicken"},{"price":8,"cat":"حلى","name_ar":"كيك 8","name_en":"Cake 8","slug":"cake-8"},{"price":15,"cat":"حلى","name_ar":"تشيز كيك","name_en":"Cheesecake","slug":"cheesecake"},{"price":15,"cat":"حلى","name_ar":"كيك تشوكليت","name_en":"Chocolate Cake","slug":"chocolate-cake"},{"price":20,"cat":"حلى","name_ar":"دونات","name_en":"Dounat","slug":"dounat"},{"price":10,"cat":"حلى","name_ar":"مكسرات 10 ريال","name_en":"nuts 10 Sr","slug":"nuts-10-sr"},{"price":15,"cat":"حلى","name_ar":"مكسرات 15 ريال","name_en":"nuts 15 Sr","slug":"nuts-15-sr"},{"price":15,"cat":"حلى","name_ar":"كيكة بيستاشيو","name_en":"Pistachio Cake","slug":"pistachio-cake"},{"price":15,"cat":"حلى","name_ar":"رد فيلفت","name_en":"Red Velvet","slug":"red-velvet"},{"price":15,"cat":"حلى","name_ar":"سان سبستيان","name_en":"San Sabastian","slug":"san-sabastian"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"تفاحتين مكس","name_en":"Almosfaer Mix","slug":"almosfaer-mix-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"كاندي","name_en":"Candy","slug":"candy-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"تفاحتين فاخر","name_en":"Double Apple Premium","slug":"double-apple-premium-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"تفاحتين نخلة","name_en":"Double Apples Palm","slug":"double-apples-palm-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"علكة فاخر","name_en":"Gum Premium","slug":"gum-premium-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"مزايا علكة قرفة","name_en":"Mazaya Cinnamon Gum","slug":"mazaya-cinnamon-gum-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"شمام مزايا","name_en":"Melon Mzaya","slug":"melon-mzaya-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"بلوبيري فاخر","name_en":"Premium Blueberry","slug":"premium-blueberry-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"عنب توت فاخر","name_en":"Premium Grape Berry","slug":"premium-grape-berry-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"عنب نعناع فاخر","name_en":"Premium Grape Mint","slug":"premium-grape-mint-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"عنب فاخر","name_en":"Premium Grape","slug":"premium-grape-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"ليمون نعناع فاخر","name_en":"Premium Lemon Mint","slug":"premium-lemon-mint-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"نعناع فاخر","name_en":"Premium Mint","slug":"premium-mint-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"علكة مستكه فاخر","name_en":"Premium Musk Gum","slug":"premium-musk-gum-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"بطيخ فاخر","name_en":"Premium Watermelon","slug":"premium-watermelon-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"روبي كراش","name_en":"Ruby Crush","slug":"ruby-crush-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"فراولة فاخر","name_en":"Strawberry Premium","slug":"strawberry-premium-34"},{"price":34,"cat":"شيشة ٣٤ ريال","name_ar":"بطيخ نعناع فاخر","name_en":"Watermelon Mint Premium","slug":"watermelon-mint-premium-34"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"تفاحتين مكس","name_en":"Almosfaer Mix","slug":"almosfaer-mix-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"كاندي","name_en":"Candy","slug":"candy-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"تفاحتين فاخر","name_en":"Double Apple Premium","slug":"double-apple-premium-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"تفاحتين نخلة","name_en":"Double Apples Palm","slug":"double-apples-palm-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"علكة فاخر","name_en":"Gum Premium","slug":"gum-premium-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"مزايا علكة قرفة","name_en":"Mazaya Cinnamon Gum","slug":"mazaya-cinnamon-gum-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"شمام مزايا","name_en":"Melon Mzaya","slug":"melon-mzaya-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"بلوبيري فاخر","name_en":"Premium Blueberry","slug":"premium-blueberry-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"عنب توت فاخر","name_en":"Premium Grape Berry","slug":"premium-grape-berry-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"عنب نعناع فاخر","name_en":"Premium Grape Mint","slug":"premium-grape-mint-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"عنب فاخر","name_en":"Premium Grape","slug":"premium-grape-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"ليمون نعناع فاخر","name_en":"Premium Lemon Mint","slug":"premium-lemon-mint-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"نعناع فاخر","name_en":"Premium Mint","slug":"premium-mint-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"علكة مستكه فاخر","name_en":"Premium Musk Gum","slug":"premium-musk-gum-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"بطيخ فاخر","name_en":"Premium Watermelon","slug":"premium-watermelon-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"روبي كراش","name_en":"Ruby Crush","slug":"ruby-crush-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"فراولة فاخر","name_en":"Strawberry Premium","slug":"strawberry-premium-39"},{"price":39,"cat":"شيشة ٣٩ ريال","name_ar":"بطيخ نعناع فاخر","name_en":"Watermelon Mint Premium","slug":"watermelon-mint-premium-39"}]'::jsonb;

  v_sort := 0;
  v_cat_name := '';

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    -- Reset sort counter when category changes
    IF (v_item->>'cat') IS DISTINCT FROM v_cat_name THEN
      v_cat_name := v_item->>'cat';
      v_sort := 0;
    END IF;

    v_cat_id := (v_cat_map->>v_cat_name)::uuid;
    v_item_id := gen_random_uuid();

    INSERT INTO public.menu_items (id, restaurant_id, category_id, slug, name_ar, name_en, sort, is_active)
    VALUES (v_item_id, v_rid, v_cat_id, v_item->>'slug', v_item->>'name_ar', NULLIF(v_item->>'name_en', ''), v_sort, true);

    -- Variant: all items single-price; null price → "اسأل"
    IF (v_item->>'price') IS NULL THEN
      INSERT INTO public.menu_item_variants (id, menu_item_id, variant_key, variant_label_ar, price, sort, is_active)
      VALUES (gen_random_uuid(), v_item_id, 'single', 'اسأل', 0, 0, true);
    ELSE
      v_price := (v_item->>'price')::numeric;
      INSERT INTO public.menu_item_variants (id, menu_item_id, variant_key, price, sort, is_active)
      VALUES (gen_random_uuid(), v_item_id, 'single', v_price, 0, true);
    END IF;

    v_sort := v_sort + 1;
  END LOOP;

  -- 4) Subscription (ops logs the real payment afterward)
  INSERT INTO public.subscriptions (id, restaurant_id, plan, status, amount_sar, current_period_start, current_period_end)
  VALUES (gen_random_uuid(), v_rid, 'yearly', 'pending_payment', 0, now(), now() + interval '1 year');

  -- 5) Default branch
  INSERT INTO public.restaurant_branches (id, restaurant_id, name_ar, slug, is_default, is_active, sort_order)
  VALUES (gen_random_uuid(), v_rid, 'الفرع الرئيسي', 'main', true, true, 0);

  RAISE NOTICE 'Created mazaj-almosafer-rawdah with id: %', v_rid;
END $$;
