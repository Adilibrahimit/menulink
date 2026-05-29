# DS-7 · Export Management — Design Spec

- **Date:** 2026-05-29 · **Phase:** DS-7 · **Branch:** `ds-7-export-mgmt` · Migrations 0059–0066 live.
- **Status:** Approved (standing approval). **Depends on:** DS-1 `qr_exports`; DS-4 QR tab/links;
  `get_public_menu`/`get_active_promotions`/`get_published_design`; `menu-images` storage bucket
  (0007, public read, ops write); `adminClient()` (service role).

## Goal

Export **management**: detect when an export is **outdated** (source data changed) and let ops
**save QR exports to storage** with a downloadable history. Built without headless Chromium.

## Scope

**In:**
- `get_export_fingerprint(p_slug)` RPC — a stable `md5` over the composed output of
  `get_public_menu` + `get_active_promotions` + `get_published_design` (menu/prices/images +
  promotions + design tokens). Any change ⇒ new hash ⇒ stored exports become outdated.
- `recordQrExport` server action — ops-only; given a client-rendered PNG data URL + `qrLinkId`,
  upload to `menu-images` at `exports/{restaurantId}/qr/{qrLinkId}-{ts}.png` via `adminClient()`,
  then insert `qr_exports` (`file_url`, `data_hash` = fingerprint, `export_type='png'`,
  `status='rendered'`, `rendered_at`).
- QR tab: a "💾 حفظ نسخة" button per link (renders the PNG, calls `recordQrExport`) + a saved-
  exports list per link (download `file_url` + an **outdated** badge when `data_hash` ≠ current
  fingerprint).

**Out (deferred — documented infra):** **server-side print/QR PDF via headless Chromium** (Vercel
function-size/deploy fragility; cannot verify a headless render on this machine; DS-5 browser-PDF
covers print today) — remains a future infra task. Also out: print-export storage, regenerate-queue
worker, failure-retry.

## No new bucket

Reuse `menu-images` under an `exports/` prefix (service-role upload via `adminClient` bypasses
storage RLS; bucket is public-read → downloadable `file_url`). No new storage policy/migration.

## Migration 0067 — `get_export_fingerprint`

`SECURITY DEFINER`, anon+authenticated:
```sql
create or replace function public.get_export_fingerprint(p_slug text)
returns text language sql stable security definer set search_path = public as $$
  select md5(
    coalesce(public.get_public_menu(p_slug)::text, '') ||
    coalesce(public.get_active_promotions(p_slug)::text, '') ||
    coalesce(public.get_published_design(p_slug)::text, '')
  );
$$;
grant execute on function public.get_export_fingerprint(text) to anon, authenticated;
```
Robust — composes three proven RPCs; no column assumptions.

## UI / data

- `page.tsx` (studio): additionally load the tenant's `qr_exports` (id, qr_link_id, file_url,
  data_hash, status, rendered_at) + the current fingerprint (`get_export_fingerprint(slug)`); pass
  to `QrTab`.
- `qr-tab.tsx`: thread `exports` + `fingerprint` + `restaurantId` into `QrLinkCard`; add the save
  button + saved-exports list (download + outdated badge).

## Safety

- Additive RPC + server action + QR-tab/page additions. Ops-only writes; `adminClient` upload to the
  existing public bucket under `exports/`. `qr_exports` RLS untouched (admin bypasses). No Chromium,
  no new deps, no new bucket. Verify on `rzrz-bukhari-test`.

## Files

Create: `migrations/0067_get_export_fingerprint.sql`,
`apps/web/app/ops/tenants/[id]/design/export-actions.ts`. Modify: `qr-tab.tsx`, studio `page.tsx`.

## Verification (clone)

- Apply 0067; `get_export_fingerprint('rzrz-bukhari-test')` returns a 32-char md5; calling twice
  with no data change → identical; `get_export_fingerprint('koko')` differs.
- `tsc` + `build` green. (Save-to-storage exercised via the ops UI; the `qr_exports` insert + storage
  path verified by an `adminClient`-equivalent PAT insert/read on the clone.)

## Next

DS-7 core done. **Deferred infra:** server-side Chromium PDF/PNG + print-export storage +
regenerate worker. **DS-8 · Remotion** = architecture-space only (schema + doc; no install, per pack).
