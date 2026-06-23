# Proof · DS-3B-2 — Velora Premium Presentation

- **Date:** 2026-05-29
- **Phase:** DS-3B-2 (completes DS-3B). Migrations 0059–0064 live.
- **Branch:** `ds-3b-2-velora-presentation` (off `main`)
- **Spec/Plan:** `docs/superpowers/specs/2026-05-29-ds-3b-2-velora-presentation-design.md` ·
  `docs/superpowers/plans/2026-05-29-ds-3b-2-velora-presentation.md`

## Goal

Match the Velora menu mockup (`docs/clients/Design-template`) on the live ordering menu via
two flag-gated treatments: a `velora-hero` header and `premium-lounge` dark item cards.

## Files changed

```
A apps/web/app/m/[slug]/velora-hero.tsx
M apps/web/lib/themes.ts                (ThemeConfig unions += velora-hero, premium-lounge)
M apps/web/lib/design/layout.ts         (resolveThemeLayout whitelist += new values)
M apps/web/app/m/[slug]/menu-experience.tsx  (import VeloraHero; header branch; pass premium)
M apps/web/app/m/[slug]/menu-item.tsx   (premium?: boolean prop + dark-card branch)
A apps/web/supabase/migrations/0064_velora_layout_flags.sql
A docs/proofs/DS-3B-2-velora-presentation.md
```

Subagent-driven: one implementer subagent per task; main-agent review + verification + commit;
all live-DB ops by the main agent on `rzrz-bukhari-test` only.

## What was built

- **New flag values:** `headerStyle:"velora-hero"`, `menuCardStyle:"premium-lounge"` added to
  `ThemeConfig` and to the `resolveThemeLayout` whitelist (so a profile can set them).
- **`velora-hero` header** (`velora-hero.tsx`, branched first in the `menu-experience` header
  ternary): centered monogram (logo or serif initial) + name in `--font-display` (Cormorant for
  Latin) + a gold "Restaurant · Lounge" rule + tagline, on `--header-bg`/cover-with-gradient.
- **`premium-lounge` card** (`menu-item.tsx`): a `premium?: boolean` prop (passed from
  `menu-experience` as `theme.menuCardStyle === "premium-lounge"`) selects a dark, image-forward
  card — `--card-bg` surface, serif name (`--ink`), gold price/outline buttons (`--accent-gold`).
  The default card path is unchanged.
- **Migration `0064`:** sets `premium-lounge-grid-v1.default_config_json` to
  `{categoryStyle:pills, headerStyle:velora-hero, cartBarStyle:gold-navy, hasItemDetailSheet:true,
  menuCardStyle:premium-lounge}`. The clone profile already references this template.

## Verification (live, `rzrz-bukhari-test` only)

| Check | Result |
|---|---|
| `menu_layout_config.headerStyle` (clone) | **velora-hero** |
| `menu_layout_config.menuCardStyle` (clone) | **premium-lounge** |
| `get_published_design('koko')` is null | **true** |
| `get_published_design('rzrz-bukhari')` is null | **true** |

- `npx tsc --noEmit` clean; `npm run build` SUCCESS (`/m/[slug]` present; static-gen needs
  `--max-old-space-size=8192` on this machine — environmental).

## Guardrails verified

- **Production not touched** — `koko`/`rzrz-bukhari` have no profile → RPC null → render exactly
  as before. Every DB write on `rzrz-bukhari-test`.
- All new visuals gated by the new flag values; `menu-item.tsx` default card path and all
  cart/checkout/customizer logic unchanged; existing header branches intact.
- Additive migration; no destructive SQL; no `get_public_menu`/RLS changes.

## Known limitations

- **Structural fidelity, not pixel-perfect.** The hero (monogram + serif wordmark + tagline) and
  dark image-forward cards follow the mockup's structure using the Velora tokens; precise spacing/
  ornament/imagery would need a browser iteration pass (rough on this OOM-prone machine).
- The "Restaurant · Lounge" eyebrow is a static Latin touch on the velora-hero header.
- Letter-spacing intentionally not applied to the (Arabic) name to avoid breaking Arabic joining;
  Cormorant applies to Latin glyphs via the `--font-display` stack from DS-3B-1.
- Manual browser smoke pending (operator): `/m/rzrz-bukhari-test`.

## Next

The Velora design vision (colors + fonts + layout) is now complete across DS-3/3B-1/3B-2.
Remaining roadmap: **DS-4** (QR design + `/q/{code}` + exports), **DS-5** (A3/A4 print engine),
**DS-6** (promotions display), **DS-7** (export management), **DS-8** (Remotion).
