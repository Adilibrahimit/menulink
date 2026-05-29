# Proof · DS-3 — Customer PWA Token Resolver (colors + fonts)

- **Date:** 2026-05-29
- **Phase:** DS-3 (builds on DS-1/DS-2; migrations 0059/0060/0061 live)
- **Branch:** `ds-3-pwa-token-resolver` (stacked on `ds-2-ops-design-studio`)
- **Spec:** `docs/superpowers/specs/2026-05-29-ds-3-pwa-token-resolver-design.md`
- **Plan:** `docs/superpowers/plans/2026-05-29-ds-3-pwa-token-resolver.md`

## Goal

Apply a tenant's **published** design profile's **colors + fonts** to `/m/[slug]`, with a safe
fallback to today's theme when no profile is published. Layout untouched (deferred to DS-3B).

## Scope (delivered)

- New `SECURITY DEFINER`, anon-callable RPC `public.get_published_design(p_slug)` (migration 0061).
- Pure helper `apps/web/lib/design/css-vars.ts` (`tokensToCssVars` + `googleFontsUrl`).
- `app/m/[slug]/page.tsx`: call the RPC, resolve via DS-1 `resolveDesignTokens`, merge mapped
  palette over `buildCssVars(...)`, inject a profile fonts `<link>` in both render paths.

## Files changed

```
A apps/web/supabase/migrations/0061_get_published_design.sql
A apps/web/lib/design/css-vars.ts
M apps/web/app/m/[slug]/page.tsx   (imports + RPC resolve/merge + fonts link ×2 paths)
A docs/proofs/DS-3-pwa-token-resolver.md
```

Executed subagent-driven: one implementer subagent per task; main-agent review + verification +
commit; all live-DB ops run by the main agent on `rzrz-bukhari-test` only.

## Migration 0061 / RPC contract

`get_published_design(p_slug text) returns jsonb` — `{ template_key, template_name,
template_tokens, profile_tokens }` for a `status='published'` profile of an active+published
restaurant, else `null`. `SECURITY DEFINER`, `set search_path = public`, granted to `anon` +
`authenticated`. Returns only non-sensitive design data. `get_public_menu` untouched; no public
RLS added to `restaurant_design_profiles`.

## RPC verification (live, `rzrz-bukhari-test` only)

A demo profile (brand `velora-premium-v1`) was published on the clone via admin impersonation
(`set_config('request.jwt.claim.sub', <platform_admins.user_id>)` in one transaction → insert
draft → `publish_design_profile`). Exact-slug guard enforced (`rzrz-bukhari-test`).

| Check | Result |
|---|---|
| `get_published_design('rzrz-bukhari-test')` not null | **true** |
| clone `template_key` | **velora-premium-v1** |
| `get_published_design('koko')` is null | **true** |
| `get_published_design('rzrz-bukhari')` is null | **true** |

## CSS-variable mapping + font rules

`resolved = resolveDesignTokens({templateTokens, profileTokens})`; `tokensToCssVars(resolved)`
emits `--brand`←primary, `--bg`←background, `--ink`←text, `--card-bg`←surface,
`--text-secondary`←muted, `--accent-gold`←accent (if present), `--price-color`/`--header-bg`/
`--cta-bg`←primary, plus `--font-display`/`--font-body` from typography (with `system-ui`
fallback). Final `cssVars = { ...buildCssVars(...), ...tokensToCssVars(resolved) }` — unmapped
vars (`--header-text`, `--card-border`, `--divider`, `--calorie-*`, `--cta-text`) keep base
values. `googleFontsUrl` builds a Google-Fonts link for heading/body, skipping non-Google fonts
(e.g. `Geist`).

## Fallback behavior

`get_published_design` returns `null` → `/m/[slug]` is **byte-identical to today** (`cssVars =
buildCssVars`, fonts = `theme.fonts.googleUrl`, layout via `getTheme`). A published profile
overrides palette + fonts only; layout/behavior flags and component branching are unchanged.
Applies to both render paths (display-only + normal). `generateMetadata` unchanged.

## Build / type-check

- `npx tsc --noEmit` → clean (full project, includes the new code).
- `npm run build` → SUCCESS; `/m/[slug]` compiles (dynamic route). Note: `next build` static-gen
  needed `NODE_OPTIONS=--max-old-space-size=8192` on this machine due to session memory pressure
  (environmental; compilation + type-check passed at the default heap).

## Guardrails verified

- **Production customer pages were NOT touched.** `koko` and `rzrz-bukhari` have no published
  profile → `get_published_design` returns `null` → their menus render exactly as before. Every
  DB write was on `rzrz-bukhari-test`.
- `get_public_menu` unchanged; no public-read RLS added to `restaurant_design_profiles`.
- No change to layout, component branching, category behavior, cart/order flow, display-only
  mode, bottom nav, QR, PDF, promotions, Remotion, or POS.
- Additive migration; safe fallback on null/error (the page uses today's vars unless `design`
  is truthy).

## Known limitations

- **Manual browser smoke pending (operator):** open `/m/rzrz-bukhari-test` to confirm the velora
  palette + fonts render; spot-check `/m/koko` is unchanged. (`/m` is public — no login needed.)
- Contrast-sensitive vars (`--header-text`, `--cta-text`) keep base values; not derived from
  tokens. Fine for the seeded dark-primary templates.
- Layout/flag mapping deferred to DS-3B; promotions to DS-6.
- An empty published profile would render system-default (standard-clean) colors; DS-2's editor
  never produces an empty profile.

## Next phase

**DS-3B · Layout resolver** — template→layout-flags schema so a profile can also drive
`ThemeConfig` layout/behavior, verified on the clone. (Or DS-4 · QR + `/q/{code}`.)
