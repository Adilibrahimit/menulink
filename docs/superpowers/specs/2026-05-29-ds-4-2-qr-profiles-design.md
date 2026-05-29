# DS-4-2 · QR Profiles + Dynamic Link + Preview + Download — Design Spec

- **Date:** 2026-05-29
- **Phase:** DS-4-2 (second slice of DS-4). Migrations 0059–0065 live.
- **Status:** Approved design (standing approval), pre-implementation
- **Branch:** `ds-4-2-qr-profiles` (off `main`)
- **Depends on:** DS-1 tables `restaurant_qr_profiles`/`qr_links`/seeded `qr_design_templates`;
  DS-4-1 `/q/{code}` route + `resolve_qr_link`; DS-2 studio at `/ops/tenants/[id]/design`;
  `lib/design/qr.ts` (`generateShortCode`, `buildQrDestination`); existing `MenuQR` +
  `menu-qr-poster.ts` + `qrcode` lib.

## Goal

Let ops create a branded **dynamic** QR code for a tenant: a `restaurant_qr_profile` + a `qr_link`
(short `code`, destination via `buildQrDestination`) that the QR encodes as `{origin}/q/{code}` —
so scans flow through DS-4-1's redirect + tracking. Preview the QR and download PNG/SVG/poster
client-side. No storage/export-history (that's DS-7).

## Scope

**In:** a **QR tab** in the design studio; a `createQrCode` server action (profile + link); QR
preview + client-side PNG/SVG/poster download (reuse `MenuQR`/`qrcode`/`menu-qr-poster`); a list of
the tenant's existing QR links with preview/download.

**Out (deferred):** `qr_exports`/storage + data-hash + regenerate/outdated (DS-7); rich target
pickers (offer/category/item use simple id text); link editing/repointing/deactivate UI (links are
created `is_active=true`; management UI later); QR-design-template *token* theming of the poster
(the poster reuses the existing `menu-qr-poster` styles).

## QR tab

Add `{ key: "qr", label: "رموز QR" }` to the studio `TABS` (5th tab). The studio `page.tsx`
(server) additionally loads, for the tenant:
- `restaurant_qr_profiles` joined to their `qr_links` and `qr_design_templates(key,name_ar)`,
  ordered by `created_at desc`;
- active `qr_design_templates` (id, key, name_ar, output_type, paper_size) for the create form.
Renders `<QrTab restaurant={…} templates={…} qrProfiles={…} />` when `?tab=qr`.

`qr-tab.tsx` (client): a **create form** (template select; `name_ar`; `purpose` =
menu/table/offer/category/item; a `target` input shown per purpose) + a **list** of existing QR
links, each with a `QRCode.toCanvas` preview of `{origin}/q/{code}` and PNG/SVG/poster download
buttons (the `MenuQR` pattern, reused).

## Server action

`apps/web/app/ops/tenants/[id]/design/qr-actions.ts` — `"use server"`:

```
createQrCode({ restaurantId, slug, templateId, nameAr, purpose, target }) -> { code } | { error }
```
1. `requireOps()`.
2. Build the `QrTarget` from `purpose` + `target` (menu → `{type:'menu'}`; table → `{type:'table', tableLabel:target}`; offer/category/item → `{type, <id>:target}`); `destination = buildQrDestination(slug, qrTarget)`; `code = generateShortCode()`.
3. Insert `restaurant_qr_profiles` (`restaurant_id`, `qr_design_template_id=templateId`, `name_ar=nameAr`, `purpose`, `status='published'`) → `profileId`.
4. Insert `qr_links` (`restaurant_id`, `qr_profile_id=profileId`, `code`, `target_type=purpose`, `destination_url=destination`, `is_active=true`).
5. `revalidatePath` the studio; return `{ code }`.
Uses the server Supabase client (ops session → ops RLS write) or `supabase-admin`. `generateShortCode`/`buildQrDestination` run server-side (the former uses `node:crypto`).

New QR profiles default to `status='published'` so the link is immediately usable.

## Preview + download (reuse)

Reuse the `MenuQR` mechanics directly in `qr-tab.tsx`: `QRCode.toCanvas`/`toDataURL`/`toString`
on `{origin}/q/{code}` (error-correction `H`, margin 2), and `generatePosterDataUrl` +
`triggerDownload` from `menu-qr-poster.ts` for the branded poster. No new rendering lib.

## No migration

All tables exist (DS-1). DS-4-2 is application code only.

## Safety / guardrails

- Additive: a new studio tab + server action + the existing studio page gains one data-load and
  one tab branch. `/admin/qr`, `restaurant_tables.qr_token` table-QR, and `MenuQR` are untouched.
- Creation is ops-only (`requireOps`); writes go through ops RLS / admin. No public surface added
  (the `/q` route is DS-4-1).
- Verify on `rzrz-bukhari-test` only; never `koko`/`rzrz-bukhari`. If the slug isn't exactly
  `rzrz-bukhari-test`, stop and ask.

## Files

Create: `apps/web/app/ops/tenants/[id]/design/qr-tab.tsx`,
`apps/web/app/ops/tenants/[id]/design/qr-actions.ts`. Modify:
`apps/web/app/ops/tenants/[id]/design/page.tsx` (5th tab + QR data load).

## Verification plan (clone only)

1. `tsc` + `build` green; `/ops/tenants/[id]/design` compiles.
2. In the studio for `rzrz-bukhari-test`, create a `menu` QR → a `restaurant_qr_profile` + a
   `qr_link` exist; the QR preview encodes `{origin}/q/{code}`; PNG/SVG/poster download works.
3. Scan flow: `resolve_qr_link(code)` → returns the destination + records a scan (DS-4-1).
4. Confirm no production tenant rows created.

## Out-of-scope / next

**DS-5 · Print Templates (A3/A4)** — print-ready full-menu output. (Then DS-6 promotions, DS-7
export management incl. `qr_exports`/`print_exports` storage, DS-8 Remotion architecture-space.)
