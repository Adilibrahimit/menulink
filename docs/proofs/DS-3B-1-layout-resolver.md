# Proof · DS-3B-1 — Layout Resolver

- **Date:** 2026-05-29
- **Phase:** DS-3B-1 (first half of DS-3B; builds on DS-1/2/3). Migrations 0059–0063 live.
- **Branch:** `ds-3b-1-layout-resolver` (off `main`)
- **Spec/Plan:** `docs/superpowers/specs/2026-05-29-ds-3b-1-layout-resolver-design.md` ·
  `docs/superpowers/plans/2026-05-29-ds-3b-1-layout-resolver.md`

## Goal

Let a published design profile's menu-page-template drive `/m/[slug]`'s `ThemeConfig` layout
flags (existing flag values only), with safe fallback. Bespoke premium presentation = DS-3B-2.

## Files changed

```
A apps/web/supabase/migrations/0063_design_layout_config.sql
A apps/web/lib/design/layout.ts
M apps/web/app/m/[slug]/page.tsx   (import + let theme + resolveThemeLayout call; 3 edits)
A docs/proofs/DS-3B-1-layout-resolver.md
```

Subagent-driven: one implementer subagent per task; main-agent review + verification + commit;
all live-DB ops by the main agent on `rzrz-bukhari-test` only.

## Migration 0063

`create or replace get_published_design(p_slug)` to additionally return `menu_page_key` +
`menu_layout_config` (= the assigned menu-page-template's `default_config_json`, `{}` when none),
via a `left join menu_page_templates`. Seeds `premium-lounge-grid-v1` and `fast-food-grid-v1`
`default_config_json` with existing flag values. `get_public_menu` untouched; no schema change.

## Resolver

`apps/web/lib/design/layout.ts` → `resolveThemeLayout(base: ThemeConfig, config): ThemeConfig`
overrides only valid, known flags (`menuLayout`, `categoryStyle`, `menuCardStyle`, `headerStyle`,
`cartBarStyle`, `hasItemDetailSheet`, `bottomNavItems`); ignores unknown keys / invalid values;
returns `base` unchanged for null/non-object config. Pure (relative `../themes` import).

## Wiring

`page.tsx`: `let theme = getTheme(slug)`, then after the design block
`theme = resolveThemeLayout(theme, design?.menu_layout_config)` — before both render paths.
No component/order-flow changes.

## Verification (live, `rzrz-bukhari-test` only)

- Migration applied; RPC returns the new key (`menu_layout_config` present), `koko` null,
  `premium-lounge-grid-v1` config = `{categoryStyle:pills, headerStyle:dark-navy,
  cartBarStyle:gold-navy, hasItemDetailSheet:true}`.
- `resolveThemeLayout` temp-compile assertions: **10/10 PASS** (override valid flags; ignore
  invalid/unknown; null config → base; base not mutated).
- Pointed the clone's published profile at `premium-lounge-grid-v1`, then:

| Check | Result |
|---|---|
| `menu_page_key` (clone) | **premium-lounge-grid-v1** |
| `menu_layout_config.headerStyle` (clone) | **dark-navy** |
| `menu_layout_config.categoryStyle` (clone) | **pills** |
| `get_published_design('koko')` is null | **true** |
| `get_published_design('rzrz-bukhari')` is null | **true** |

- `npx tsc --noEmit` clean; `npm run build` SUCCESS (`/m/[slug]` present; static-gen needs
  `--max-old-space-size=8192` on this machine — environmental).

## Guardrails verified

- **Production not touched** — `koko`/`rzrz-bukhari` have no published profile → RPC null →
  unchanged. Every DB write on `rzrz-bukhari-test`.
- No changes to `MenuExperience`/components, the order/cart/checkout flow, `get_public_menu`, or
  RLS. Only the `theme` object is enriched, then passed as before.
- Resolver ignores invalid config → a bad template config can't break rendering. Null/absent
  profile → today's behavior.
- Additive migration; no destructive SQL; no secrets.

## Known limitations

- Only **existing** flag values are plumbed; the bespoke Velora presentation (new flag values,
  V monogram, image-forward serif cards) is **DS-3B-2**.
- `menuLayout` only branches in display-only mode today, so for the ordering clone the visible
  effect is `categoryStyle`/`headerStyle`/`cartBarStyle`/`hasItemDetailSheet`.
- Manual browser smoke pending (operator): `/m/rzrz-bukhari-test` → pills + dark-navy + gold cart.

## Next phase

**DS-3B-2 · Velora premium presentation (Approach A)** — new flag values
(`headerStyle: "velora-hero"`, `menuCardStyle: "premium-lounge"`, section dividers) + matching
branches in `MenuExperience`, gated by flags only Velora's profile sets, to match the mockups.
