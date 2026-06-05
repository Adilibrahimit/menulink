# KO-KO "Modern Delivery App" menu design — spec

**Date:** 2026-05-31
**Tenant:** new `koko-test` clone (production `koko` / id `1111…` untouched)
**Design key:** `delivery-modern`
**Quality bar (user, verbatim intent):** premium, crafted, *not* generic "AI slop". Real
iconography (no emojis), varied layout rhythm (no monotonous color grid), real
micro-interactions, typography/space as hierarchy.

## Concept

The Uber Eats / Cava ordering language: a calm light canvas, KO-KO red as a *controlled*
accent, a crafted inline-SVG icon set, and a varied layout rhythm. This is a new
layout + visual system over the existing backend — cart, checkout, loyalty, push,
order-type, table mode, SFDA all reused unchanged.

## Layout (mobile-first, top → bottom)

1. **Slim sticky app bar** — logo + name (right, RTL); SVG action icons (search, account,
   cart + count) left. Goes from transparent over the hero to a frosted white bar on scroll.
2. **Featured rail** — swipeable snap carousel, 2–3 hero dishes (full-bleed photo, name,
   price, quick-add). Data-driven: items flagged premium/hot with a photo, else top items.
3. **Category rail** — horizontal scroll chips, each a small line-SVG icon + label; sticky
   under the app bar; active chip gets a sliding underline driven by scroll-spy.
4. **Sections, mixed rhythm** (the anti-"color-grid" move):
   - First / "popular" category → horizontal scroll cards (compact, photo-forward).
   - Remaining categories → **list rows**: photo (right, RTL), name + 1-line description +
     price, round red "+". The real delivery-app pattern; far more app-like than 2-col tiles.
5. **Item tap → bottom sheet** = existing `ItemCustomizerSheet` (variants/modifiers).
   Single-variant rows quick-add the "+" with a count-bump animation.
6. **Sticky cart pill** — "السلة · N · total ﷼", springs in when cart non-empty; opens the
   existing light `CartDrawer` checkout.
7. **SFDA calorie + 14-allergen footer** — preserved, restyled clean (no emoji headers).

## Visual system

- **Color:** base stone `#F7F6F3`; surface `#FFFFFF`; ink `#191512`; muted `#6F6A64`;
  accent (brand) `#D32027`; accent-pressed `#B51B22`; hairline `rgba(20,16,12,0.07)`;
  success/calorie chips warm-neutral. Soft low shadows only; generous radii (cards 20px,
  pills full, sheet 24px top).
- **Type:** Tajawal for Arabic display + body on a tighter modern scale (display 700–800,
  body 400–500, captions 500); Plus Jakarta Sans for Latin + tabular prices. Hierarchy via
  size/weight/space, never via decorative bars or star bullets.
- **Iconography:** new `app/m/[slug]/icons.tsx` — small inline stroke-SVG set
  (drumstick, burger, fries, drink, dessert, ricebowl, sandwich, default-utensil for
  categories; home/search/bag/user/bell/plus/chevron for chrome). Category → icon mapped by
  Arabic/English keyword with a safe default. 1.5px stroke, currentColor.

## Motion

Card/row press-scale (0.97), sheet slide-up, sticky-cart spring-in, section scroll-reveal
(fade+rise via IntersectionObserver), category-underline slide. All transform/opacity;
fully disabled under `prefers-reduced-motion`.

## Architecture / files

- `lib/themes.ts` — extend `menuLayout` union with `"delivery-modern"` (+ `menuCardStyle`
  if needed).
- `lib/design-library.ts` — `DELIVERY_MODERN_THEME` + library entry (light tokens above,
  fonts, `menuLayout: "delivery-modern"`, light flow: `cartBarStyle` brand-default,
  `loginFlow` default, `posterStyle` default).
- `app/m/[slug]/icons.tsx` — the inline SVG icon set + `categoryIcon(name)` mapper.
- `app/m/[slug]/koko-delivery-menu.tsx` — the new layout (featured rail, category rail,
  popular cards, list rows, sticky cart pill, SFDA footer). Same prop contract as the other
  full-page layouts (`menu`, `theme`, `onAdd`, `pushToggle`, `controlsSlot`,
  `promotionsSlot`).
- `app/m/[slug]/menu-experience.tsx` — route `delivery-modern` to the new component; it is a
  LIGHT flow (keeps `CartDrawer`, not the dark `PremiumCheckoutFlow`).
- `app/m/[slug]/customer-shell.tsx` — `delivery-modern` is light: standard spinner, standard
  light login gate, light bottom-nav (no `darkOrdering`).
- `app/globals.css` — minimal: scroll-reveal + cart-spring keyframes (reduced-motion gated).
- New DB tenant `koko-test` (SQL via Management API).

## koko-test clone (DB)

`INSERT … SELECT` from koko with fresh UUIDs, remapping category_id/item_id FKs; reuse
koko's public Storage image URLs (no re-upload). Set `slug='koko-test'`,
`menu_design_key='delivery-modern'`, `is_published=true`, `display_only_mode=false`. Seed
the default addons so it renders like a normal tenant. **No writes to slug `koko` /
id `1111…`.**

## Reuse / non-goals

Reuse cart, checkout, loyalty, push, order-type, table mode, SFDA. Not rebuilding backend.
No steam here (steam upgrade is rzrz-signature only). Not touching any production tenant.

## Verification

`next build` clean → Playwright renders (mobile 390 + desktop 1366) → user reviews live at
`/m/koko-test` → iterate on craft → adversarial review workflow before any commit.
