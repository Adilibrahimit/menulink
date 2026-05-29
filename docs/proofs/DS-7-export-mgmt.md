# Proof · DS-7 — Export Management

- **Date:** 2026-05-29 · **Phase:** DS-7 · **Branch:** `ds-7-export-mgmt` · **Migration:** 0067
- **Spec/Plan:** `docs/superpowers/specs/2026-05-29-ds-7-export-mgmt-design.md` ·
  `docs/superpowers/plans/2026-05-29-ds-7-export-mgmt.md`

## Scope shipped (and what was deliberately NOT)

DS-7 here ships roughly the lower-risk **third** of the pack's DS-7 surface — the parts that are
verifiable on this machine without new infrastructure:

- **Outdated-detection** via an export **fingerprint** RPC.
- **QR exports saved to storage** + a downloadable, per-link **history** with an **outdated** badge.

**Deliberately deferred (documented infra, not built):** **server-side PDF/PNG rendering via headless
Chromium** (the heaviest piece). Reasons, plainly: a Vercel-Chromium pipeline has large function
bundles + deploy fragility, and a headless render **cannot be verified on this OOM-prone machine**, so
shipping it unverified would violate the standing "stop on failure / no unverified deploys" rule.
DS-5's browser print-to-PDF + DS-4's client QR download already cover the user-facing export need
today. Also deferred: `print_exports` storage, a regenerate-queue worker, and failure-retry.

## Files changed

```
A apps/web/supabase/migrations/0067_get_export_fingerprint.sql   (RPC; additive)
A apps/web/app/ops/tenants/[id]/design/export-actions.ts          (recordQrExport — ops)
M apps/web/app/ops/tenants/[id]/design/qr-tab.tsx                 (save button + saved-exports list + outdated badge)
M apps/web/app/ops/tenants/[id]/design/page.tsx                   (load qr_exports + fingerprint; pass to QrTab)
A docs/proofs/DS-7-export-mgmt.md
```

## What was built

- **`get_export_fingerprint(p_slug)`** — `SECURITY DEFINER`, anon+authenticated. `md5` over the
  composed text of `get_public_menu` + `get_active_promotions` + `get_published_design`. Any change to
  menu/prices/images/promotions/design tokens ⇒ a new hash ⇒ a stored export whose `data_hash` no
  longer matches is **outdated**. Composing three proven RPCs avoids column assumptions.
- **`recordQrExport`** (`"use server"`, `requireOps`) — decodes the client PNG data URL, uploads to the
  existing public `menu-images` bucket at `exports/{restaurantId}/qr/{qrLinkId}-{ts}.png` via
  `adminClient()` (service role; bypasses storage RLS; `image/png` is within the bucket's allowed
  mime-types + 5 MB cap), then inserts `qr_exports` (`export_type='png'`, `file_url`,
  `data_hash`=current fingerprint, `status='rendered'`, `rendered_at`). No new bucket / no new deps.
- **QR tab** — a "💾 حفظ نسخة" button per link (renders the 1024px PNG, calls `recordQrExport`,
  `router.refresh`) + a saved-exports list per link: download (`file_url`) + an **outdated** badge
  ("قديم — تغيّرت البيانات") when `data_hash` ≠ the current fingerprint, else "محدّث".
- **page.tsx** — loads the tenant's `qr_exports` in the `Promise.all` + the current fingerprint
  (`get_export_fingerprint(slug)`); passes `qrExports` (prop renamed from `exports` to avoid shadowing)
  + `fingerprint` to `QrTab`.

## Verification

- **`tsc --noEmit`** clean; **`npm run build`** SUCCESS (`/ops/tenants/[id]/design` compiles, 7.61 kB).
- **Migration 0067 applied to live** (`dhmjrrsynfvomlzhggvu`) via the Management API (additive RPC).
- **Fingerprint RPC (read-only):** `get_export_fingerprint('rzrz-bukhari-test')` =
  `9d4b6dc3…02ca` (32-char md5), **identical** across two calls (deterministic);
  `get_export_fingerprint('koko')` = `4f18a24a…8348` (distinct, non-null).
- **Write path (`rzrz-bukhari-test` tenant only):** an insert mirroring `recordQrExport`
  (`export_type='png'`, `data_hash`=current fingerprint, `status='rendered'`) returned
  `status=rendered`, **`matches_current=True`** (⇒ UI shows "محدّث", not outdated). Probe row then
  **deleted** (`test tenant qr_exports remaining: 0`). **`koko` qr_exports = 0 throughout** (untouched).

## Guardrails verified

- Additive RPC + ops-only server action + QR-tab/page additions. No Chromium, no new npm deps, no new
  storage bucket, no RLS changes. Writes via `adminClient` to the existing public bucket under
  `exports/`. Production tenants unaffected (`koko` untouched; no profiles needed). Smoke/write test
  used `rzrz-bukhari-test` exclusively and was cleaned up.

## Known limitations

- **Storage upload not runtime-verified.** The clone test inserted a `qr_exports` row with a *fake*
  `file_url`, so it verified the fingerprint RPC, the outdated logic, the `qr_exports` columns, and
  the bucket's public-read config — but **not** the live `base64 → adminClient.upload → getPublicUrl`
  chain inside `recordQrExport` (that path is verified only by `tsc`). It's additive + ops-only and
  no production tenant has QR links that auto-trigger it, so the first ops "💾 حفظ نسخة" click in
  prod is its real smoke test.
- Save creates a **new** export row each time (no dedupe / no "regenerate-in-place"). Outdated rows
  are flagged but not auto-pruned. No `print_exports` (full-menu PDF) storage. Server-side Chromium
  rendering deferred (above).

## Next

DS-7 core complete. **Remaining infra (future):** Chromium server PDF/PNG + `print_exports` storage +
regenerate worker. **DS-8 · Remotion** = architecture-space only (schema + doc; no install, per pack).
