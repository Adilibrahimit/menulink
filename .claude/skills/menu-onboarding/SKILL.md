---
name: menu-onboarding
description: Import a restaurant's full menu into MenuLink — items, photos, calorie data (SFDA-compliant), allergen tags, and POS item mapping. Use this skill when the user wants to add menu items for a new or existing tenant, when they share a menu photo/PDF/text list to be imported, when they mention "import menu", "add items", "menu setup", food photos to upload, calorie estimation, allergen tagging, or SFDA nutritional data for a restaurant. Also use when bulk-updating calories or allergens across a tenant's menu. This skill prevents the repeat mistakes documented in menulink-integration/learnings.md — always read it first.
---

# Menu Onboarding Skill

Import a restaurant's entire menu into MenuLink in one session: categories, items, variants, photos, SFDA-compliant calorie data, allergen tags, and optional POS item mapping. Designed for speed on new tenant setup and accuracy on nutritional data.

---

## Before You Start

1. **Read `menulink-integration/learnings.md`** — especially:
   - `LRN-2026-05-23-postgrest-batch-key-consistency` — ALL objects in a batch INSERT must have identical keys
   - `LRN-2026-05-23-v6-to-v7-photo-filenames-misleading` — never trust photo filenames
   - `LRN-2026-05-23-rzrz-pos-id-mapping-via-items-dump` — never trust hand-prepped POS IDs
   - `LRN-2026-05-23-sb-secret-rejected-by-storage` — use legacy JWT for Storage uploads
2. **Identify the restaurant** — read `menulink-integration/customers/<slug>.md` if it exists
3. **Get the Supabase PAT** from the user if you need Management API access

---

## Input Formats

The owner may provide the menu as any of these. Handle all:

| Format | How to process |
|--------|---------------|
| Photos of a paper menu | Read the image, OCR/transcribe each item. Group by visual sections. |
| PDF menu | Read pages, extract text. Same grouping logic. |
| WhatsApp text list | Parse lines. Common patterns: category as a header, items below with prices. |
| Excel/CSV | Read rows. Map columns to name_ar, price, category. |
| Verbal description | Ask structured questions: categories, items per category, variants, prices. |
| Existing POS item dump | If RzRz: SELECT ItemID, ItemName_A, Rate FROM Items. Cross-reference. |

---

## The Import Pipeline

### Step 1: Extract and Structure

Parse the input into a normalized intermediate format:

```
categories:
  - name_ar: "مشويات"
    emoji: "🍖"
    items:
      - name_ar: "دجاج مشوي"
        description_ar: "نصف دجاجة مشوية على الفحم"
        variants:
          - key: "half", label_ar: "نصف", price: 35
          - key: "full", label_ar: "كامل", price: 65
```

Validate with the user: "I found X categories and Y items. Does this look right?"

### Step 2: Estimate Calories (SFDA Compliance)

Every item needs `calories_kcal`. Saudi SFDA mandates calorie disclosure on all menus including digital (effective July 1, 2025).

**Estimation by food type:**

| Food type | kcal range | Typical |
|-----------|-----------|---------|
| Grilled chicken (half) | 400-500 | 450 |
| Grilled chicken (full) | 800-1000 | 900 |
| Fried/broasted (piece) | 250-350 | 300 |
| Kabsa/rice plate (full) | 800-1100 | 950 |
| Burger | 450-600 | 520 |
| Wrap/tortilla | 380-500 | 430 |
| Fries (regular) | 250-320 | 280 |
| Hummus (bowl) | 120-180 | 150 |
| Salad (no dressing) | 60-120 | 90 |
| Sauce (portion) | 40-120 | 80 |
| Kunafa/sweets | 300-450 | 350 |
| Cola (330ml) | 130-150 | 140 |
| Fresh juice (300ml) | 100-140 | 120 |
| Water | 0 | 0 |

For items outside these categories, use WebSearch for standard calorie data.

**Per-variant calories**: If variants represent portion sizes (half/full, small/large), scale proportionally. Set `menu_item_variants.calories_kcal` for each.

### Step 3: Assign Allergens

The 14 SFDA-mandatory allergens (stored as jsonb array in `allergens_json`):

```
gluten, dairy, eggs, fish, shellfish, peanuts, tree_nuts,
soy, sesame, celery, mustard, sulfites, lupin, mollusks
```

**Common allergen patterns for Saudi restaurant food:**

| Food type | Typical allergens |
|-----------|------------------|
| Breaded/fried chicken | gluten, eggs |
| Burger (with bun) | gluten, eggs, dairy, sesame |
| Wraps/tortillas | gluten, eggs, dairy |
| Caesar salad | dairy, gluten, eggs, fish (anchovy) |
| Hummus/mutabbal | sesame (tahini) |
| Tabbouleh | gluten (bulgur) |
| Ranch/mayo sauces | eggs, dairy |
| Kunafa/pastries | gluten, dairy, tree_nuts |
| Rice dishes (plain) | usually none |
| Grilled meats (plain) | usually none |
| Kebab with spice mix | sometimes gluten (flour binder) |
| Madghoot/saleeq | dairy (ghee/cream) |

Err on the side of tagging — the owner removes false positives from the admin panel. Missing a real allergen is worse than a false alarm.

### Step 4: Upload Photos

