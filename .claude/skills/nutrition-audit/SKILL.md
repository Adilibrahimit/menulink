---
name: nutrition-audit
description: Audit a MenuLink tenant's menu for SFDA nutritional compliance — calories, allergens, sodium, caffeine, and food safety disclosures. Use this skill when the user asks to check nutrition data, audit SFDA compliance, verify calorie accuracy, review allergen tags, run a food safety check, or do a "menu health check" on any tenant. Also use proactively after importing a menu via the menu-onboarding skill to catch gaps before go-live. Triggers on phrases like "check calories", "nutrition audit", "SFDA check", "allergen review", "food safety", "compliance report", or when the user mentions that a tenant's menu data might be incomplete or inaccurate.
---

# Nutrition Audit Skill

Run a compliance audit on a MenuLink tenant's menu to verify SFDA nutritional requirements are met. Generates a scored report with specific action items. Designed to run after menu import and periodically as a health check.

---

## SFDA Requirements (Effective July 1, 2025)

Saudi Food and Drug Authority mandates for ALL food establishments including digital menus:

| Requirement | DB Field | Rule |
|-------------|----------|------|
| Calorie count per item | calories_kcal | Must be set on every active item |
| 14 allergen disclosure | allergens_json | Must be reviewed for every item |
| High-sodium flag | sodium_mg | Show salt icon when above 2000mg |
| Caffeine content | caffeine_mg | Required for all beverages |
| Daily reference footer | (code) | Men 2500 / Women 2000 / Children 1400-2000 |
| Allergen disclaimer | (code) | Cross-contamination warning |

---

## Running the Audit

### Step 1: Fetch Menu Data

Query all active menu items for the tenant via Management API or supabase-server:

```sql
SELECT mi.id, mi.slug, mi.name_ar, mi.calories_kcal, mi.sodium_mg,
       mi.caffeine_mg, mi.allergens_json, mi.is_active,
       mc.name_ar as category_name
FROM menu_items mi
JOIN menu_categories mc ON mc.id = mi.category_id
WHERE mc.restaurant_id = '<restaurant_id>'
  AND mi.is_active = true AND mc.is_active = true
ORDER BY mc.sort, mi.sort;
```

### Step 2: Run Checks

**Check 1: Calorie Coverage (CRITICAL)**
Every active item must have calories_kcal set and greater than 0 (except water = 0).

**Check 2: Calorie Plausibility (WARNING)**
Cross-reference against the reference database (menu-onboarding/references/calorie-database.md). Flag items outside expected ranges for their food type.

| Category pattern | Expected kcal range |
|-----------------|-------------------|
| Grilled chicken | 400-1000 |
| Fried/broasted | 200-400 per piece |
| Rice plate | 700-1100 |
| Burger | 400-700 |
| Wrap | 300-600 |
| Fries/sides | 100-500 |
| Salad | 50-200 |
| Sauce | 20-150 |
| Dessert | 150-500 |
| Water | exactly 0 |
| Soft drink | 100-300 |

**Check 3: Allergen Completeness (HIGH)**
For each item, check food-type heuristics:

| Name contains | Expected allergens |
|--------------|-------------------|
| بروستد, مقلي, كرسبي (fried) | gluten, eggs |
| برجر (burger) | gluten, sesame, eggs |
| تويستر, شاورما (wraps) | gluten |
| جبن, شيدر, قشطة (cheese/cream) | dairy |
| حمص, متبل (hummus) | sesame |
| تبولة (tabbouleh) | gluten |
| كنافة, أم علي (sweets) | gluten, dairy, tree_nuts |
| رانش, مايو (sauces) | eggs, dairy |

Flag items matching a pattern but missing expected allergens.

**Check 4: Caffeine for Beverages (MEDIUM)**
Items in drinks/beverages categories should have caffeine_mg set. Cola, coffee, tea, energy drinks need a value above 0.

**Check 5: SFDA Footer Rendering (CRITICAL)**
Verify the customer PWA at /m/<slug> renders the daily reference and allergen disclaimer footer. This is a code check (should always pass after migration 0024).

### Step 3: Score

```
score = weighted_passed / weighted_total * 100

Weights: CRITICAL = 3x, HIGH = 2x, MEDIUM = 1x, LOW = 0.5x

95-100%: Fully compliant
80-94%:  Minor gaps
60-79%:  Significant gaps, fix before go-live
Below 60%: Not ready
```

### Step 4: Generate Report

```
SFDA Nutrition Audit: [Restaurant Name]
Date: YYYY-MM-DD | Score: XX%

CRITICAL:
- [list items missing calories]

WARNINGS:
- [list plausibility issues]
- [list missing allergens]

RECOMMENDATIONS:
- [sodium/caffeine gaps]
- [items to verify with owner]

Summary: X of Y items fully compliant
```

### Step 5: Fix

- Missing calories: estimate from calorie-database.md reference, apply via SQL
- Missing allergens: assign from heuristic table, apply via SQL
- Plausibility warnings: flag for owner (do not auto-correct custom values)

---

## The 14 SFDA Allergens

| Key | Arabic | Icon |
|-----|--------|------|
| gluten | جلوتين (قمح) | 🌾 |
| dairy | حليب ومشتقاته | 🥛 |
| eggs | بيض | 🥚 |
| fish | أسماك | 🐟 |
| shellfish | قشريات | 🦐 |
| peanuts | فول سوداني | 🥜 |
| tree_nuts | مكسرات | 🌰 |
| soy | صويا | 🫘 |
| sesame | سمسم | ⚫ |
| celery | كرفس | 🥬 |
| mustard | خردل | 🟡 |
| sulfites | كبريتات | 🧪 |
| lupin | ترمس | 🌱 |
| mollusks | رخويات | 🦑 |
