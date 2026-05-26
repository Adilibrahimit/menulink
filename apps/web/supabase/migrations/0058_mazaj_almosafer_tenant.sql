-- ============================================================================
-- MenuLink · 0058_mazaj_almosafer_tenant
--
-- New tenant: Mazaj Almosafer (مقهى مزاج المسافر)
-- Coffee, desserts, mojitos, sandwiches, shisha — 176 items across 13 categories.
-- Display-only mode (menu viewing, no ordering).
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
  IF EXISTS (SELECT 1 FROM public.restaurants WHERE slug = 'mazaj-almosafer') THEN
    RAISE NOTICE 'mazaj-almosafer already exists, skipping';
    RETURN;
  END IF;

  -- 1) Restaurant
  INSERT INTO public.restaurants (
    id, slug, name, whatsapp_phone, city, address_ar,
    primary_color, background_color, tagline_ar, instagram_handle,
    display_only_mode, is_active, is_published, plan, currency, timezone
  ) VALUES (
    gen_random_uuid(), 'mazaj-almosafer', 'مقهى مزاج المسافر', '966553547666',
    'الرياض', 'حي الملك فهد، الرياض',
    '#0F2D26', '#F4E8D4', 'قهوة · حلى · شيشة', 'almusaferlounge',
    true, true, false, 'yearly', 'SAR', 'Asia/Riyadh'
  ) RETURNING id INTO v_rid;

  -- 2) Categories (13)
  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'hot-drinks', 'المشروبات الساخنة', 'Hot Drinks', 0, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('المشروبات الساخنة', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'cold-drinks', 'المشروبات باردة', 'Cold Drinks', 1, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('المشروبات باردة', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'juices', 'عصائر طبيعية', 'Juices', 2, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('عصائر طبيعية', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'drinks', 'المشروبات', 'Drinks', 3, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('المشروبات', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'mojito-7up', 'موهيتو سفن اب', 'Mojito 7UP', 4, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('موهيتو سفن اب', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'mojito-sprite', 'موهيتو سبرايت', 'Mojito Sprite', 5, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('موهيتو سبرايت', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'mojito-code-red', 'موهيتو كود رد', 'Mojito Code Red', 6, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('موهيتو كود رد', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'mojito-red-bull', 'موهيتو رد بول', 'Mojito Red Bull', 7, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('موهيتو رد بول', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'sandwich', 'ساندويش', 'Sandwich', 8, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('ساندويش', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'dessert', 'حلى', 'Dessert', 9, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('حلى', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'shisha-am', 'شيشة صباحي', 'Shisha AM', 10, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('شيشة صباحي', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'shisha-pm', 'شيشة مسائي', 'Shisha PM', 11, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('شيشة مسائي', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'shisha-39', 'تجديد رأس 39', 'Shisha 39', 12, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('تجديد رأس 39', v_cat_id::text);

  -- 3) Items + variants from JSON (176 items)
  v_items := '[{"price":null,"cat":"المشروبات الساخنة","name_ar":"قهوة عربي","name_en":"","slug":"qhwa-arby"},{"price":15,"cat":"المشروبات الساخنة","name_ar":"امريكانو","name_en":"Americano","slug":"americano"},{"price":18,"cat":"المشروبات الساخنة","name_ar":"كابتشينو","name_en":"Cappuccino","slug":"cappuccino"},{"price":22,"cat":"المشروبات الساخنة","name_ar":"كيمكس","name_en":"Chemex","slug":"chemex"},{"price":10,"cat":"المشروبات الساخنة","name_ar":"قهوة اليوم","name_en":"Coffee Day","slug":"coffee-day"},{"price":15,"cat":"المشروبات الساخنة","name_ar":"كورتادو","name_en":"Cortado","slug":"cortado"},{"price":12,"cat":"المشروبات الساخنة","name_ar":"اسبريسو دبل","name_en":"Espresso Double","slug":"espresso-double"},{"price":8,"cat":"المشروبات الساخنة","name_ar":"اسبريسو سنقل","name_en":"Espresso Single","slug":"espresso-single"},{"price":16,"cat":"المشروبات الساخنة","name_ar":"فلات وايت","name_en":"Flat White","slug":"flat-white"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"زنجبيل","name_en":"Ginger Tea","slug":"ginger-tea"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"شاي اخضر","name_en":"Green Tea","slug":"green-tea"},{"price":28,"cat":"المشروبات الساخنة","name_ar":"هوت شوكليت","name_en":"Hot Chocolate","slug":"hot-chocolate"},{"price":17,"cat":"المشروبات الساخنة","name_ar":"لاتيه","name_en":"Latte","slug":"latte"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"شاي نعناع","name_en":"Mint Tea","slug":"mint-tea"},{"price":22,"cat":"المشروبات الساخنة","name_ar":"بستاثيو","name_en":"Pestachio","slug":"pestachio"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"شاي احمر","name_en":"Red Tea","slug":"red-tea"},{"price":49,"cat":"المشروبات الساخنة","name_ar":"سيجنتشر 49","name_en":"Signature 49","slug":"signature-49"},{"price":18,"cat":"المشروبات الساخنة","name_ar":"سبانيش لاتيه","name_en":"Spanish Latte","slug":"spanish-latte"},{"price":5,"cat":"المشروبات الساخنة","name_ar":"طائفي","name_en":"Taifi","slug":"taifi"},{"price":20,"cat":"المشروبات الساخنة","name_ar":"براد شاي اخضر","name_en":"Tea Pot Green","slug":"tea-pot-green"},{"price":20,"cat":"المشروبات الساخنة","name_ar":"براد شاي احمر","name_en":"Tea Pot Red","slug":"tea-pot-red"},{"price":10,"cat":"المشروبات الساخنة","name_ar":"قهوه تركي","name_en":"Turkish Coffee","slug":"turkish-coffee"},{"price":16,"cat":"المشروبات الساخنة","name_ar":"في ٦٠","name_en":"V60","slug":"v60"},{"price":22,"cat":"المشروبات الساخنة","name_ar":"وايت موكا","name_en":"White Mocha","slug":"white-mocha"},{"price":18,"cat":"المشروبات باردة","name_ar":"ايس في 60","name_en":"Iced  V60","slug":"iced-v60"},{"price":16,"cat":"المشروبات باردة","name_ar":"ايس امريكانو","name_en":"Iced Americano","slug":"iced-americano"},{"price":18,"cat":"المشروبات باردة","name_ar":"ايس لاتيه","name_en":"Iced Latte","slug":"iced-latte"},{"price":20,"cat":"المشروبات باردة","name_ar":"ايس موكا","name_en":"Iced Mocha","slug":"iced-mocha"},{"price":20,"cat":"المشروبات باردة","name_ar":"ايس سبانيش لاتيه","name_en":"Iced Spanish Latte","slug":"iced-spanish-latte"},{"price":25,"cat":"المشروبات باردة","name_ar":"بيستاشو لاتيه","name_en":"Pistachio Latte","slug":"pistachio-latte"},{"price":18,"cat":"عصائر طبيعية","name_ar":"عصير بطيخ","name_en":"","slug":"asyr-btykh"},{"price":18,"cat":"عصائر طبيعية","name_ar":"عصير برتقال","name_en":"","slug":"asyr-brtqal"},{"price":18,"cat":"عصائر طبيعية","name_ar":"عصير ليمون نعناع","name_en":"","slug":"asyr-lymwn-nanaa"},{"price":20,"cat":"عصائر طبيعية","name_ar":"عصير طبيعي 20","name_en":"","slug":"asyr-tbyay-20"},{"price":5,"cat":"المشروبات","name_ar":"سفن اب دايت","name_en":"7 UP Diet","slug":"7-up-diet"},{"price":5,"cat":"المشروبات","name_ar":"سفن اب","name_en":"7 Up","slug":"7-up"},{"price":10,"cat":"المشروبات","name_ar":"كود ريد","name_en":"Code Red","slug":"code-red"},{"price":5,"cat":"المشروبات","name_ar":"كولا دايت","name_en":"Cola Diet","slug":"cola-diet"},{"price":10,"cat":"المشروبات","name_ar":"هولستن تفاح","name_en":"Houlsten Apple","slug":"houlsten-apple"},{"price":10,"cat":"المشروبات","name_ar":"هولستن شعير","name_en":"Houlsten Barley","slug":"houlsten-barley"},{"price":10,"cat":"المشروبات","name_ar":"هولستن عنب اسود","name_en":"Houlsten Black Grape","slug":"houlsten-black-grape"},{"price":10,"cat":"المشروبات","name_ar":"هولستن ليمون نعناع","name_en":"Houlsten Lemon Mint","slug":"houlsten-lemon-mint"},{"price":10,"cat":"المشروبات","name_ar":"هولستن فراولة","name_en":"Houlsten Strawberry","slug":"houlsten-strawberry"},{"price":10,"cat":"المشروبات","name_ar":"هولستن توت بري","name_en":"Houlsten Wild Berry","slug":"houlsten-wild-berry"},{"price":8,"cat":"المشروبات","name_ar":"ايس تي مشكل","name_en":"Ice Tea Mix","slug":"ice-tea-mix"},{"price":5,"cat":"المشروبات","name_ar":"ميريندا برقال","name_en":"Orange Miranda","slug":"orange-miranda"},{"price":8,"cat":"المشروبات","name_ar":"ايس تي خوخ","name_en":"Peach Iced Tea","slug":"peach-iced-tea"},{"price":5,"cat":"المشروبات","name_ar":"بيبسي","name_en":"Pepsi","slug":"pepsi"},{"price":3,"cat":"المشروبات","name_ar":"مياه عاديه","name_en":"Plain Water","slug":"plain-water"},{"price":15,"cat":"المشروبات","name_ar":"ريد بول","name_en":"Red Bull","slug":"red-bull"},{"price":10,"cat":"المشروبات","name_ar":"مياه غازية","name_en":"Sparkling water","slug":"sparkling-water"},{"price":5,"cat":"المشروبات","name_ar":"سبرايت","name_en":"Sprite","slug":"sprite"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب توت أسود","name_en":"Mojito 7UP Blackberry","slug":"mojito-7up-blackberry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب بلو","name_en":"Mojito 7UP Blueberry","slug":"mojito-7up-blueberry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب ليمون","name_en":"Mojito 7UP Lemon","slug":"mojito-7up-lemon"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب مكس بيري","name_en":"Mojito 7UP Mixed Berry","slug":"mojito-7up-mixed-berry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب باشن فروت","name_en":"Mojito 7UP Passion Fruit","slug":"mojito-7up-passion-fruit"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب خوخ","name_en":"Mojito 7UP Peach","slug":"mojito-7up-peach"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب رمان","name_en":"Mojito 7UP Pomegranate","slug":"mojito-7up-pomegranate"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب توت أحمر","name_en":"Mojito 7UP Raspberry","slug":"mojito-7up-raspberry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب فراولة","name_en":"Mojito 7UP Strawberry","slug":"mojito-7up-strawberry"},{"price":15,"cat":"موهيتو سفن اب","name_ar":"موهيتو سفن اب بطيخ","name_en":"Mojito 7UP Watermelon","slug":"mojito-7up-watermelon"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت توت أسود","name_en":"Mojito Sprite Blackberry","slug":"mojito-sprite-blackberry"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت بلو","name_en":"Mojito Sprite Blueberry","slug":"mojito-sprite-blueberry"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت ليمون","name_en":"Mojito Sprite Lemon","slug":"mojito-sprite-lemon"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت مكس بيري","name_en":"Mojito Sprite Mixed Berry","slug":"mojito-sprite-mixed-berry"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت باشن فروت","name_en":"Mojito Sprite Passion Fruit","slug":"mojito-sprite-passion-fruit"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت خوخ","name_en":"Mojito Sprite Peach","slug":"mojito-sprite-peach"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت رمان","name_en":"Mojito Sprite Pomegranate","slug":"mojito-sprite-pomegranate"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت توت أحمر","name_en":"Mojito Sprite Raspberry","slug":"mojito-sprite-raspberry"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت فراولة","name_en":"Mojito Sprite Strawberry","slug":"mojito-sprite-strawberry"},{"price":15,"cat":"موهيتو سبرايت","name_ar":"موهيتو سبرايت بطيخ","name_en":"Mojito Sprite Watermelon","slug":"mojito-sprite-watermelon"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد توت أسود","name_en":"Mojito Code Red Blackberry","slug":"mojito-code-red-blackberry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد بلو","name_en":"Mojito Code Red Blueberry","slug":"mojito-code-red-blueberry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد ليمون","name_en":"Mojito Code Red Lemon","slug":"mojito-code-red-lemon"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد مكس بيري","name_en":"Mojito Code Red Mixed Berry","slug":"mojito-code-red-mixed-berry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد باشن فروت","name_en":"Mojito Code Red Passion Fruit","slug":"mojito-code-red-passion-fruit"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد خوخ","name_en":"Mojito Code Red Peach","slug":"mojito-code-red-peach"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد رمان","name_en":"Mojito Code Red Pomegranate","slug":"mojito-code-red-pomegranate"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد توت أحمر","name_en":"Mojito Code Red Raspberry","slug":"mojito-code-red-raspberry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد فراولة","name_en":"Mojito Code Red Strawberry","slug":"mojito-code-red-strawberry"},{"price":18,"cat":"موهيتو كود رد","name_ar":"موهيتو كود رد بطيخ","name_en":"Mojito Code Red Watermelon","slug":"mojito-code-red-watermelon"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول توت أسود","name_en":"Mojito Red Bull Blackberry","slug":"mojito-red-bull-blackberry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول بلو","name_en":"Mojito Red Bull Blueberry","slug":"mojito-red-bull-blueberry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول ليمون","name_en":"Mojito Red Bull Lemon","slug":"mojito-red-bull-lemon"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول مكس بيري","name_en":"Mojito Red Bull Mixed Berry","slug":"mojito-red-bull-mixed-berry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول باشن فروت","name_en":"Mojito Red Bull Passion Fruit","slug":"mojito-red-bull-passion-fruit"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول خوخ","name_en":"Mojito Red Bull Peach","slug":"mojito-red-bull-peach"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول رمان","name_en":"Mojito Red Bull Pomegranate","slug":"mojito-red-bull-pomegranate"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول توت أحمر","name_en":"Mojito Red Bull Raspberry","slug":"mojito-red-bull-raspberry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول فراولة","name_en":"Mojito Red Bull Strawberry","slug":"mojito-red-bull-strawberry"},{"price":22,"cat":"موهيتو رد بول","name_ar":"موهيتو رد بول بطيخ","name_en":"Mojito Red Bull Watermelon","slug":"mojito-red-bull-watermelon"},{"price":15,"cat":"ساندويش","name_ar":"سيزار دجاج","name_en":"Ceaser Chicken","slug":"ceaser-chicken"},{"price":15,"cat":"ساندويش","name_ar":"فاهيتا","name_en":"Fajita","slug":"fajita"},{"price":15,"cat":"ساندويش","name_ar":"حلومي","name_en":"Halloumi","slug":"halloumi"},{"price":15,"cat":"ساندويش","name_ar":"ماكسيكان","name_en":"Mexican","slug":"mexican"},{"price":15,"cat":"ساندويش","name_ar":"شاورما دجاج","name_en":"Shawarma Chicken","slug":"shawarma-chicken"},{"price":18,"cat":"حلى","name_ar":"تراميسو","name_en":"","slug":"tramysw"},{"price":18,"cat":"حلى","name_ar":"بودق شوكليت","name_en":"","slug":"bwdq-shwklyt"},{"price":18,"cat":"حلى","name_ar":"كيك كراميل","name_en":"","slug":"kyk-kramyl"},{"price":18,"cat":"حلى","name_ar":"لافا مولتن كيك","name_en":"","slug":"lafa-mwltn-kyk"},{"price":18,"cat":"حلى","name_ar":"كيكة عسل","name_en":"","slug":"kyka-asl"},{"price":18,"cat":"حلى","name_ar":"بودينج الشوكولاته بالبندق","name_en":"","slug":"bwdynj-alshwkwlath-balbndq"},{"price":18,"cat":"حلى","name_ar":"أولكر كيك","name_en":"","slug":"awlkr-kyk"},{"price":18,"cat":"حلى","name_ar":"كرانشي شوكليت روز بيري","name_en":"","slug":"kranshy-shwklyt-rwz-byry"},{"price":18,"cat":"حلى","name_ar":"كرانشي شوكليت","name_en":"","slug":"kranshy-shwklyt"},{"price":10,"cat":"حلى","name_ar":"بسبوسة","name_en":"","slug":"bsbwsa"},{"price":null,"cat":"حلى","name_ar":"كيكة الليمون","name_en":"","slug":"kyka-allymwn"},{"price":10,"cat":"حلى","name_ar":"کیكة ماربل","name_en":"","slug":"kyka-marbl"},{"price":10,"cat":"حلى","name_ar":"کلاودي كيك","name_en":"","slug":"klawdy-kyk"},{"price":null,"cat":"حلى","name_ar":"لايرز كيك","name_en":"","slug":"layrz-kyk"},{"price":null,"cat":"حلى","name_ar":"سان سباستيان","name_en":"","slug":"san-sbastyan"},{"price":null,"cat":"حلى","name_ar":"بسبوسه","name_en":"Basbousa","slug":"basbousa"},{"price":null,"cat":"حلى","name_ar":"تشيز كيك","name_en":"Cheesecake","slug":"cheesecake"},{"price":18,"cat":"حلى","name_ar":"كيك تشوكليت","name_en":"Chocolate Cake","slug":"chocolate-cake"},{"price":10,"cat":"حلى","name_ar":"مكسرات 10 ريال","name_en":"nuts 10 Sr","slug":"nuts-10-sr"},{"price":15,"cat":"حلى","name_ar":"مكسرات 15 ريال","name_en":"nuts 15 Sr","slug":"nuts-15-sr"},{"price":null,"cat":"حلى","name_ar":"كيكة بيستاشيو","name_en":"Pistachio Cake","slug":"pistachio-cake"},{"price":null,"cat":"حلى","name_ar":"رد فيلفت","name_en":"Red Velvet","slug":"red-velvet"},{"price":null,"cat":"حلى","name_ar":"سان سبستيان","name_en":"San Sabastian","slug":"san-sabastian"},{"price":55,"cat":"شيشة صباحي","name_ar":"تفاحتين مكس","name_en":"Almosfaer Mix","slug":"almosfaer-mix"},{"price":55,"cat":"شيشة صباحي","name_ar":"كاندي","name_en":"Candy","slug":"candy"},{"price":55,"cat":"شيشة صباحي","name_ar":"تفاحتين فاخر","name_en":"Double Apple Premium","slug":"double-apple-premium"},{"price":55,"cat":"شيشة صباحي","name_ar":"تفاحتين نخلة","name_en":"Double Apples Palm","slug":"double-apples-palm"},{"price":55,"cat":"شيشة صباحي","name_ar":"علكة فاخر","name_en":"Gum Premium","slug":"gum-premium"},{"price":55,"cat":"شيشة صباحي","name_ar":"مزايا علكة قرفة","name_en":"Mazaya Cinnamon Gum","slug":"mazaya-cinnamon-gum"},{"price":55,"cat":"شيشة صباحي","name_ar":"شمام مزايا","name_en":"Melon Mzaya","slug":"melon-mzaya"},{"price":55,"cat":"شيشة صباحي","name_ar":"بلوبيري فاخر","name_en":"Premium Blueberry","slug":"premium-blueberry"},{"price":55,"cat":"شيشة صباحي","name_ar":"عنب توت فاخر","name_en":"Premium Grape Berry","slug":"premium-grape-berry"},{"price":55,"cat":"شيشة صباحي","name_ar":"عنب نعناع فاخر","name_en":"Premium Grape Mint","slug":"premium-grape-mint"},{"price":55,"cat":"شيشة صباحي","name_ar":"عنب فاخر","name_en":"Premium Grape","slug":"premium-grape"},{"price":55,"cat":"شيشة صباحي","name_ar":"ليمون نعناع فاخر","name_en":"Premium Lemon Mint","slug":"premium-lemon-mint"},{"price":55,"cat":"شيشة صباحي","name_ar":"نعناع فاخر","name_en":"Premium Mint","slug":"premium-mint"},{"price":55,"cat":"شيشة صباحي","name_ar":"علكة مستكه فاخر","name_en":"Premium Musk Gum","slug":"premium-musk-gum"},{"price":55,"cat":"شيشة صباحي","name_ar":"بطيخ فاخر","name_en":"Premium Watermelon","slug":"premium-watermelon"},{"price":55,"cat":"شيشة صباحي","name_ar":"روبي كراش","name_en":"Ruby Crush","slug":"ruby-crush"},{"price":120,"cat":"شيشة صباحي","name_ar":"3 شيشة","name_en":"SHISHA 3","slug":"shisha-3"},{"price":49,"cat":"شيشة صباحي","name_ar":"49شيشة","name_en":"SHISHA 49","slug":"shisha-49"},{"price":55,"cat":"شيشة صباحي","name_ar":"فراولة فاخر","name_en":"Strawberry Premium","slug":"strawberry-premium"},{"price":55,"cat":"شيشة صباحي","name_ar":"بطيخ نعناع فاخر","name_en":"Watermelon Mint Premium","slug":"watermelon-mint-premium"},{"price":60,"cat":"شيشة مسائي","name_ar":"تفاحتين مكس","name_en":"Almosfaer Mix","slug":"almosfaer-mix-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"كاندي","name_en":"Candy","slug":"candy-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"تفاحتين فاخر","name_en":"Double Apple Premium","slug":"double-apple-premium-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"تفاحتين نخلة","name_en":"Double Apples Palm","slug":"double-apples-palm-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"علكة فاخر","name_en":"Gum Premium","slug":"gum-premium-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"مزايا علكة قرفة","name_en":"Mazaya Cinnamon Gum","slug":"mazaya-cinnamon-gum-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"شمام مزايا","name_en":"Melon Mzaya","slug":"melon-mzaya-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"بلوبيري فاخر","name_en":"Premium Blueberry","slug":"premium-blueberry-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"عنب توت فاخر","name_en":"Premium Grape Berry","slug":"premium-grape-berry-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"عنب نعناع فاخر","name_en":"Premium Grape Mint","slug":"premium-grape-mint-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"عنب فاخر","name_en":"Premium Grape","slug":"premium-grape-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"ليمون نعناع فاخر","name_en":"Premium Lemon Mint","slug":"premium-lemon-mint-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"نعناع فاخر","name_en":"Premium Mint","slug":"premium-mint-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"علكة مستكه فاخر","name_en":"Premium Musk Gum","slug":"premium-musk-gum-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"بطيخ فاخر","name_en":"Premium Watermelon","slug":"premium-watermelon-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"روبي كراش","name_en":"Ruby Crush","slug":"ruby-crush-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"فراولة فاخر","name_en":"Strawberry Premium","slug":"strawberry-premium-shisha-pm"},{"price":60,"cat":"شيشة مسائي","name_ar":"بطيخ نعناع فاخر","name_en":"Watermelon Mint Premium","slug":"watermelon-mint-premium-shisha-pm"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس تفاحتين مكس","name_en":"Almosfaer Mix","slug":"almosfaer-mix-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس كاندي","name_en":"Candy","slug":"candy-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس تفاحتين فاخر","name_en":"Double Apple Premium","slug":"double-apple-premium-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس تفاحتين نخلة","name_en":"Double Apples Palm","slug":"double-apples-palm-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس علكة فاخر","name_en":"Gum Premium","slug":"gum-premium-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس مزايا علكة قرفة","name_en":"Mazaya Cinnamon Gum","slug":"mazaya-cinnamon-gum-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس شمام مزايا","name_en":"Melon Mzaya","slug":"melon-mzaya-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس بلوبيري فاخر","name_en":"Premium Blueberry","slug":"premium-blueberry-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس عنب توت فاخر","name_en":"Premium Grape Berry","slug":"premium-grape-berry-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس عنب نعناع فاخر","name_en":"Premium Grape Mint","slug":"premium-grape-mint-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس عنب فاخر","name_en":"Premium Grape","slug":"premium-grape-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس ليمون نعناع فاخر","name_en":"Premium Lemon Mint","slug":"premium-lemon-mint-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"نتجديد رأس عناع فاخر","name_en":"Premium Mint","slug":"premium-mint-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس علكة مستكه فاخر","name_en":"Premium Musk Gum","slug":"premium-musk-gum-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس بطيخ فاخر","name_en":"Premium Watermelon","slug":"premium-watermelon-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس روبي كراش","name_en":"Ruby Crush","slug":"ruby-crush-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس فراولة فاخر","name_en":"Strawberry Premium","slug":"strawberry-premium-shisha-39"},{"price":39,"cat":"تجديد رأس 39","name_ar":"تجديد رأس بطيخ نعناع فاخر","name_en":"Watermelon Mint Premium","slug":"watermelon-mint-premium-shisha-39"}]'::jsonb;

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

    -- Variant: if price is null, use 0 with label
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

  -- 4) Subscription
  INSERT INTO public.subscriptions (id, restaurant_id, plan, status, amount_sar, current_period_start, current_period_end)
  VALUES (gen_random_uuid(), v_rid, 'yearly', 'pending_payment', 0, now(), now() + interval '1 year');

  -- 5) Default branch
  INSERT INTO public.restaurant_branches (id, restaurant_id, name_ar, slug, is_default, is_active, sort_order)
  VALUES (gen_random_uuid(), v_rid, 'الفرع الرئيسي', 'main', true, true, 0);

  RAISE NOTICE 'Created mazaj-almosafer with id: %', v_rid;
END $$;
