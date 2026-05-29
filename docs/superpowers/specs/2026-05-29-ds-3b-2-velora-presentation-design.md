# DS-3B-2 · Velora Premium Presentation — Design Spec

- **Date:** 2026-05-29
- **Phase:** DS-3B-2 (second half of DS-3B; builds on DS-1/2/3/3B-1). Migrations 0059–0063 live.
- **Status:** Approved design, pre-implementation
- **Branch:** `ds-3b-2-velora-presentation` (off `main`)
- **Depends on:** DS-3B-1 layout resolver (`resolveThemeLayout` + `menu_layout_config`); the velora
  brand fonts fix (Cormorant flows via `--font-display`); the clone profile already points at
  `premium-lounge-grid-v1`.

## Goal

Match the Velora brand-board menu mockup (`docs/clients-menu/Design-template`) on the live
ordering menu by adding two **flag-gated** presentation treatments — a `velora-hero` header and
`premium-lounge` item cards — branched into the existing components and turned on only by a
profile whose menu-page-template sets those flags. KO-KO/RzRz/Mazaj are unaffected.

## Scope

**In scope:** new flag values `headerStyle:"velora-hero"` + `menuCardStyle:"premium-lounge"`;
resolver whitelist extension; the two treatments in `menu-experience.tsx` + `menu-item.tsx`;
migration `0064` to set those flags on `premium-lounge-grid-v1`.

**Out of scope:** other tenants' looks; non-velora layouts; cart/checkout/customizer logic;
`get_public_menu`; RLS; promotions/QR/print/POS; pixel-perfect iteration (structural fidelity
only — see Fidelity note).

## New flag values + resolver

- `apps/web/lib/themes.ts` — extend the `ThemeConfig` unions:
  `headerStyle: "dark-navy" | "brand-filled" | "velora-hero"`,
  `menuCardStyle: "stitch-navy" | "default" | "premium-lounge"`.
- `apps/web/lib/design/layout.ts` — extend `resolveThemeLayout`'s whitelist checks to accept the
  two new values (`|| c.headerStyle === "velora-hero"`, `|| c.menuCardStyle === "premium-lounge"`).
  Everything else (validation, fallback) is unchanged.

## `velora-hero` header

New **first** branch in the header ternary in `apps/web/app/m/[slug]/menu-experience.tsx`
(~line 256), before the existing `dark-navy`/`hasCover`/light branches (which stay byte-identical):

- Container: full-width hero on `--header-bg` (dark), or the tenant cover image with a dark
  bottom-to-top gradient overlay when `cover_image_url` is set. Generous vertical padding.
- Centered column:
  - **Monogram:** the tenant `logo_url` in a circular/squared frame with a thin `--accent-gold`
    border; if no logo, a serif "V"-style initial (first grapheme of the name) in
    `var(--font-display)` inside a gold-bordered square.
  - **Wordmark:** `restaurant.name` in `var(--font-display)` (Cormorant for Latin), large,
    letter-spaced, color `--header-text`.
  - **Eyebrow + tagline:** a small uppercase eyebrow (e.g. derived from `business_type` or a
    static "RESTAURANT · LOUNGE" rendered only for velora-hero) and `tagline_ar` in muted gold
    (`--accent-gold`), with a thin gold hairline divider.
- Uses only existing CSS vars (`--header-bg`, `--header-text`, `--accent-gold`, `--font-display`,
  `--ink`) — all already resolved to Velora's palette/fonts by DS-3/3B-1.

## `premium-lounge` item cards

`apps/web/app/m/[slug]/menu-item.tsx` currently renders one hardcoded card and does **not**
receive `theme`. Changes:

1. Thread `theme: ThemeConfig` from `MenuExperience` into `MenuItemCard` (add the prop; pass it
   where the card is rendered in the item grid). No other call sites change behavior (default
   path unchanged).
2. Branch: `theme.menuCardStyle === "premium-lounge"` → a **dark, image-forward** card; else the
   existing card verbatim.
   - Premium card: background `--card-bg` (Velora surface), a prominent rounded food image at
     top, item name in `var(--font-display)` color `--ink` (cream), description muted, **price in
     `--accent-gold`** (gold), calorie/allergen chips subdued, an add/variant button with a gold
     outline or `--brand`/`--accent-gold` fill, hairline border `--line`/`--accent-gold`.
   - All cart/variant/add-to-cart handlers are reused unchanged; only the presentation differs.

KO-KO (`menuCardStyle: "default"`) and RzRz (`"stitch-navy"`) hit the existing path → unchanged.

## Migration 0064

`apps/web/supabase/migrations/0064_velora_layout_flags.sql` — additive; one `update`, no schema
change:

```sql
update public.menu_page_templates set default_config_json =
  '{"categoryStyle":"pills","headerStyle":"velora-hero","cartBarStyle":"gold-navy","hasItemDetailSheet":true,"menuCardStyle":"premium-lounge"}'::jsonb
where key = 'premium-lounge-grid-v1';
```

The clone's published profile already references `premium-lounge-grid-v1`, so `get_published_design`
returns these flags and `resolveThemeLayout` applies them. No new profile/seed.

## Safety / guardrails

- All new visuals gated by the two new flag values; any tenant not setting them renders unchanged
  (KO-KO/RzRz/Mazaj have no profile or different flags).
- `menu-item.tsx` default branch and all order/cart/checkout/customizer logic untouched.
- Existing header branches (`dark-navy`/`hasCover`/light) untouched.
- Migration additive; no destructive SQL; no `get_public_menu`/RLS changes; no secrets.
- Verification/writes only on `rzrz-bukhari-test`; never `koko`/`rzrz-bukhari`. If the slug isn't
  exactly `rzrz-bukhari-test`, stop and ask.

## Files

Modify: `lib/themes.ts` (unions), `lib/design/layout.ts` (whitelist),
`app/m/[slug]/menu-experience.tsx` (velora-hero branch + pass `theme` to card),
`app/m/[slug]/menu-item.tsx` (accept `theme` + premium branch). Create:
`supabase/migrations/0064_velora_layout_flags.sql`.

## Verification plan (clone only)

1. Apply `0064`; confirm `get_published_design('rzrz-bukhari-test')->'menu_layout_config'` has
   `headerStyle:"velora-hero"` + `menuCardStyle:"premium-lounge"`; `koko`/`rzrz-bukhari` still null.
2. `npx tsc --noEmit` + `npm run build` (heap `--max-old-space-size=8192`) green; `/m/[slug]` compiles.
3. Manual browser smoke `/m/rzrz-bukhari-test` → centered monogram/serif hero + dark image-forward
   cards + pills + gold cart; `/m/koko` and `/m/rzrz-bukhari` visually unchanged.

## Fidelity note / known limitations

Implements the mockup's **structure** (monogram + serif wordmark + tagline hero; dark
image-forward serif cards) using the resolved Velora tokens. Exact pixel-match (precise spacing,
imagery, ornament) typically needs a browser iteration pass, which is painful on this
memory-constrained machine — so the deliverable is structurally faithful, to be eyeballed/tweaked
on the deploy. No new fonts beyond Cormorant/Tajawal (already loaded).

## Out-of-scope / next

Pixel-perfect polish iterations; promotions display (DS-6); QR (DS-4); print (DS-5). After
DS-3B-2, the Velora design vision (colors + fonts + layout) is complete; remaining roadmap is
DS-4 (QR) / DS-5 (print) / DS-6 (promotions).
