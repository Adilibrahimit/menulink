# Proof · DS-6-2 — Promotions CRUD

- **Date:** 2026-05-29 · **Phase:** DS-6-2 (completes DS-6) · **Branch:** `ds-6-2-promotions-crud`
- **Spec/Plan:** `docs/superpowers/specs/2026-05-29-ds-6-2-promotions-crud-design.md` ·
  `docs/superpowers/plans/2026-05-29-ds-6-2-promotions-crud.md`

## Goal

Ops can create/activate/delete a tenant's promotions from a Promotions tab; created promotions drive
the DS-6-1 rail on `/m/[slug]`.

## Files changed

```
A apps/web/app/ops/tenants/[id]/design/promotions-actions.ts   (createPromotion / setPromotionActive / deletePromotion)
A apps/web/app/ops/tenants/[id]/design/promos-tab.tsx           (create form + list with activate/delete)
M apps/web/app/ops/tenants/[id]/design/page.tsx                 (6th "العروض" tab + load + render)
A docs/proofs/DS-6-2-promotions-crud.md
```

No migration (`promotions` exists from DS-1).

## What was built

- Three `"use server"` actions (`requireOps`): `createPromotion` (title required; empty → null;
  `is_active`/`show_on_menu_home` true), `setPromotionActive`, `deletePromotion` — all revalidate
  the studio. Ops RLS writes.
- `PromosTab` — create form (title/subtitle/badge/priority/image-URL/dates) + a list of the tenant's
  promotions with activate/deactivate + delete.
- `page.tsx` — `PromosTab` import; `TABS += {key:"promos",label:"العروض"}`; a `promotions` select in
  the `Promise.all`; the `{active==="promos" && <PromosTab/>}` render branch.

## Verification

- `tsc --noEmit` clean; `npm run build` SUCCESS (`/ops/tenants/[id]/design` compiles).
- The `promotions` write path (insert/active/delete via ops RLS) is the same proven in DS-6-1
  (insert verified there). Created/active promotions surface through `get_active_promotions` → the
  DS-6-1 rail (active+window+`show_on_menu_home`). Page edits are surgical (import/tab/load/render).

## Guardrails verified

- Additive studio tab + actions + one data-load + render branch; ops-only (`requireOps`); no public
  surface; no migration. Existing tabs/tenants untouched. Writes via ops RLS.

## Known limitations

- No `promotion_items` linking / bundle pricing (needs order-calc changes — later). Image is a pasted
  URL (no upload). Print/QR/export-hash inclusion of promotions → **DS-7**.

## Next

DS-6 complete (display + CRUD). **DS-7 · Export Management** — server-side PDF/PNG → storage,
`qr_exports`/`print_exports`, data-hash/outdated/regenerate.
