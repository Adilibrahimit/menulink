# DS-6-1 · Promotions Display — Design Spec

- **Date:** 2026-05-29 · **Phase:** DS-6-1 (first slice of DS-6) · **Branch:** `ds-6-1-promotions-display`
- **Status:** Approved (standing approval). **Depends on:** DS-1 `promotions` table; `get_public_menu` pattern.

## Goal

Show a tenant's **active** promotions as a rail on `/m/[slug]`. Active = `is_active` +
`show_on_menu_home` + within `[starts_at, ends_at]` (nulls = open-ended). Expired/inactive don't
appear. No promotions → no rail (production tenants unchanged).

## Scope

**In:** a `get_active_promotions(slug)` `SECURITY DEFINER` anon RPC; a self-fetching
`PromotionsRail` client component; a one-line insertion in `MenuExperience` (after the VAT line).
**Out (deferred):** promotions CRUD (DS-6-2); print/QR inclusion + export hash (DS-7); display-only
mode rail (later). Offer QR already works via DS-4 (`purpose=offer`).

## Migration 0066 — `get_active_promotions`

`SECURITY DEFINER`, `set search_path = public`, anon+authenticated. Returns a jsonb array (or `[]`)
of `{ id, title_ar, subtitle_ar, description_ar, badge_text_ar, image_url }` for the slug's
active+published restaurant where `pr.is_active and pr.show_on_menu_home and (starts_at is null or
<=now()) and (ends_at is null or >=now())`, ordered by `priority desc, created_at desc`. (Same
RLS-bypass pattern as `get_public_menu`; `promotions` RLS stays ops/owner-only.)

## Component + wiring

- `apps/web/app/m/[slug]/promotions-rail.tsx` (client): on mount, `supabase-browser`
  `.rpc("get_active_promotions", { p_slug: slug })`; if non-empty, render a horizontal rail of
  offer cards (image, badge, title, subtitle) styled via the tenant CSS vars (`--card-bg`,
  `--cta-bg`, `--ink`, `--font-display`); else render `null`.
- `menu-experience.tsx`: add `import PromotionsRail from "./promotions-rail";` and insert
  `<PromotionsRail slug={menu.restaurant.slug} />` right after the VAT-notice block (uses the
  in-scope `menu`; **no prop-signature change**).

## Safety

- Additive RPC + new component + one import + one line in `MenuExperience`. No promotions → rail
  renders nothing → all existing tenants visually unchanged. Reads via anon RPC; no new table
  exposure (`promotions` RLS untouched). Verify on `rzrz-bukhari-test` only.

## Files

Create: `apps/web/supabase/migrations/0066_get_active_promotions.sql`,
`apps/web/app/m/[slug]/promotions-rail.tsx`. Modify: `apps/web/app/m/[slug]/menu-experience.tsx`
(import + 1 line).

## Verification (clone)

1. Apply 0066; insert a test promotion on `rzrz-bukhari-test`; `get_active_promotions(...)` returns
   it; an `ends_at < now()` promo is excluded; `get_active_promotions('koko')` → `[]`.
2. `tsc` + `build` green; `/m/[slug]` compiles. Browser smoke: rail shows on `/m/rzrz-bukhari-test`.

## Next

**DS-6-2 · Promotions CRUD** (ops studio Promotions tab: create/edit promotions, link items, dates,
activate). Then DS-7 (export mgmt incl. promotions in print + export hash), DS-8 (Remotion arch-space).
