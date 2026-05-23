/**
 * KO-KO Chicky Licky · food-photo URL map.
 *
 * Images decoded from v6 base64 to apps/web/public/menu/koko/.
 * Browser caches them as static assets, no bundle bloat.
 *
 * SLUG_TO_IMG maps menu_items.slug to the URL the customer PWA renders.
 * When menu_items.image_url is set in the DB, use that instead.
 */

export const IMG: Record<string, string> = {
  broasted_jalapeno: '/menu/koko/broasted_jalapeno.jpeg',
  broasted_nashville: '/menu/koko/broasted_nashville.jpeg',
  broasted_regular: '/menu/koko/broasted_regular.jpeg',
  broasted_spicy: '/menu/koko/broasted_spicy.jpeg',
  burger_crispy: '/menu/koko/burger_crispy.jpeg',
  burger_maple: '/menu/koko/burger_maple.jpeg',
  burger_nash: '/menu/koko/burger_nash.jpeg',
  drink_cola: '/menu/koko/drink_cola.jpeg',
  drink_oj: '/menu/koko/drink_oj.jpeg',
  drink_water: '/menu/koko/drink_water.jpeg',
  hero: '/menu/koko/hero.jpeg',
  sauce: '/menu/koko/sauce.jpeg',
  sauce_bbq: '/menu/koko/sauce_bbq.jpeg',
  sauce_cheese: '/menu/koko/sauce_cheese.jpeg',
  sauce_generic: '/menu/koko/sauce_generic.jpeg',
  sauce_jal: '/menu/koko/sauce_jal.jpeg',
  sauce_koko: '/menu/koko/sauce_koko.jpeg',
  sauce_ranch: '/menu/koko/sauce_ranch.jpeg',
  sauce_garlic: '/menu/koko/sauce_garlic.jpeg',
  sauce_hummus: '/menu/koko/sauce_hummus.jpeg',
  side_cheese_fries: '/menu/koko/side_cheese_fries.jpeg',
  side_chicken_bites: '/menu/koko/side_chicken_bites.jpeg',
  side_chicken_fries: '/menu/koko/side_chicken_fries.jpeg',
  side_coleslaw: '/menu/koko/side_coleslaw.jpeg',
  side_fries: '/menu/koko/side_fries.jpeg',
  tender_jalapeno: '/menu/koko/tender_jalapeno.jpeg',
  tender_nashville: '/menu/koko/tender_nashville.jpeg',
  tender_regular: '/menu/koko/tender_regular.jpeg',
  tender_spicy: '/menu/koko/tender_spicy.jpeg',
  twister_maple: '/menu/koko/twister_maple.jpeg',
  twister_regular: '/menu/koko/twister_regular.jpeg',
  twister_spicy: '/menu/koko/twister_spicy.jpeg',
};

// NB: `broasted_regular` and `broasted_spicy` files were swapped in the v6
// PWA's base64 dump — the file named "regular" shows a chili pepper next to
// the chicken (spicy intent) and "spicy" shows plain-fried chicken. The maps
// below use the FILE that visually matches the slug, not the misleading file
// name. Same reasoning for tn-hot.
export const SLUG_TO_IMG: Record<string, string> = {
  'br-reg': IMG.broasted_spicy,        // file misnamed: shows plain-fried chicken
  'br-hot': IMG.broasted_regular,      // file misnamed: shows chicken + chili pepper
  'br-jal': IMG.broasted_jalapeno,
  'br-nash': IMG.broasted_nashville,
  'tn-reg': IMG.tender_regular,
  'tn-hot': IMG.tender_spicy,
  'tn-jal': IMG.tender_jalapeno,
  'tn-nash': IMG.tender_nashville,
  'bg-crispy': IMG.burger_crispy,
  'bg-maple': IMG.burger_maple,
  'bg-nash': IMG.burger_nash,
  'tw-reg': IMG.twister_regular,
  'tw-hot': IMG.twister_spicy,
  'tw-maple': IMG.twister_maple,
  'sd-cf': IMG.side_chicken_fries,
  'sd-chf': IMG.side_cheese_fries,
  'sd-fries': IMG.side_fries,
  'sd-cb': IMG.side_chicken_bites,
  'sd-slaw': IMG.side_coleslaw,
  'sc-koko': IMG.sauce_koko,
  'sc-ched': IMG.sauce_cheese,
  'sc-spec': IMG.sauce_generic,
  'sc-bbq': IMG.sauce_bbq,
  'sc-ranch': IMG.sauce_ranch,
  'sc-jal': IMG.sauce_jal,
  'sc-garlic': IMG.sauce_garlic,        // new dedicated file (replaces ranch fallback)
  'sc-hummus': IMG.sauce_hummus,        // new dedicated file (replaces BBQ fallback)
  'dr-cola-s': IMG.drink_cola,
  'dr-cola-l': IMG.drink_cola,
  'dr-oj-s': IMG.drink_oj,
  'dr-oj-l': IMG.drink_oj,
  'dr-water': IMG.drink_water,
};
