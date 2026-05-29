# DS-3B-1 · Layout Resolver — Design Spec

- **Date:** 2026-05-29
- **Phase:** DS-3B-1 (first half of DS-3B; builds on DS-1/2/3). Migrations 0059–0062 live.
- **Status:** Approved design, pre-implementation
- **Branch:** `ds-3b-1-layout-resolver` (off `main`)
- **Depends on:** DS-1 `menu_page_templates` + `restaurant_design_profiles.menu_page_template_id`; DS-2 studio (sets `menu_page_template_id`); DS-3 `get_published_design` RPC + `/m/[slug]` wiring.

## Goal

Let a tenant's **published** design profile drive the customer menu's **layout flags** by reading
its assigned **menu-page-template**'s config and merging it over the base `ThemeConfig` in
`/m/[slug]`. DS-3B-1 plumbs **existing** flag values only; the bespoke premium presentation
(new flag values + treatment) is DS-3B-2 (Approach A).

## Scope

**In scope:**
- Extend the `get_published_design` RPC to also return the menu-page-template's `default_config_json`.
- A pure resolver `resolveThemeLayout(base, config)` that overrides only valid, known `ThemeConfig` flags.
- Wire it into `/m/[slug]/page.tsx` (no component changes).
- Seed `premium-lounge-grid-v1` (and `fast-food-grid-v1`) `default_config_json` with **existing** flag values.

**Out of scope (DS-3B-2):** new flag *values* (`velora-hero` header, `premium-lounge` cards),
V monogram, image-forward serif cards, any new presentation. Also out: changes to
`MenuExperience`/components, `get_public_menu`, public RLS, QR/print/promotions/POS.

## Migration 0063

`apps/web/supabase/migrations/0063_design_layout_config.sql` — additive; replaces the RPC
(adds keys, keeps existing) and seeds template configs. No schema change.

```sql
create or replace function public.get_published_design(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'template_key',       bt.key,
    'template_name',      bt.name_ar,
    'template_tokens',    coalesce(bt.default_tokens_json, '{}'::jsonb),
    'profile_tokens',     coalesce(p.brand_tokens_json, '{}'::jsonb),
    'menu_page_key',      mt.key,
    'menu_layout_config', coalesce(mt.default_config_json, '{}'::jsonb)
  )
  from public.restaurants r
  join public.restaurant_design_profiles p
    on p.restaurant_id = r.id and p.status = 'published'
  left join public.brand_identity_templates bt on bt.id = p.brand_template_id
  left join public.menu_page_templates     mt on mt.id = p.menu_page_template_id
  where r.slug = p_slug and r.is_active and r.is_published
  limit 1;
$$;

grant execute on function public.get_published_design(text) to anon, authenticated;

update public.menu_page_templates set default_config_json =
  '{"categoryStyle":"pills","headerStyle":"dark-navy","cartBarStyle":"gold-navy","hasItemDetailSheet":true}'::jsonb
where key = 'premium-lounge-grid-v1';

update public.menu_page_templates set default_config_json =
  '{"categoryStyle":"tabs","headerStyle":"brand-filled","cartBarStyle":"brand-default","hasItemDetailSheet":false}'::jsonb
where key = 'fast-food-grid-v1';
```

Backward-compatible: DS-3's consumer only reads `template_tokens`/`profile_tokens`; the new keys
are additive. `menu_layout_config` is `{}` when no menu-page-template is assigned.

## Layout-flag schema

