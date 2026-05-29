# DS-6-2 · Promotions CRUD — Design Spec

- **Date:** 2026-05-29 · **Phase:** DS-6-2 (completes DS-6) · **Branch:** `ds-6-2-promotions-crud`
- **Status:** Approved (standing approval). **Depends on:** DS-1 `promotions` table; DS-6-1 rail +
  `get_active_promotions`; the studio (`/ops/tenants/[id]/design`) + the QR-tab pattern.

## Goal

Let ops create/activate/delete a tenant's promotions from a **Promotions tab** in the design
studio. Created promotions immediately drive the DS-6-1 rail on `/m/[slug]`.

## Scope

**In:** a "العروض" tab (6th) in the studio; server actions `createPromotion` / `setPromotionActive`
/ `deletePromotion`; a create form (title/subtitle/badge/priority/image/dates) + a list with
activate/deactivate + delete. **Out (deferred):** `promotion_items` linking + bundle pricing (needs
order-calc changes; later); print/QR/export-hash inclusion (DS-7); image upload (paste a URL for now).

## Components + actions

- `apps/web/app/ops/tenants/[id]/design/promotions-actions.ts` (`"use server"`, `requireOps`):
  - `createPromotion({restaurantId,titleAr,subtitleAr,badgeTextAr,imageUrl,priority,startsAt,endsAt})`
    → insert into `promotions` (`is_active=true`, `show_on_menu_home=true`; empty strings → null;
    title required); revalidate.
  - `setPromotionActive({restaurantId,id,active})` → update `is_active`.
  - `deletePromotion({restaurantId,id})` → delete.
  - Ops RLS write (`is_platform_admin`).
- `apps/web/app/ops/tenants/[id]/design/promos-tab.tsx` (client): create form + a list of the
  tenant's promotions (badge/title/subtitle/priority/ends), each with activate/deactivate + delete.
- `page.tsx`: import `PromosTab`; `TABS += { key:"promos", label:"العروض" }`; load the tenant's
  `promotions` in the `Promise.all`; render `<PromosTab>` when `?tab=promos`.

## No migration

`promotions` exists (DS-1).

## Safety

Additive tab + actions + one data-load + render branch in the studio. Ops-only (`requireOps`). No
public surface. Writes via ops RLS. Verify on `rzrz-bukhari-test` only. The DS-6-1 rail already
gates on active+window, so creating/deactivating here flows through to `/m` correctly.

## Files

Create: `promotions-actions.ts`, `promos-tab.tsx`. Modify: studio `page.tsx` (tab + load + render).

## Verification (clone)

- `tsc` + `build` green.
- Create a promotion on `rzrz-bukhari-test` (via the tab / mirrored PAT insert) → appears in the
  list and in `get_active_promotions('rzrz-bukhari-test')`; deactivate → drops from the active set;
  delete → removed. `koko` unaffected.

## Next

DS-6 complete. **DS-7 · Export Management** (server-side PDF/PNG → storage, `qr_exports`/
`print_exports`, data-hash/outdated/regenerate, promotions-in-print). Then DS-8 (Remotion arch-space).
