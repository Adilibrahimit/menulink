# Proof · DS-5 — Print Templates (A3/A4)

- **Date:** 2026-05-29 · **Phase:** DS-5 · **Branch:** `ds-5-print-routes`
- **Spec/Plan:** `docs/superpowers/specs/2026-05-29-ds-5-print-routes-design.md` ·
  `docs/superpowers/plans/2026-05-29-ds-5-print-routes.md`

## Goal

Print-ready A3/A4 full-menu pages from the live `get_public_menu` data, browser print-to-PDF, with
SFDA compliance blocks. Server-side PDF + storage + `print_exports` deferred to DS-7.

## Files changed

```
A apps/web/app/print/[slug]/[size]/page.tsx          (server print page; @page CSS via a <style> string child)
A apps/web/app/print/[slug]/[size]/print-button.tsx  (client window.print())
M apps/web/app/ops/tenants/[id]/page.tsx             (print link -> /print/{slug}/a4)
A docs/proofs/DS-5-print-routes.md
```

No migration.

## What was built

- `/print/[slug]/[size]` (`a3` -> A3 landscape/3-col, `a4` -> A4 portrait/2-col),
  `dynamic="force-dynamic"`, reads `get_public_menu` (anon; published+active only). Light print
  layout: header (logo/name/tagline + brand rule), categories -> items (name, description,
  **calories + allergens line**, variant prices in `toArabicDigits` + ر.س), `break-inside: avoid`.
  Compliance footer: VAT-inclusive note, calorie-guidance, last-updated date + name.
  `@page { size; margin }` + `print-color-adjust: exact` injected via a `<style>{css}</style>`
  string child.
- `PrintButton` (client) -> `window.print()`; hidden in print via `.no-print`.
- A print link on the ops tenant page.

## Verification

- `tsc --noEmit` clean; `npm run build` SUCCESS — `/print/[slug]/[size]` present (dynamic `ƒ`).
- Print page reads the anon `get_public_menu` (same data as `/m/[slug]`); renders for any published
  tenant. Operator browser smoke: `/print/rzrz-bukhari-test/a4` & `/a3` -> menu + compliance footer;
  `/print/<bad>` -> 404.

## Guardrails verified

- Additive new route + one link; existing surfaces (`/m/[slug]`, `/admin/*`, `/ops/*`) untouched.
- Reads only already-public menu data via the existing RPC; no writes, no new data exposure.
- CSS injected via a `<style>` string child built only from the validated `a3`/`a4` size — no
  raw-HTML injection API, no untrusted interpolation.

## Known limitations

- Browser print-to-PDF only. Automated **server-side PDF/PNG -> storage + `print_exports` +
  data-hash + outdated/regenerate** is **DS-7** (export management).
- Single full-menu template (A3 landscape / A4 portrait). Per-category/item/offer print cards later.

## Next

**DS-6 · Promotions** — structured offers shown on `/m/[slug]` (and includible in print).