`menu_layout_config` (a template's `default_config_json`) may set this **safe subset** of
`ThemeConfig` flags; anything else is ignored:

| Flag | Allowed values |
|---|---|
| `menuLayout` | `"card-grid"` \| `"heritage-list"` |
| `categoryStyle` | `"pills"` \| `"tabs"` |
| `menuCardStyle` | `"stitch-navy"` \| `"default"` |
| `headerStyle` | `"dark-navy"` \| `"brand-filled"` |
| `cartBarStyle` | `"gold-navy"` \| `"brand-default"` |
| `hasItemDetailSheet` | `true` \| `false` |
| `bottomNavItems` | `3` \| `5` |

Note: `menuLayout` only branches in **display-only** mode today; for an ordering menu the
effective flags are `categoryStyle`/`headerStyle`/`cartBarStyle`/`hasItemDetailSheet`. That's
expected for DS-3B-1.

## Resolver helper

`apps/web/lib/design/layout.ts`:

```ts
import type { ThemeConfig } from "../themes";

// Override only valid, known layout flags from a template's default_config_json over the base
// ThemeConfig. Unknown keys / invalid values are ignored, so a bad config can never break render.
export function resolveThemeLayout(base: ThemeConfig, config: unknown): ThemeConfig {
  if (!config || typeof config !== "object") return base;
  const c = config as Record<string, unknown>;
  const out: ThemeConfig = { ...base };
  if (c.menuLayout === "card-grid" || c.menuLayout === "heritage-list") out.menuLayout = c.menuLayout;
  if (c.categoryStyle === "pills" || c.categoryStyle === "tabs") out.categoryStyle = c.categoryStyle;
  if (c.menuCardStyle === "stitch-navy" || c.menuCardStyle === "default") out.menuCardStyle = c.menuCardStyle;
  if (c.headerStyle === "dark-navy" || c.headerStyle === "brand-filled") out.headerStyle = c.headerStyle;
  if (c.cartBarStyle === "gold-navy" || c.cartBarStyle === "brand-default") out.cartBarStyle = c.cartBarStyle;
  if (typeof c.hasItemDetailSheet === "boolean") out.hasItemDetailSheet = c.hasItemDetailSheet;
  if (c.bottomNavItems === 3 || c.bottomNavItems === 5) out.bottomNavItems = c.bottomNavItems;
  return out;
}
```

Each comparison narrows to the flag's literal type, so assignment is type-safe with no casts. Pure.

## Wiring in `/m/[slug]/page.tsx`

Three minimal edits (no component changes; the resolved `theme` already flows to both render paths):

1. Add `import { resolveThemeLayout } from "@/lib/design/layout";`.
2. Change `const theme = getTheme(params.slug);` → `let theme = getTheme(params.slug);`.
3. After the existing `if (design) { … }` block, add:
   ```ts
   theme = resolveThemeLayout(theme, (design as { menu_layout_config?: unknown } | null)?.menu_layout_config);
   ```
   `resolveThemeLayout` returns `base` unchanged for null/undefined/invalid config → safe fallback.

## Fallback behavior

No published profile / no `menu_page_template_id` / empty or invalid `menu_layout_config` →
`resolveThemeLayout` returns `getTheme(slug)` unchanged → **today's behavior**. Production tenants
(no profile) are unaffected.

## Guardrails

- No changes to `MenuExperience`/menu components, `get_public_menu`, or public RLS.
- No new flag *values* or presentation (DS-3B-2). Only existing flags are plumbed.
- Resolver ignores unknown/invalid config → a bad template config can't break rendering.
- Verification/writes only on `rzrz-bukhari-test`; never `koko`/`rzrz-bukhari`. If the slug isn't
  exactly `rzrz-bukhari-test`, stop and ask.
- Additive migration; no destructive SQL; no secrets.

## Verification plan (clone only)

1. Apply `0063` to live Supabase; confirm the RPC returns the new keys.
2. Point the clone's published profile at `premium-lounge-grid-v1`
   (`update restaurant_design_profiles … set menu_page_template_id = (select id from menu_page_templates where key='premium-lounge-grid-v1') … where restaurant slug = 'rzrz-bukhari-test' and status='published'`).
3. `get_published_design('rzrz-bukhari-test')` → `menu_layout_config` = the pills/dark-navy/gold config;
   `get_published_design('koko')` / `('rzrz-bukhari')` → still `null`.
4. `npx tsc --noEmit` + `npm run build` green; `resolveThemeLayout` temp-compile assertions
   (compile `lib/themes.ts` + `lib/design/layout.ts` together — `layout.ts` imports `ThemeConfig`
   relatively from `../themes` so a bare `tsc` resolves it — then assert: valid flags override,
   invalid/unknown ignored, null/non-object config → base unchanged).
5. Manual browser smoke of `/m/rzrz-bukhari-test` → category pills + dark-navy header + gold cart;
   spot-check `/m/koko` unchanged.

## Out-of-scope items

DS-3B-2 (bespoke premium presentation, new flag values, V monogram, image-forward cards);
promotions (DS-6); QR (DS-4); print (DS-5); POS; tenant self-service.

## Next phase recommendation

**DS-3B-2 · Velora premium presentation (Approach A)** — add new flag values
(`headerStyle: "velora-hero"`, `menuCardStyle: "premium-lounge"`, section dividers) and the
corresponding branches in `MenuExperience`, gated by flags only Velora's profile sets, to match
the brand-board mockups. Verified on the clone.
