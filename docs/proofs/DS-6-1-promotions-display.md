# Proof · DS-6-1 — Promotions Display

- **Date:** 2026-05-29 · **Phase:** DS-6-1 · **Branch:** `ds-6-1-promotions-display`
- **Spec/Plan:** `docs/superpowers/specs/2026-05-29-ds-6-1-promotions-display-design.md` ·
  `docs/superpowers/plans/2026-05-29-ds-6-1-promotions-display.md`

## Goal

Show a tenant's active promotions as a rail on `/m/[slug]`; expired/inactive don't appear; no
promotions → no rail.

## Files changed

```
A apps/web/supabase/migrations/0066_get_active_promotions.sql   (anon SECURITY DEFINER RPC)
A apps/web/app/m/[slug]/promotions-rail.tsx                     (self-fetching client rail)
M apps/web/app/m/[slug]/menu-experience.tsx                     (+import, +<PromotionsRail/> after VAT block)
A docs/proofs/DS-6-1-promotions-display.md
```

## What was built

- `get_active_promotions(p_slug)` — anon RPC returning a jsonb array of active promos (`is_active`
  + `show_on_menu_home` + within `[starts_at, ends_at]`, nulls open-ended), ordered by
  `priority desc, created_at desc`. RLS-bypass like `get_public_menu`; `promotions` RLS untouched.
- `PromotionsRail` (client) — fetches the RPC on mount; renders a horizontal offer-card rail
  (image/badge/title/subtitle) via tenant CSS vars; renders `null` when empty.
- `menu-experience.tsx` — one import + `<PromotionsRail slug={menu.restaurant.slug} />` after the
  VAT-notice block. No prop-signature change.

## Verification (clone)

- Applied `0066`. Inserted an active promo + an expired (`ends_at < now()`) on `rzrz-bukhari-test`:
  `get_active_promotions('rzrz-bukhari-test')` → **1** (active only; expired excluded),
  first title `عرض فيلورا`; `get_active_promotions('koko')` → **0**.
- `tsc --noEmit` clean; `npm run build` SUCCESS.

## Guardrails verified

- Additive RPC + new component + 1 import + 1 line. No promotions → rail renders nothing → all
  existing tenants (incl. `koko`/`rzrz-bukhari`) visually unchanged. `promotions` RLS untouched;
  `get_public_menu` untouched. Clone-only writes.

## Known limitations

- No promotions CRUD yet — **DS-6-2** (ops studio Promotions tab). Test promos were inserted via PAT.
- Rail shows in the normal ordering menu (`MenuExperience`); display-only-mode rail + print/QR/export
  inclusion are later (DS-7 for print/export-hash).

## Next

**DS-6-2 · Promotions CRUD** (create/edit/link-items/dates/activate from ops).
