# Customer · KO-KO Chicky Licky

> **Slug:** `koko-chicky-licky`  
> **Status:** **first paying customer** — onboarding in progress  
> **Onboarded:** TBD  
> **Plan:** annual (499 SAR/year) × 2 instances? → confirm with owner  
> **Strategic role:** 🥇 **PROVES THE BUSINESS MODEL** — first real revenue

---

## 🎯 Why This Customer Matters

KO-KO is **the first customer who actually requested MenuLink** — not someone we approached. They want **two instances** (نسختين). This is huge proof that the product-market fit exists, and onboarding them right is critical because:

1. ✅ Their success → social proof for the next 5 customers
2. ✅ Their feedback → real-world signal (vs. our assumptions)
3. ✅ Two-instance setup → forces us to test multi-tenant architecture for real

**Do not treat this as a sandbox.** Treat it like a launch.

---

## 📋 Business Profile

- **Owner name:** [TBD — confirm]
- **Owner phone:** [TBD]
- **City / District:** Riyadh — Al-Rawdah, Abdul Rahman Al-Ghafiqi Road
- **Branch count:** [TBD — clarify what "نسختين" means]
- **Avg orders/day:** [TBD]
- **Languages:** Arabic primary
- **Cuisine:** Broasted chicken, burgers, sandwiches, sides
- **Found us via:** Direct request (warm lead — owner approached the user)

## ❓ The "Two Instances" Question (RESOLVE FIRST)

The owner requested **نسختين من MenuLink** ("two copies of MenuLink"). Before doing anything else, clarify what this means:

| Interpretation | Implication |
|---------------|-------------|
| **A. Two branches** — same brand, different locations | 2 PWAs at `koko-1.menulink.app` and `koko-2.menulink.app`, shared admin |
| **B. Two brands** — totally separate concepts under same ownership | 2 fully independent setups, different WhatsApp numbers, different menus |
| **C. Arabic + English versions** | 1 PWA with language toggle (already supported in v6) — owner may not need 2 |
| **D. Test + Production** | Owner wants to experiment before going live → start with 1 |

**Action:** Call/WhatsApp owner first thing. **Don't build 2 of anything until this is answered.**

Quick script to use:
> "أهلاً، قبل ما نبدأ — قصدك في النسختين الفرعَين الاثنين، أو ايش بالضبط؟ ابغى أتأكد عشان نبني صح من البداية."

## 🔗 Live URLs (Plan)

- **PWA 1:** https://koko.menulink.app *(or `koko-rawdah` if multi-branch)*
- **PWA 2:** TBD (depends on the answer above)
- **Admin:** https://admin.menulink.app/koko-chicky-licky
- **WhatsApp 1:** [TBD]
- **WhatsApp 2:** [TBD if applicable]

## 🔌 POS Integration

- **POS system:** ❓ **TBD** — ask owner
- **Integration tier:** 0 (WhatsApp only) by default; upgrade only if owner asks
- **Status:** not started

