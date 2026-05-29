# DS-3 · Customer PWA Token Resolver — Design Spec

- **Date:** 2026-05-29
- **Phase:** DS-3 (builds on DS-1 tables/helpers + DS-2 studio). Migrations 0059/0060 already live.
- **Status:** Approved design, pre-implementation
- **Branch:** `ds-3-pwa-token-resolver` (stacked on `ds-2-ops-design-studio`)
- **Depends on:** DS-1 `restaurant_design_profiles`, `brand_identity_templates`, `resolveDesignTokens`; DS-2 publish flow (to create a published profile to render).

## Goal

Make `/m/[slug]` apply a tenant's **published** design profile — its **colors and fonts** — to
the live customer menu, with a safe fallback to today's theme when no profile is published.
Layout stays exactly as today (layout mapping is a later phase).

## Scope

**In scope:**
- New `SECURITY DEFINER` RPC `public.get_published_design(p_slug)` (anon-callable).
- Pure mapping helper `apps/web/lib/design/css-vars.ts` (tokens → PWA CSS vars; Google-Fonts URL).
- Wire `app/m/[slug]/page.tsx` to resolve + apply profile **palette + fonts**, merged over the
  existing `buildCssVars(...)` output.

**Out of scope (unchanged / deferred):**
- Menu layout, category behavior, card layout, bottom nav, order flow, display-only branching,
  component selection — **all stay from `getTheme`** (layout mapping → DS-3B).
- Promotions display/placeholder → DS-6.
- QR / PDF / Remotion / POS.
- Modifying `get_public_menu`. Adding public-read RLS on `restaurant_design_profiles`.

## Migration 0061

`apps/web/supabase/migrations/0061_get_published_design.sql` — additive; one function, no table
changes.

```sql
create or replace function public.get_published_design(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'template_key',    bt.key,
    'template_name',   bt.name_ar,
    'template_tokens', coalesce(bt.default_tokens_json, '{}'::jsonb),
    'profile_tokens',  coalesce(p.brand_tokens_json, '{}'::jsonb)
  )
  from public.restaurants r
  join public.restaurant_design_profiles p
    on p.restaurant_id = r.id and p.status = 'published'
  left join public.brand_identity_templates bt
    on bt.id = p.brand_template_id
  where r.slug = p_slug
    and r.is_active
    and r.is_published
  limit 1;
$$;

grant execute on function public.get_published_design(text) to anon, authenticated;
```

Mirrors `get_public_menu`'s `is_active`/`is_published` filter so design loads exactly when the
menu does. Returns `null` when there is no published profile (or restaurant not public).

## RPC contract

- **Input:** `p_slug text`.
- **Output:** `jsonb` or `null`.
  - On a published profile: `{ template_key, template_name, template_tokens, profile_tokens }`.
    `template_tokens` = brand template `default_tokens_json` (may be `{}` if no template linked);
    `profile_tokens` = profile `brand_tokens_json`.
  - `null` when no published profile / restaurant not active+published.
- **Security:** `SECURITY DEFINER`, fixed `search_path`, granted to `anon` + `authenticated`.
  Returns only non-sensitive design data (colors/fonts/radius) — never tenant PII.

## CSS variable mapping

The page computes `resolved = resolveDesignTokens({ templateTokens: template_tokens,
profileTokens: profile_tokens })` (DS-1), then `tokensToCssVars(resolved)` produces **only**
these vars (everything else falls through to the existing `buildCssVars` base via merge):

| PWA CSS var       | Source token            |
|-------------------|-------------------------|
| `--brand`         | `colors.primary`        |
| `--bg`            | `colors.background`     |
| `--ink`           | `colors.text`           |
| `--card-bg`       | `colors.surface`        |
| `--text-secondary`| `colors.muted`          |
| `--accent-gold`   | `colors.accent` (only if present) |
| `--price-color`   | `colors.primary`        |
| `--header-bg`     | `colors.primary`        |
| `--cta-bg`        | `colors.primary`        |
| `--font-display`  | `typography.heading` + `", system-ui, sans-serif"` |
| `--font-body`     | `typography.body` + `", system-ui, sans-serif"` |

**Kept from `buildCssVars` base (merge-over, not mapped):** `--header-text`, `--card-border`,
`--divider`, `--calorie-bg`, `--calorie-text`, `--cta-text`. A var is emitted only when its
source token is a non-empty string, so a sparse token set never blanks a base var.

Final: `cssVars = { ...buildCssVars(slug, {primary_color, background_color}), ...tokensToCssVars(resolved) }`.

## Font loading rules

- `googleFontsUrl(tokens): string | null` builds a Google Fonts CSS2 URL for the **unique,
  non-empty** `typography.heading` and `typography.body` names, weights `wght@400;500;600;700`,
  `&display=swap`. Names that are not Google-hosted (e.g. `Geist`, the Latin token) are skipped.
  Returns `null` if nothing remains.
- When a profile is active, the page renders the profile fonts `<link>` (in addition to any
  existing `theme.fonts.googleUrl`, which is harmless). When no profile, only today's
  `theme.fonts.googleUrl` is rendered.
- `--font-display`/`--font-body` always include a `system-ui, sans-serif` fallback, so if a font
  fails to load the text degrades gracefully rather than disappearing.

## Fallback behavior

- `get_published_design` returns `null` → **byte-identical to today**: `cssVars =
  buildCssVars(...)`, fonts = `theme.fonts.googleUrl`, layout = `getTheme`.
- A published profile present → palette + fonts overridden as above; **layout/behavior flags and
  component branching still come from `getTheme`** (untouched).
- Applies to **both** render paths in `page.tsx` (display-only mode and normal). `generateMetadata`
  is unchanged.

## Guardrails

- Do not modify `get_public_menu`; do not add public-read RLS on `restaurant_design_profiles`.
- Do not change menu layout, category behavior, card layout, bottom nav, order flow,
  display-only mode, or component branching.
- No production writes. Publish test profiles **only** to `rzrz-bukhari-test`. If a test target
  slug is not exactly `rzrz-bukhari-test`, stop and ask.
- Additive migration only; no destructive SQL; no secrets.

## Verification plan

1. Apply `0061` to live Supabase (Management API PAT); confirm the function exists.
2. `get_published_design('koko')` and `get_published_design('rzrz-bukhari')` → **`null`**
   (production has no published profile → pages unchanged).
3. Publish a design profile **only** for `rzrz-bukhari-test` (DS-2 studio, or the
   admin-impersonation RPC technique on the clone). `get_published_design('rzrz-bukhari-test')`
   → returns `{ template_tokens, profile_tokens, … }`.
4. `npx tsc --noEmit` + `npm run build` green; confirm `/m/[slug]` still compiles.
5. Manual browser smoke of `/m/rzrz-bukhari-test` only → palette + fonts reflect the profile;
   spot-check `/m/koko` is unchanged.
6. Optional cleanup of the clone's test profile afterward (the clone is a sandbox, so leaving a
   demo profile is acceptable).

## Out-of-scope items

Layout/flag mapping (DS-3B); promotions display + placeholder (DS-6); QR design/exports (DS-4);
print (DS-5); Remotion (DS-8); POS; tenant self-service writes; changes to `get_public_menu`.

## Next phase recommendation

**DS-3B · Layout resolver** — design a template→layout-flags schema (store flags in template
`default_config_json`, make the resolver produce a full `ThemeConfig`), verified on the clone.
Alternatively proceed to **DS-4 · QR design templates + `/q/{code}`**. Recommend DS-3B next to
complete the resolver vision before QR/print.
