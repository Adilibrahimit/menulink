# DS-5 · Print Templates (A3/A4 full menu) — Design Spec

- **Date:** 2026-05-29 · **Phase:** DS-5 · **Branch:** `ds-5-print-routes` · Migrations 0059–0065 live.
- **Status:** Approved (standing approval), pre-implementation.
- **Depends on:** `get_public_menu` RPC (anon, returns `PublicMenu`); `lib/arabic` `toArabicDigits`;
  `lib/allergens` `ALLERGEN_MAP`.

## Goal

Print-ready **A3/A4 full-menu** pages rendered from the live menu, so the operator/owner can
**print-to-PDF** from the browser — with SFDA compliance blocks (VAT, calories, allergens,
last-updated). Generated from the same `get_public_menu` data, so prices/images stay current.

## Scope

**In:** a public print route `/print/[slug]/[size]` (`size` ∈ `a3`|`a4`), server-rendered from
`get_public_menu`; print-optimized HTML + `@page` CSS (A3 landscape / A4 portrait, margins,
`print-color-adjust`), RTL; compliance footer; a client "Print / Save PDF" button
(`window.print()`); one link from the ops tenant page.

**Out (deferred to DS-7 · Export Management):** server-side PDF rendering (Puppeteer/headless
chromium), storage upload, `print_exports` records, data-hash, outdated detection, regenerate.
Per the pack: "HTML/CSS print pages first." The browser's Save-as-PDF satisfies DS-5's
"A3/A4 PDF generated" outcome; the automated/stored pipeline is DS-7.

## Route

`apps/web/app/print/[slug]/[size]/page.tsx` — server component, `export const dynamic =
"force-dynamic"` (always fresh). Loads `get_public_menu(slug)` (anon — only published+active
restaurants; same data already public at `/m/[slug]`, no new exposure). Validates `size` to
`a4` (default) or `a3`. Renders a light, print-friendly layout:
- **Header:** logo + name + tagline, brand-colored rule.
- **Categories → items:** per category a heading + an item grid (A3 = 3 cols, A4 = 2 cols); each
  item shows name, optional description, a calories + allergens line, and variant price(s) in
  `toArabicDigits` + `ر.س`. `break-inside: avoid` on sections/items.
- **Compliance footer:** "الأسعار شاملة ضريبة القيمة المضافة (15%)", calorie-guidance note, and
  "آخر تحديث: <date> · <name>".
- A `@page { size: <A3 landscape|A4 portrait>; margin: 10mm }` + `print-color-adjust: exact` via an
  injected `<style>`; a `.no-print` wrapper hides the print button when printing.

`print-button.tsx` — tiny client component calling `window.print()`.

## Link

Add a "🖨️ طباعة المنيو (A4)" link on `apps/web/app/ops/tenants/[id]/page.tsx` (near the Design
Studio link) → `/print/{slug}/a4` (new tab). (A3 reachable by editing the URL to `/a3`.)

## No migration

Reads `get_public_menu`; `print_exports` stays unused until DS-7.

## Safety / guardrails

- Additive new route + one link. Existing surfaces (`/m/[slug]`, `/admin/*`, `/ops/*`) untouched.
- Reads only already-public menu data via the existing RPC; no writes, no new DB exposure.
- Verify on `rzrz-bukhari-test`; the route also works for any published tenant (additive, read-only)
  — but smoke only the clone per the standing rule.

## Files

Create: `apps/web/app/print/[slug]/[size]/page.tsx`, `apps/web/app/print/[slug]/[size]/print-button.tsx`.
Modify: `apps/web/app/ops/tenants/[id]/page.tsx` (one link).

## Verification

- `tsc` + `build` green; `/print/[slug]/[size]` present.
- Smoke `/print/rzrz-bukhari-test/a4` and `/a3` → renders the menu with prices/calories/allergens +
  compliance footer; the Print button triggers the browser print dialog (operator step).
- `/print/<bad-slug>` → 404.

## Next

**DS-6 · Promotions** (display on `/m` + print inclusion), then **DS-7** (export management incl.
server-side PDF/PNG → storage, `print_exports`/`qr_exports`, regenerate/outdated), **DS-8**
(Remotion architecture-space).
