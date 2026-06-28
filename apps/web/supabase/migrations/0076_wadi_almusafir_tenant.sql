-- ============================================================================
-- MenuLink · 0076_wadi_almusafir_tenant
--
-- New tenant: Wadi Almusafir (وادي المسافر) — a Riyadh shisha café-lounge (مقهى ولاونج).
-- IMPORTANT: NOT related to "Mazaj Almosafer" — similar Arabic name, different business.
-- Menu-only / display-only (QR view, no ordering). BILINGUAL (English under Arabic).
-- Bespoke dark+gold ornate design: menu_design_key='wadi-lounge' (lib/themes.ts →
-- WADI_LOUNGE_THEME, layout wadi-lounge-menu.tsx, hexagon price badges).
-- 137 items across 8 categories, cleaned from the client's Baladi POS
-- export (docs/clients/wadi-almusafir/wadi-almusafir.xlsx): shisha "شيشة" prefix +
-- redundant tier number stripped from display names; two price tiers (35 / 59 SAR)
-- modeled as two categories (head-change items kept inside, per the POS). SFDA calories
-- on every food/drink item (shisha + head-change exempt = null); allergens on
-- desserts/meals/milk-drinks.
-- Also buys the new "google_review" service (100 SAR): google_review_url set →
-- in-menu review banner; subscription_addons row enabled.
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
  IF EXISTS (SELECT 1 FROM public.restaurants WHERE slug = 'wadi-almusafir') THEN
    RAISE NOTICE 'wadi-almusafir already exists, skipping';
    RETURN;
  END IF;

  -- 1) Restaurant (display-only, bilingual, bespoke wadi-lounge design + google review)
  INSERT INTO public.restaurants (
    id, slug, name, whatsapp_phone, city, address_ar, lat, lng,
    primary_color, background_color, tagline_ar, instagram_handle,
    menu_design_key, google_review_url,
    display_only_mode, is_active, is_published, plan, currency, timezone
  ) VALUES (
    gen_random_uuid(), 'wadi-almusafir', 'وادي المسافر', '966563200133',
    'الرياض', 'نجم الدين الأيوبي، العوالي، الرياض 11234', 24.5526758, 46.6361331,
    '#D9B65C', '#0B0805', 'مقهى و لاونج', 'wadi_almusafir',
    'wadi-lounge', 'https://www.google.com/maps?cid=3853015978050978663',
    true, true, false, 'yearly', 'SAR', 'Asia/Riyadh'
  ) RETURNING id INTO v_rid;

  -- 2) Categories (8)

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'cold-drinks', 'المشروبات الباردة', 'Cold Drinks', 0, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('المشروبات الباردة', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'hot-drinks', 'المشروبات الساخنة', 'Hot Drinks', 1, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('المشروبات الساخنة', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'mojito', 'الموهيتو', 'Mojito', 2, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('الموهيتو', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'juices', 'العصائر', 'Juices', 3, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('العصائر', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'desserts', 'الحلى', 'Desserts', 4, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('الحلى', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'shisha-35', 'شيشة ٣٥ ريال', 'Shisha 35 SAR', 5, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('شيشة ٣٥ ريال', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'shisha-59', 'شيشة ٥٩ ريال', 'Shisha 59 SAR', 6, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('شيشة ٥٩ ريال', v_cat_id::text);

  INSERT INTO public.menu_categories (id, restaurant_id, slug, name_ar, name_en, sort, is_active)
  VALUES (gen_random_uuid(), v_rid, 'meals', 'الوجبات', 'Meals', 7, true)
  RETURNING id INTO v_cat_id;
  v_cat_map := v_cat_map || jsonb_build_object('الوجبات', v_cat_id::text);

  -- 3) Items + variants (137; single-price; SFDA calories + allergens)
  v_items := '[{"price":5,"cat":"المشروبات الباردة","name_ar":"كوكاكولا","name_en":"Coca-Cola","slug":"coca-cola","calories":140,"allergens":[]},{"price":5,"cat":"المشروبات الباردة","name_ar":"سفن","name_en":"7UP","slug":"7up","calories":140,"allergens":[]},{"price":5,"cat":"المشروبات الباردة","name_ar":"شاني","name_en":"Shani","slug":"shani","calories":140,"allergens":[]},{"price":5,"cat":"المشروبات الباردة","name_ar":"حمضيات","name_en":"Citrus Soda","slug":"citrus-soda","calories":140,"allergens":[]},{"price":5,"cat":"المشروبات الباردة","name_ar":"كوب ثلج","name_en":"Cup of Ice","slug":"cup-of-ice","calories":0,"allergens":[]},{"price":15,"cat":"المشروبات الباردة","name_ar":"بيره","name_en":"Malt Beverage","slug":"malt-beverage","calories":140,"allergens":[]},{"price":17,"cat":"المشروبات الباردة","name_ar":"V60 بارد","name_en":"Iced V60","slug":"iced-v60","calories":10,"allergens":[]},{"price":15,"cat":"المشروبات الباردة","name_ar":"كولد برو","name_en":"Cold brew","slug":"cold-brew","calories":10,"allergens":[]},{"price":15,"cat":"المشروبات الباردة","name_ar":"كركديه توت","name_en":"Hibiscus berry","slug":"hibiscus-berry","calories":90,"allergens":["dairy"]},{"price":15,"cat":"المشروبات الباردة","name_ar":"كركديه اناناس","name_en":"Hibiscus pineapple","slug":"hibiscus-pineapple","calories":90,"allergens":["dairy"]},{"price":15,"cat":"المشروبات الباردة","name_ar":"كركديه فراولة","name_en":"Hibiscus strawberry","slug":"hibiscus-strawberry","calories":90,"allergens":["dairy"]},{"price":10,"cat":"المشروبات الباردة","name_ar":"هنكل بيرة","name_en":"HNAKL","slug":"hnakl","calories":140,"allergens":[]},{"price":12,"cat":"المشروبات الباردة","name_ar":"ايس امريكانو","name_en":"Iced Americano","slug":"iced-americano","calories":10,"allergens":[]},{"price":15,"cat":"المشروبات الباردة","name_ar":"ايس كراميل","name_en":"Iced caramel","slug":"iced-caramel","calories":210,"allergens":["dairy"]},{"price":14,"cat":"المشروبات الباردة","name_ar":"ايس لاتيه","name_en":"Iced latte","slug":"iced-latte","calories":210,"allergens":["dairy"]},{"price":15,"cat":"المشروبات الباردة","name_ar":"ايس موكا","name_en":"Iced mocha","slug":"iced-mocha","calories":210,"allergens":["dairy"]},{"price":14,"cat":"المشروبات الباردة","name_ar":"ايس بيستاشيو","name_en":"Iced pistachio","slug":"iced-pistachio","calories":210,"allergens":["tree_nuts","dairy"]},{"price":10,"cat":"المشروبات الباردة","name_ar":"ايس تي ميكس","name_en":"Iced tea mix","slug":"iced-tea-mix","calories":15,"allergens":[]},{"price":10,"cat":"المشروبات الباردة","name_ar":"ايس تي خوخ","name_en":"Iced tea peach","slug":"iced-tea-peach","calories":15,"allergens":[]},{"price":16,"cat":"المشروبات الباردة","name_ar":"ميلك تشيك اوريو","name_en":"Milkshake Oreo","slug":"milkshake-oreo","calories":240,"allergens":["dairy","gluten"]},{"price":16,"cat":"المشروبات الباردة","name_ar":"ميلك تشيك فراولة","name_en":"Milkshake strawberry","slug":"milkshake-strawberry","calories":420,"allergens":["dairy"]},{"price":10,"cat":"المشروبات الباردة","name_ar":"كركديه ساده","name_en":"Plain hibiscus","slug":"plain-hibiscus","calories":15,"allergens":["dairy"]},{"price":16,"cat":"المشروبات الباردة","name_ar":"تشيكن وايت موكا","name_en":"Shaken white mocha","slug":"shaken-white-mocha","calories":210,"allergens":["dairy"]},{"price":5,"cat":"المشروبات الباردة","name_ar":"اي ستى","name_en":"Ice Tea","slug":"ice-tea","calories":15,"allergens":[]},{"price":5,"cat":"المشروبات الباردة","name_ar":"بيبسي","name_en":"Pepsi","slug":"pepsi","calories":140,"allergens":[]},{"price":15,"cat":"المشروبات الباردة","name_ar":"كركديه رويال بابلز","name_en":"Hibiscus Royal Bubbles","slug":"hibiscus-royal-bubbles","calories":90,"allergens":["dairy"]},{"price":6,"cat":"المشروبات الباردة","name_ar":"كود رد","name_en":"Code Red","slug":"code-red","calories":140,"allergens":[]},{"price":16,"cat":"المشروبات الساخنة","name_ar":"V60","name_en":"V60","slug":"v60","calories":10,"allergens":[]},{"price":20,"cat":"المشروبات الساخنة","name_ar":"كرك براد","name_en":"Karak Pot","slug":"karak-pot","calories":210,"allergens":["dairy"]},{"price":14,"cat":"المشروبات الساخنة","name_ar":"هوت شكلت","name_en":"Hot Chocolate","slug":"hot-chocolate","calories":320,"allergens":["dairy"]},{"price":14,"cat":"المشروبات الساخنة","name_ar":"كورتادو","name_en":"Cortado","slug":"cortado","calories":10,"allergens":[]},{"price":11,"cat":"المشروبات الساخنة","name_ar":"بلاك كوفي","name_en":"Black coffee","slug":"black-coffee","calories":10,"allergens":[]},{"price":16,"cat":"المشروبات الساخنة","name_ar":"كابتشينو","name_en":"Cappuccino","slug":"cappuccino","calories":210,"allergens":["dairy"]},{"price":16,"cat":"المشروبات الساخنة","name_ar":"كراميل لاتيه","name_en":"Caramel latte","slug":"caramel-latte","calories":210,"allergens":["dairy"]},{"price":7,"cat":"المشروبات الساخنة","name_ar":"كوب شاي كبير","name_en":"cop of tea","slug":"cop-of-tea","calories":15,"allergens":[]},{"price":7,"cat":"المشروبات الساخنة","name_ar":"كوب زنجبيل ليمون","name_en":"Cup of ginger lemon","slug":"cup-of-ginger-lemon","calories":15,"allergens":[]},{"price":5,"cat":"المشروبات الساخنة","name_ar":"كوب نعناع سادة","name_en":"Cup of mint tea","slug":"cup-of-mint-tea","calories":15,"allergens":[]},{"price":5,"cat":"المشروبات الساخنة","name_ar":"كوب شاي تلقيمة","name_en":"Cup of tea Tlgeema","slug":"cup-of-tea-tlgeema","calories":15,"allergens":[]},{"price":5,"cat":"المشروبات الساخنة","name_ar":"كوب شاي","name_en":"Cup of tea","slug":"cup-of-tea","calories":15,"allergens":[]},{"price":20,"cat":"المشروبات الساخنة","name_ar":"دلة قهوة سعودية","name_en":"Dallah Saudi Coffee","slug":"dallah-saudi-coffee","calories":10,"allergens":[]},{"price":12,"cat":"المشروبات الساخنة","name_ar":"اسبريسو دبل شوت","name_en":"Double espresso","slug":"double-espresso","calories":10,"allergens":[]},{"price":15,"cat":"المشروبات الساخنة","name_ar":"قهوة فرنسية","name_en":"French coffee","slug":"french-coffee","calories":10,"allergens":[]},{"price":20,"cat":"المشروبات الساخنة","name_ar":"براد زنجبيل ليمون","name_en":"Ginger lemon pot","slug":"ginger-lemon-pot","calories":15,"allergens":[]},{"price":16,"cat":"المشروبات الساخنة","name_ar":"هوت موكا","name_en":"Hot mocha","slug":"hot-mocha","calories":210,"allergens":["dairy"]},{"price":16,"cat":"المشروبات الساخنة","name_ar":"اوريو هوت","name_en":"Hot Oreo","slug":"hot-oreo","calories":240,"allergens":["gluten","dairy"]},{"price":15,"cat":"المشروبات الساخنة","name_ar":"قهوة ايطالية","name_en":"Italian coffee","slug":"italian-coffee","calories":10,"allergens":[]},{"price":9,"cat":"المشروبات الساخنة","name_ar":"كرك حليب","name_en":"krak milk","slug":"krak-milk","calories":190,"allergens":["dairy"]},{"price":14,"cat":"المشروبات الساخنة","name_ar":"لاتيه","name_en":"Latte","slug":"latte","calories":210,"allergens":["dairy"]},{"price":15,"cat":"المشروبات الساخنة","name_ar":"ماتشا لاتيه","name_en":"Matcha latte","slug":"matcha-latte","calories":210,"allergens":["dairy"]},{"price":8,"cat":"المشروبات الساخنة","name_ar":"MILK","name_en":"milk","slug":"milk","calories":190,"allergens":["dairy"]},{"price":18,"cat":"المشروبات الساخنة","name_ar":"براد نعناع","name_en":"Mint tea pot","slug":"mint-tea-pot","calories":15,"allergens":[]},{"price":16,"cat":"المشروبات الساخنة","name_ar":"بيستاشيو لاتيه","name_en":"Pistachio latte","slug":"pistachio-latte","calories":210,"allergens":["tree_nuts","dairy"]},{"price":8,"cat":"المشروبات الساخنة","name_ar":"اسبريسو سنغل","name_en":"Single espresso","slug":"single-espresso","calories":10,"allergens":[]},{"price":16,"cat":"المشروبات الساخنة","name_ar":"اسبانيش لاتيه","name_en":"Spanish latte","slug":"spanish-latte","calories":210,"allergens":["dairy"]},{"price":18,"cat":"المشروبات الساخنة","name_ar":"براد شاي تلقيمة","name_en":"Tea pot Tlgeema","slug":"tea-pot-tlgeema","calories":15,"allergens":[]},{"price":18,"cat":"المشروبات الساخنة","name_ar":"براد شاي","name_en":"Tea pot","slug":"tea-pot","calories":15,"allergens":[]},{"price":14,"cat":"المشروبات الساخنة","name_ar":"قهوة تركية","name_en":"Turkish coffee","slug":"turkish-coffee","calories":10,"allergens":[]},{"price":7,"cat":"المشروبات الساخنة","name_ar":"COIF kAs","name_en":"Saudi Coffee Cup","slug":"saudi-coffee-cup","calories":10,"allergens":[]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو توت اسود","name_en":"Blackberry Mojito","slug":"blackberry-mojito","calories":140,"allergens":[]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو توت ازرق","name_en":"Blueberry Mojito","slug":"blueberry-mojito","calories":140,"allergens":[]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو كراميل","name_en":"Caramel Mojito","slug":"caramel-mojito","calories":140,"allergens":["dairy"]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو ليمون نعناع","name_en":"Lemon Mint Mojito","slug":"lemon-mint-mojito","calories":140,"allergens":[]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو ميكس","name_en":"Mixed Mojito","slug":"mixed-mojito","calories":140,"allergens":[]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو باشن فروت","name_en":"Passion Fruit Mojito","slug":"passion-fruit-mojito","calories":140,"allergens":[]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو خوخ","name_en":"Peach Mojito","slug":"peach-mojito","calories":140,"allergens":[]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو توت احمر","name_en":"Redberry Mojito","slug":"redberry-mojito","calories":140,"allergens":[]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو فراولة","name_en":"Strawberry Mojito","slug":"strawberry-mojito","calories":140,"allergens":[]},{"price":16,"cat":"الموهيتو","name_ar":"موهيتو بطيخ","name_en":"Watermelon Mojito","slug":"watermelon-mojito","calories":140,"allergens":[]},{"price":16,"cat":"العصائر","name_ar":"عصير تفاح جزر برتقال","name_en":"Apple carrot orange juice","slug":"apple-carrot-orange-juice","calories":130,"allergens":[]},{"price":16,"cat":"العصائر","name_ar":"عصير تفاح","name_en":"Apple juice","slug":"apple-juice","calories":130,"allergens":[]},{"price":16,"cat":"العصائر","name_ar":"كوكتيل","name_en":"Cocktail","slug":"cocktail","calories":130,"allergens":[]},{"price":16,"cat":"العصائر","name_ar":"عصير جوافة حليب","name_en":"Guava Milk","slug":"guava-milk","calories":190,"allergens":["dairy"]},{"price":16,"cat":"العصائر","name_ar":"اصفهاني","name_en":"Isfahani","slug":"isfahani","calories":130,"allergens":[]},{"price":16,"cat":"العصائر","name_ar":"عصير ليمون","name_en":"Lemon juice","slug":"lemon-juice","calories":130,"allergens":[]},{"price":16,"cat":"العصائر","name_ar":"عصير ليمون نعناع","name_en":"Lemon mint juice","slug":"lemon-mint-juice","calories":130,"allergens":[]},{"price":16,"cat":"العصائر","name_ar":"عصير مانجو حليب","name_en":"Mango Milk","slug":"mango-milk","calories":190,"allergens":["dairy"]},{"price":16,"cat":"العصائر","name_ar":"عصير مكس ليمون برتقال نعناع","name_en":"Mixed lemon orange mint juice","slug":"mixed-lemon-orange-mint-juice","calories":130,"allergens":[]},{"price":16,"cat":"العصائر","name_ar":"عصير برتقال","name_en":"Orange juice","slug":"orange-juice","calories":130,"allergens":[]},{"price":16,"cat":"العصائر","name_ar":"عصير فراولة حليب","name_en":"Strawberry Milk","slug":"strawberry-milk","calories":190,"allergens":["dairy"]},{"price":16,"cat":"العصائر","name_ar":"كوكتيل وادي المسافر","name_en":"Wadi Al-Musafir cocktail","slug":"wadi-al-musafir-cocktail","calories":130,"allergens":[]},{"price":2,"cat":"العصائر","name_ar":"زجاجة ماء","name_en":"water","slug":"water","calories":0,"allergens":[]},{"price":20,"cat":"الحلى","name_ar":"كيك أناناس","name_en":"Pineapple Cake","slug":"pineapple-cake","calories":380,"allergens":["gluten","dairy","eggs"]},{"price":20,"cat":"الحلى","name_ar":"لافا شوكلت","name_en":"Lava Cake","slug":"lava-cake","calories":320,"allergens":["gluten","dairy","eggs"]},{"price":20,"cat":"الحلى","name_ar":"كيك التمر","name_en":"Date Cake","slug":"date-cake","calories":380,"allergens":["gluten","dairy","eggs"]},{"price":20,"cat":"الحلى","name_ar":"كيكة ريد فيلفيت","name_en":"Red velvet cake","slug":"red-velvet-cake","calories":380,"allergens":["gluten","dairy","eggs"]},{"price":20,"cat":"الحلى","name_ar":"تشيز كيك زعفران","name_en":"Saffron cheesecake","slug":"saffron-cheesecake","calories":420,"allergens":["gluten","dairy","eggs"]},{"price":23,"cat":"الحلى","name_ar":"تشيز كيك سان سبستيان","name_en":"San Sebastian cheesecake","slug":"san-sebastian-cheesecake","calories":420,"allergens":["gluten","dairy","eggs"]},{"price":20,"cat":"الحلى","name_ar":"تشيز كيك تراميسو","name_en":"Tiramisu cheesecake","slug":"tiramisu-cheesecake","calories":420,"allergens":["gluten","dairy","eggs"]},{"price":13,"cat":"الحلى","name_ar":"ام علي","name_en":"Um Ali","slug":"um-ali","calories":400,"allergens":["gluten","dairy","eggs","tree_nuts"]},{"price":20,"cat":"الحلى","name_ar":"سينكرس","name_en":"Snickers Cake","slug":"snickers-cake","calories":430,"allergens":["gluten","dairy","eggs","peanuts","tree_nuts"]},{"price":20,"cat":"الحلى","name_ar":"كيكية العسل","name_en":"Honey Cake","slug":"honey-cake","calories":380,"allergens":["gluten","dairy","eggs"]},{"price":10,"cat":"الحلى","name_ar":"مكسرات","name_en":"Mixed Nuts","slug":"mixed-nuts","calories":350,"allergens":["gluten","dairy","eggs","tree_nuts","peanuts"]},{"price":15,"cat":"الحلى","name_ar":"منى بان كيك صغير","name_en":"Mona Pancake (Small)","slug":"mona-pancake-small","calories":520,"allergens":["gluten","dairy","eggs"]},{"price":28,"cat":"الحلى","name_ar":"منى بان كيك كبير","name_en":"Mona Pancake (Large)","slug":"mona-pancake-large","calories":780,"allergens":["gluten","dairy","eggs"]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"بلو بيري","name_en":"Blueberry","slug":"blueberry-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"شمام","name_en":"Cantaloupe","slug":"cantaloupe-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"تفاحتين فاخر","name_en":"Double Apple Fakhr","slug":"double-apple-fakhr-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"تفاحتين ثلجي","name_en":"Double Apple Ice","slug":"double-apple-ice-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"تفاحتين مكس","name_en":"Double Apple Mix","slug":"double-apple-mix-35","calories":null,"allergens":[]},{"price":45,"cat":"شيشة ٣٥ ريال","name_ar":"تفاحتين نخلة","name_en":"Double Apple Nkhla","slug":"double-apple-nkhla-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"عنب","name_en":"Grape","slug":"grape-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"عنب توت","name_en":"Grape Berry","slug":"grape-berry-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"عنب نعناع","name_en":"Grape Mint","slug":"grape-mint-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"كوكتيل جداوي فاخر","name_en":"Jeddawi Deluxe Cocktail","slug":"jeddawi-deluxe-cocktail-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"ليمون نعناع","name_en":"Lemon Mint","slug":"lemon-mint-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"نعناع","name_en":"Mint","slug":"mint-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"علكة مستكة","name_en":"Musk Gum","slug":"musk-gum-35","calories":null,"allergens":[]},{"price":25,"cat":"شيشة ٣٥ ريال","name_ar":"تغير راس","name_en":"Rass Change","slug":"rass-change-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"تغير راس نخلة","name_en":"tageer ras nakhla","slug":"tageer-ras-nakhla-35","calories":null,"allergens":[]},{"price":25,"cat":"شيشة ٣٥ ريال","name_ar":"تغير راس مكس","name_en":"tagree ras max","slug":"tagree-ras-max-35","calories":null,"allergens":[]},{"price":25,"cat":"شيشة ٣٥ ريال","name_ar":"تغير راس فاخر","name_en":"taqeer ras","slug":"taqeer-ras-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"كوكتيل وادي المسافر","name_en":"Wadi Al-Musafir Cocktail","slug":"wadi-al-musafir-cocktail-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"بطيخ","name_en":"Watermelon","slug":"watermelon-35","calories":null,"allergens":[]},{"price":35,"cat":"شيشة ٣٥ ريال","name_ar":"بطيخ نعناع","name_en":"Watermelon Mint","slug":"watermelon-mint-35","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"بلو بيري","name_en":"Blueberry","slug":"blueberry-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"شمام","name_en":"Cantaloupe","slug":"cantaloupe-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"تفاحتين فاخر","name_en":"Double Apple Fakhr","slug":"double-apple-fakhr-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"تفاحتين ثلجي","name_en":"Double Apple Ice","slug":"double-apple-ice-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"تفاحتين مكس","name_en":"Double Apple Mix","slug":"double-apple-mix-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"تفاحتين نخلة","name_en":"Double Apple Nkhla","slug":"double-apple-nkhla-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"عنب","name_en":"Grape","slug":"grape-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"عنب توت","name_en":"Grape Berry","slug":"grape-berry-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"عنب نعناع","name_en":"Grape Mint","slug":"grape-mint-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"كوكتيل جداوي فاخر","name_en":"Jeddawi Deluxe Cocktail","slug":"jeddawi-deluxe-cocktail-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"ليمون نعناع","name_en":"Lemon Mint","slug":"lemon-mint-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"نعناع","name_en":"Mint","slug":"mint-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"علكة مستكة","name_en":"Musk Gum","slug":"musk-gum-59","calories":null,"allergens":[]},{"price":25,"cat":"شيشة ٥٩ ريال","name_ar":"تغير راس","name_en":"Rass Change","slug":"rass-change-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"كوكتيل وادي المسافر","name_en":"Wadi Al-Musafir Cocktail","slug":"wadi-al-musafir-cocktail-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"بطيخ","name_en":"Watermelon","slug":"watermelon-59","calories":null,"allergens":[]},{"price":59,"cat":"شيشة ٥٩ ريال","name_ar":"بطيخ نعناع","name_en":"Watermelon Mint","slug":"watermelon-mint-59","calories":null,"allergens":[]},{"price":22,"cat":"الوجبات","name_ar":"وجبة برجر لحم","name_en":"Beef Burger Meal","slug":"beef-burger-meal","calories":820,"allergens":["gluten","eggs","dairy","sesame"]},{"price":22,"cat":"الوجبات","name_ar":"وجبة فاهيتا دجاج","name_en":"Chicken Fajita Meal","slug":"chicken-fajita-meal","calories":620,"allergens":["gluten","eggs","dairy","sesame"]},{"price":22,"cat":"الوجبات","name_ar":"وجبة ديك رومي","name_en":"Turkey Meal","slug":"turkey-meal","calories":560,"allergens":["gluten","eggs","dairy","sesame"]},{"price":28,"cat":"الوجبات","name_ar":"وجبة برجر دجاج","name_en":"Chicken Burger Meal","slug":"chicken-burger-meal","calories":750,"allergens":["gluten","eggs","dairy","sesame"]},{"price":10,"cat":"الوجبات","name_ar":"بطاطس","name_en":"Fries","slug":"fries","calories":350,"allergens":[]},{"price":10,"cat":"الوجبات","name_ar":"كرسون جبن شيدر","name_en":"Cheddar Croissant","slug":"cheddar-croissant","calories":360,"allergens":["gluten","dairy","eggs"]}]'::jsonb;

  v_sort := 0;
  v_cat_name := '';

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF (v_item->>'cat') IS DISTINCT FROM v_cat_name THEN
      v_cat_name := v_item->>'cat';
      v_sort := 0;
    END IF;

    v_cat_id := (v_cat_map->>v_cat_name)::uuid;
    v_item_id := gen_random_uuid();

    INSERT INTO public.menu_items
      (id, restaurant_id, category_id, slug, name_ar, name_en, sort, is_active, calories_kcal, allergens_json)
    VALUES
      (v_item_id, v_rid, v_cat_id, v_item->>'slug', v_item->>'name_ar',
       NULLIF(v_item->>'name_en',''), v_sort, true,
       NULLIF(v_item->>'calories','')::int,
       CASE WHEN jsonb_array_length(COALESCE(v_item->'allergens','[]'::jsonb)) > 0
            THEN v_item->'allergens' ELSE NULL END);

    v_price := (v_item->>'price')::numeric;
    INSERT INTO public.menu_item_variants
      (id, menu_item_id, variant_key, price, sort, is_active, calories_kcal)
    VALUES
      (gen_random_uuid(), v_item_id, 'single', v_price, 0, true, NULLIF(v_item->>'calories','')::int);

    v_sort := v_sort + 1;
  END LOOP;

  -- 4) Subscription (menu plan 500 SAR; ops logs the real payment, +100 for the addon)
  INSERT INTO public.subscriptions (id, restaurant_id, plan, status, amount_sar, current_period_start, current_period_end)
  VALUES (gen_random_uuid(), v_rid, 'yearly', 'pending_payment', 500, now(), now() + interval '1 year');

  -- 5) Default branch
  INSERT INTO public.restaurant_branches (id, restaurant_id, name_ar, slug, is_default, is_active, sort_order)
  VALUES (gen_random_uuid(), v_rid, 'الفرع الرئيسي', 'main', true, true, 0);

  -- 6) Paid addon: Google review QR (100 SAR)
  INSERT INTO public.subscription_addons (restaurant_id, addon_key, enabled, price_override_sar, notes)
  VALUES (v_rid, 'google_review', true, 100, 'خدمة QR تقييم Google — متفق عليها ضمن الباقة')
  ON CONFLICT (restaurant_id, addon_key) DO NOTHING;

  RAISE NOTICE 'Created wadi-almusafir with id: %', v_rid;
END $$;
