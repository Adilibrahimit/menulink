# Proof · DS-4-2 — QR Profiles + Dynamic Link + Preview + Download

- **Date:** 2026-05-29 · **Phase:** DS-4-2 (second slice of DS-4) · **Branch:** `ds-4-2-qr-profiles`
- **Spec/Plan:** `docs/superpowers/specs/2026-05-29-ds-4-2-qr-profiles-design.md` ·
  `docs/superpowers/plans/2026-05-29-ds-4-2-qr-profiles.md`

## Goal

A QR tab in the design studio creates a `restaurant_qr_profile` + `qr_link` (encoding
`{origin}/q/{code}`, backed by DS-4-1's redirect+tracking) and previews/downloads it client-side
(PNG/SVG/branded poster). No storage/export-history (DS-7).

## Files changed

```
M apps/web/lib/menu-qr-poster.ts                          (optional qrUrl override; default path preserved)
A apps/web/app/ops/tenants/[id]/design/qr-actions.ts      (createQrCode server action)
A apps/web/app/ops/tenants/[id]/design/qr-tab.tsx         (create form + list + preview + download)
M apps/web/app/ops/tenants/[id]/design/page.tsx           (5th QR tab + data load + tagline_ar)
A docs/proofs/DS-4-2-qr-profiles.md
```

No migration (all tables exist from DS-1). Subagent-driven; main-agent review + commit; DB ops on
`rzrz-bukhari-test` only.

## What was built

- **`createQrCode` server action** (`requireOps`): builds the target via `buildQrDestination`, a
  code via `generateShortCode`, inserts a `restaurant_qr_profiles` (`status='published'`) + a
  `qr_links` (`code`, `destination_url`, `is_active`), revalidates the studio.
- **QR tab** (`qr-tab.tsx`): create form (template/name/purpose/target) + a list of the tenant's
  QR links, each previewing `{origin}/q/{code}` (`QRCode.toCanvas`) with PNG (`toDataURL`), SVG
  (`toString`), and branded poster (`generatePosterDataUrl` with the new `qrUrl` override) downloads
  — the `MenuQR` pattern reused.
- **`page.tsx`**: 5th "رموز QR" tab; loads `restaurant_qr_profiles` (with embedded `qr_links`) +
  active `qr_design_templates`; added `tagline_ar` to the restaurant select for the poster.

## Verification

- `tsc --noEmit` clean; `npm run build` SUCCESS (`/ops/tenants/[id]/design` present).
- **PostgREST embed** `links:qr_links(...)` under `restaurant_qr_profiles` resolves (anon REST →
  **HTTP 200**) — the tab's data load works at runtime.
- **Full chain on `rzrz-bukhari-test`:** created a profile + link (`qr-velora-premium-card-v1`,
  purpose `menu`); `resolve_qr_link('velolabqr2')` → `/m/rzrz-bukhari-test` (DS-4-1 redirect+scan).
  `clone_profiles = 1`.

## Guardrails verified

- `/admin/qr`, `restaurant_tables.qr_token` table-QR, and `MenuQR` untouched; `menu-qr-poster`
  change is additive (default URL path preserved when `qrUrl` absent).
- Creation is ops-only (`requireOps`). No migration. All writes on the clone only; production
  tenants have no QR profiles.

## Known limitations

- No `qr_exports`/storage/data-hash/regenerate — that export-history layer is **DS-7**.
- Simple target inputs (table label / id text); rich pickers later. New links are `is_active=true`;
  repoint/deactivate UI later.

## Next

**DS-5 · Print Templates (A3/A4)** — print-ready full-menu output.