Photos go to Supabase Storage bucket `menu-images`.

**Path pattern:** `<restaurant_id>/<item_id>-<random>.<ext>`

**Critical rules:**
- Use the **legacy JWT** (not sb_secret) for Storage uploads — new key format returns 403
- Get the legacy key via Management API: `GET /v1/projects/{ref}/api-keys?reveal=true`
- Max 5 MB, accepted types: jpeg, png, webp
- **Visually audit every photo** against its item name. Owner filenames are frequently wrong.
- Stock photos: Pexels or Unsplash (CC0). No alcohol or non-halal content for Saudi tenants.

### Step 5: Insert to Database

**Order:** categories -> items -> variants -> pos_item_map (optional)

**Batch INSERT rules (PostgREST):**
- ALL objects in the array MUST have identical keys
- Include every column key, use null for absent values
- PostgREST is NOT atomic — partial inserts are possible
- For PowerShell: use [ordered] hashtables to preserve key order

### Step 6: Verify

After import, open `https://menulink-admin-five.vercel.app/m/<slug>` and check:
- All categories in correct order
- All items under correct categories with correct prices
- Photos load (no 404s)
- Calorie badges render on each card
- Allergen text appears on tagged items
- SFDA reference footer visible at bottom

---

## Sodium and Caffeine

- **Sodium** (sodium_mg): SFDA requires a salt icon for items above 2000mg sodium. Set when owner provides data or item type is known high-sodium.
- **Caffeine** (caffeine_mg): Required for beverages. Cola = 34mg/330ml. Coffee = 80-120mg/cup. Tea = 30-50mg/cup.

---

## Quick Checklist

```
Menu Import: [Restaurant Name]
- [ ] Input received and parsed
- [ ] Categories identified: ___ count
- [ ] Items identified: ___ count
- [ ] Variants identified: ___ count
- [ ] Calories estimated for all items
- [ ] Allergens assigned for all items
- [ ] Photos sourced: ___ of ___ items
- [ ] Photos visually audited
- [ ] DB inserts: categories, items, variants
- [ ] Photos uploaded to Storage
- [ ] POS item mapping (if applicable)
- [ ] Customer PWA verified
- [ ] Owner confirmed menu complete
```

---

## Common Mistakes This Skill Prevents

1. **Uploading with sb_secret** — 403. Use legacy JWT for Storage.
2. **Trusting photo filenames** — wrong food on wrong item. Always visually audit.
3. **Conditional keys in batch INSERT** — PGRST102. Always include all keys with null defaults.
4. **Trusting hand-prepped POS IDs** — wrong mapping. Verify against live POS.
5. **Skipping calorie data** — SFDA non-compliance. Always estimate.
6. **Missing allergens on breaded items** — at minimum gluten + eggs on every fried item.
7. **Cross-category photo collision** — name-based photo matching (`apply-photos`) keys by dish NAME, not category, so a juice "Lemon Mint" grabs the shisha "Lemon Mint" hookah photo. **Screenshot every category after applying** and eyeball each photo; fix wrong ones (override `image_url` + correct the library folder) before publish.
8. **Faint/tiny bilingual English** — if the theme is bilingual, the English name must render under the Arabic AND be legible on a phone (not a thin small serif). Verify on the live `/m/<slug>`.
9. **Dirty POS names shipped verbatim** — exports carry OCR/typo garbage (`COIF kAs` = كوب قهوة سعودية), language in the wrong column, redundant tier numbers. Clean BOTH `name_ar` and `name_en` before insert; confirm ambiguous ones with the owner. See `references/saudi-cafe-glossary.md`.
10. **Literal/Western reading of Saudi-café terms** — `براد` is a teapot not a cup; plain `شاي` is red tea not lemon; `هوت X` is a hot drink not a cookie; `حليب` on a drinks list is hot milk not bottles; `كركديه` is red iced tea not a flower; `موهيتو` is a halal mocktail (never a liquor cocktail). Pick photos by **meaning** — glossary above.
11. **«معسّل» reads as fruit** — shisha cards using fruit imagery (to match a poster) must carry a «معسّل»/shisha badge so customers don't think it's real fruit or a fruit salad. (Owner-requested on Wadi.)
12. **Alcohol in stock photos** — a "<fruit> drink/cocktail" stock query returns real cocktails with a liquor bottle in frame (a tequila bottle reached a كركديه card before review caught it). Use `gapfill-photos.mjs` (Pexels) and **Read its review montage** before `--apply`. Halal only.

## Pre-publish checklist (run before flipping `is_published`)
- [ ] Every food/drink item has `calories_kcal` (🔥 renders live); shisha/tobacco null/exempt.
- [ ] Allergens on desserts/meals/milk-drinks/fried items.
- [ ] Bilingual EN legible under AR on a phone-width screenshot (if bilingual).
- [ ] **Screenshot every category** and eyeball each photo: right dish, right category (name
      collisions), **no alcohol/bottles**, right form (drink not flower/cookie), Saudi-café terms
      correct (teapot vs cup, hot vs cold). See `menulink-photo-catalog/references/image-search.md`.
- [ ] Names cleaned (no POS garbage); prices correct; categories ordered.
- [ ] SFDA daily-reference + allergen-disclaimer footer renders.