**Important:** KO-KO does NOT use RzRz (that's a different restaurant — see `rzrz-restaurant.md`). Don't conflate them. If KO-KO uses Foodics, Marn, or no POS at all, build accordingly.

## 🎨 Brand

- **Primary color:** Red — `#D32027` (matches the rooster logo)
- **Background:** Cream — `#FAF6EE`
- **Logo:** Rooster head, red on cream — already designed
- **Theme:** Light, warm, friendly (Burgerizzr-inspired aesthetic)
- **Menu structure (confirmed from v6):** 7 categories
  - بروستد · تندر · برجر · تويستر · أصناف جانبية · صوصات · مشروبات
- **Pricing labels:** "٤ قطع" for broasted/tender (not "قطعة")
- **Add-on rule:** "أي قطعة إضافية ٤ ريال"
- **Tagline:** "طعم ما تقدر تقاومه! 🔥"

## 📊 Performance (After Launch)

> Establish baselines once first 30 days run. Track:
> - Orders/day
> - Revenue/day via MenuLink
> - WhatsApp message volume
> - Conversion rate (PWA visits → completed orders)

## ⚠️ Quirks & Notes

- **First paying customer** — handle with extra care, don't break things
- **Brand consistency** — already have v6 PWA with proper KO-KO branding (in `current-state/pwa-starter/`). Use it as the starting point, don't rebuild from scratch.
- **Multi-instance billing** — figure out billing structure for 2 instances:
  - Option 1: Charge 499 × 2 = 998 SAR/year
  - Option 2: Discount the second instance (e.g., 499 + 299 = 798 SAR/year)
  - Option 3: Treat both as one account, charge once
  - **Decision pending** — depends on whether they're branches (option 3) or separate brands (option 1/2)

## 🚧 Open Tasks

- [ ] **Clarify "نسختين"** with owner (see decision tree above) ⚠️ blocker
- [ ] Confirm owner name and contact number
- [ ] Confirm WhatsApp number(s) for orders
- [ ] Ask about POS system (if any)
- [ ] Settle on pricing structure for 2 instances
- [ ] Deploy first PWA to Manus.space or Netlify
- [ ] Generate QR codes for tables
- [ ] Train owner on the admin dashboard (when built)
- [ ] If multi-branch: setup multi-tenant routing (Phase 5 brought forward)

## 📜 Activity Log

### 2026-04-18 · Discovery & Design
- User shared real menu data, photos, branding
- Built PWA v1 through v6 iteratively
- v6 includes: full menu, sales-style design, map, WhatsApp send, PWA install, offline support
- Ready to deploy when owner confirms details

### 2026-05-18 · Pricing & Plans Decided
- Annual plan: 499 SAR/year (saves ~209 SAR vs monthly)
- Monthly: 59 SAR
- Multi-instance pricing: TBD pending clarification

### YYYY-MM-DD · Onboarding Call (planned)
Will document outcome of the 2-instance clarification here.

### 2026-05-23 · Photo Audit + Replace
- Reviewed all 30 photos at `apps/web/public/menu/koko/*.jpeg` (decoded from the v6 base64 dump). Found ~12 misleading: `tender_spicy` showed a single drumstick, `twister_maple` showed Caesar wraps, `sauce_cheese` showed chopped herbs, `sauce_bbq` showed tomato puree, several "tender" photos were actually Nashville-style or completely unrelated, and the sauces (KOKO, Cheddar, BBQ, Ranch, Jal) were all generic multi-sauce platter stock shots.
- Replaced 10 photos from Pexels + Unsplash (both CC0, commercial use): tender_nashville, tender_spicy, tender_jalapeno, twister_maple, side_chicken_bites, side_chicken_fries, sauce_koko, sauce_cheese, sauce_bbq, sauce_jal.
- Added 2 NEW dedicated files (previously fell back to unrelated sauces): `sauce_garlic.jpeg` (creamy white toum with garlic cloves) and `sauce_hummus.jpeg` (chickpea hummus with parsley). Updated `koko-images.ts` `IMG` record + `SLUG_TO_IMG` map.
- **Did NOT touch:** primary_color `#D32027`, logo_url, cover_image_url, background_color, restaurant name, slug, menu data (categories/items/prices). Per user direction "keep KO-KO color logo cover as it is".
- **Files NOT replaced (visually OK):** broasted_*, burger_*, all drinks, hero, tender_regular, twister_regular, twister_spicy, side_fries, side_cheese_fries, side_coleslaw, sauce_ranch, sauce_generic.
- Discovered the v6 photo filenames were misleading in general — `broasted_regular.jpeg` shows fried chicken with a chili pepper next to it (visually "spicy") and `broasted_spicy.jpeg` shows plain fried chicken (visually "regular"). The `SLUG_TO_IMG` map was already compensating; added clarifying comments so future maintainers don't "fix" the correct mapping.

---

## 🎯 Definition of "Live"

KO-KO is officially live when:
- [x] v6 PWA built ← done
- [ ] Owner confirmed details (name, phone, WhatsApp, instance count)
- [ ] PWA(s) deployed on real subdomain
- [ ] Owner trained on receiving orders via WhatsApp
- [ ] First real customer order placed
- [ ] First payment received (proves the model)
- [ ] 7 days of clean operation
