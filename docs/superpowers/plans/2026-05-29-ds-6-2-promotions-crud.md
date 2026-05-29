# DS-6-2 Promotions CRUD — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps `- [ ]`.

**Goal:** Promotions tab (create/activate/delete) in the studio; flows into the DS-6-1 rail.
**Branch:** `ds-6-2-promotions-crud`. No migration. **Verify:** tsc/build + clone.

## Files
- Create `apps/web/app/ops/tenants/[id]/design/promotions-actions.ts` (3 server actions).
- Create `apps/web/app/ops/tenants/[id]/design/promos-tab.tsx` (form + list).
- Modify `apps/web/app/ops/tenants/[id]/design/page.tsx` (import + tab + load + render — mirror the QR tab).

## Task 1 — code (subagent writes files + 4 page edits; tsc+build). Full component/action code + exact `page.tsx` find/replace anchors are provided in the dispatch prompt (mirrors the DS-4-2 QR-tab wiring: `import PromosTab`; `TABS += {key:"promos",label:"العروض"}`; add a `promotions` select to `Promise.all` + the destructure; add the `{active==="promos" && <PromosTab .../>}` render branch).
- [ ] Subagent: create the 2 files + 4 page edits; `tsc --noEmit` + `npm run build` (8192) green.
- [ ] MAIN: review diff (page edits surgical; actions ops-only; no migration); commit.

## Task 2 — verify + proof + PR + merge (MAIN)
- [ ] tsc+build green. Clone sanity: insert a promo (mirrors createPromotion) → appears in `get_active_promotions('rzrz-bukhari-test')`; deactivate drops it; delete removes it; `koko` unaffected.
- [ ] Proof `docs/proofs/DS-6-2-promotions-crud.md`; push; draft PR (base main); merge+deploy.

## Self-Review
- Create/activate/delete actions (ops-only) + tab + list → Task 1. ✓
- Created promos drive DS-6-1 rail (same `promotions` table, `is_active`+window) → verified via `get_active_promotions`. ✓
- No migration; additive studio tab; clone-only verify. ✓ · `promotion_items`/print/export deferred (DS-7).
