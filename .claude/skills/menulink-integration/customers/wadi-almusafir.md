# Customer · Wadi Almusafir (وادي المسافر)

> **Slug:** `wadi-almusafir`
> **Status:** live (display-only / menu-QR)
> **Onboarded:** 2026-06-28
> **Plan:** annual — 500 SAR menu QR + 100 SAR Google-review service = **600 SAR** (subscription `pending_payment`; ops logs the real payment)

> ⚠️ **NOT** related to **Mazaj Almosafer** (مزاج المسافر). Similar Arabic name, completely separate business / tenant. Do not cross-wire menus, photos, themes, or WhatsApp numbers.

---

## 📋 Business Profile

- **Type:** مقهى ولاونج (shisha café-lounge)
- **Owner phone / WhatsApp:** 0563200133 (966563200133)
- **City / District:** الرياض · العوالي (نجم الدين الأيوبي، الرياض 11234 · "مخرج ٢٦")
- **Branch count:** 1 (single page, default branch)
- **Languages:** Arabic + English (bilingual menu)
- **Cuisine:** shisha + specialty coffee + drinks + desserts
- **Instagram:** @wadi_almusafir
- **Google Maps:** CID `3853015978050978663` (feature `0x3e2f1126ed7037a9:0x3578a99e2da20367`)

## 🔗 Live URLs

- **PWA (menu):** https://menulink-admin-five.vercel.app/m/wadi-almusafir
- **Google review link:** https://www.google.com/maps?cid=3853015978050978663
- **WhatsApp:** +966563200133 (display-only; no ordering)

## 🔌 POS Integration

- **POS system:** None integrated (their menu came from a **Baladi POS** Item Report export — `docs/clients/wadi-almusafir/wadi-almusafir.xlsx`)
- **Integration tier:** 0 (menu display only)

## 🎨 Brand / Design

- **Design:** bespoke **`wadi-lounge`** theme — faithful pixel-close replica of the client's own poster.
  - Tokens: canvas `#0B0805`, gold `#D9B65C`, parchment `#F3E9D6`. `lib/themes.ts → WADI_LOUNGE_THEME`, registered in `lib/design-library.ts` (key `wadi-lounge`).
  - Layout: `app/m/[slug]/wadi-lounge-menu.tsx` (display-only, bilingual, dark+gold Arabesque-framed cards, **hexagonal "السعر/٣٥/ريال" price badges**, 🔥 calorie badges, top Google-review banner, SFDA footer).
- **Logo:** WM gold emblem — cropped from the client's poster (image 2), background made transparent, stored at `menu-images/<rid>/brand/logo.webp`.
- **menu_design_key:** `wadi-lounge` (set on the row → resolves the bespoke theme).

## 🆕 New platform feature shipped with this client

**Google-review QR service** (sellable addon, 100 SAR):
- Migration `0075_google_review_service.sql`: adds `restaurants.google_review_url`, recreates `get_public_menu` to expose it, registers `addon_catalog` key `google_review` (growth, 100 SAR). `AddonKey` union extended in `lib/addons.ts`.
- Tenant migration `0076_wadi_almusafir_tenant.sql`: sets `google_review_url`, enables the `google_review` addon (`subscription_addons`, price_override 100).
- In-menu banner renders when `google_review_url` is set. Dual-QR poster style added to `lib/menu-qr-poster.ts` (`posterStyle:'wadi-dual'`).
- **Deliverables:** `docs/clients/wadi-almusafir/deliverables/` → `qr-menu.png`, `qr-google-review.png`, `poster-dual-qr.png`.

## 🍽️ Menu

- **137 items / 8 categories**: cold-drinks (27), hot-drinks (31), mojito (10), juices (13), desserts (13), **shisha-35 (20)**, **shisha-59 (17)**, meals (6).
- Two shisha price tiers (35 / 59 SAR) modeled as **two categories** (head-change items kept inside, per the POS) — same precedent as Mazaj Rawdah's 34/39 split.
- Shisha display names cleaned: stripped leading "شيشة " + trailing tier number (slugs keep `-35`/`-59` for uniqueness + better photo matching).
- **Calories:** SFDA values on every food/drink item (shisha + head-change exempt = null). 100% non-shisha coverage.
- **Allergens:** desserts/meals/milk-drinks tagged. Caffeine/sodium not set (not rendered on display-only themes — matches platform).

## 📸 Photos

- ~121/137 with photos. **Shisha section = flavor imagery** (grapes, mint, apple, watermelon, gum, palm) to match the client's poster — replaced generic hookah stock and **fixed the lemon-mint / watermelon name-collision** (shisha pulling drink photos).
- Library matches via `apply-photos.mjs` + Unsplash gap-fill (`scratchpad/wadi-gapfill.mjs` pattern, adapted from `coffee-secret-unsplash-gapfill.mjs`).
- **Remaining ~16 NULL** (cold sodas, hibiscus flavors, milkshake-oreo, matcha, milk, karak, mint tea, isfahani) → show the gold ۞ fallback; finish via an Unsplash resume once the 50/hr window resets.

## ⚠️ Quirks & Notes

- **Name collision risk** with Mazaj Almosafer — always double-check the slug `wadi-almusafir`.
- The client's poster (image 2) is OLD / from another company — its 2 QR codes are stale; our `poster-dual-qr.png` is the refreshed replacement.
- Bespoke design + new google_review feature are **local-only until deployed** — prod Vercel still serves the default theme for this slug until the frontend is pushed/deployed.

## 🚧 Open Tasks

- [ ] **Deploy frontend** (push → Vercel) so the prod URL renders the `wadi-lounge` design (DB + migrations already applied to prod).
- [ ] Resume Unsplash gap-fill for the remaining ~16 drink photos.
- [ ] Ops: log the 600 SAR payment → flip subscription to `active`.
- [ ] Hand the owner the QR deliverables + the new poster.

## 📜 Activity Log

### 2026-06-28 · Initial onboarding
Built bespoke `wadi-lounge` theme/layout, imported 137 items (calories+allergens) via migration 0076, shipped the new `google_review` service (migration 0075 + banner + dual-QR poster), applied to prod DB, cropped+uploaded logo, gap-filled photos (shisha→flavor imagery, fixed collisions), generated QR deliverables, live-audited the design (3 SFDA gates pass). Pending: frontend deploy + payment logging + photo resume.
