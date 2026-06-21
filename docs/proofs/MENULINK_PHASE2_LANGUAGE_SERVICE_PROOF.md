# Phase 2 Proof: Language Service Foundation

**Date:** 2026-05-25
**Phase:** Phase 2 — Language Service Foundation
**Status:** Complete

---

## Files Added

| File | Purpose |
|------|---------|
| `apps/web/lib/i18n/locales.ts` | Locale type (`ar` / `en`), default, cookie name, guard |
| `apps/web/lib/i18n/ar.ts` | Arabic dictionary (7 sections, ~60 keys) |
| `apps/web/lib/i18n/en.ts` | English dictionary (same structure as Arabic) |
| `apps/web/lib/i18n/format.ts` | `formatNumber`, `formatCurrency`, `formatDate`, `toArabicIndic` |
| `apps/web/lib/i18n/rtl.ts` | `dir()` and `isRTL()` helpers |
| `apps/web/lib/i18n/index.ts` | Main export: `getLocale()`, `getDictionary()`, `t()`, re-exports |
| `apps/web/lib/i18n/actions.ts` | Server action `setLocale()` — writes cookie |
| `apps/web/app/ops/locale-toggle.tsx` | Client component: AR/EN toggle button |

## Files Modified

| File | Change |
|------|--------|
| `apps/web/app/ops/layout.tsx` | Uses `getLocale()` + `dir()` for dynamic direction. Sidebar labels switch AR/EN. Logout button reads from dictionary. LocaleToggle added to header. |

## Architecture

- **Locale storage:** Per-user browser cookie (`menulink_locale`), default `ar`
- **Server access:** `getLocale()` reads cookie via `next/headers`
- **Client toggle:** `setLocale()` server action writes cookie, `router.refresh()` rerenders
- **Direction:** `dir(locale)` returns `"rtl"` or `"ltr"`, applied to OPS layout root `<div>`
- **Translation:** `t("section.key")` with optional `{param}` interpolation
- **Formatting:** Arabic-Indic numerals, SAR currency, Riyadh-timezone dates
- **No npm dependencies added**

## Dictionary Sections

| Section | Keys | Coverage |
|---------|------|----------|
| `common` | save, cancel, delete, edit, add, search, loading, no_data, confirm, back, logout, language, switch_language | Shared across surfaces |
| `order_type` | delivery, pickup, dine_in, car | 4 order types |
| `order_status` | submitted, confirmed, preparing, ready, delivered, cancelled | 6 statuses |
| `admin` | dashboard, orders, menu, customers, qr, tables, loyalty, broadcast, info | Sidebar nav labels |
| `ops` | restaurants, add_restaurant, details, subscription, last_payment, total_orders, design, addons, owners, payments, qr_code, restaurant_info | OPS tenant detail labels |
| `subscription_status` | pending_payment, active, overdue, cancelled | 4 states |
| `addon` | enabled, disabled, default_badge, price_label, free, trial_available, trial_end, custom_price, notes, unsaved, saved | Addon manager labels |

## Demo Location

**OPS Layout** (`/ops/*`):
- Header shows an **EN/ع** toggle button
- Clicking it switches the entire OPS shell: sidebar labels, logout button, and layout direction (RTL ↔ LTR)
- Cookie persists across page navigations and browser sessions

## What Is NOT Translated Yet

These screens still use hardcoded Arabic strings — they will be migrated incrementally in future phases:

- Customer PWA (`/m/[slug]/*`) — all components
- Tenant Admin (`/admin/*`) — layout, all pages
- OPS tenant detail page content (`/ops/tenants/[id]`)
- OPS payments page (`/ops/payments`)
- OPS onboarding wizard (`/ops/tenants/new`)
- OPS main tenant list (`/ops/page.tsx`)
- Marketing landing page (`/page.tsx`)
- Login pages (`/admin/login`, `/ops/login`)
- Error messages and empty states across all surfaces

## Build Result

```
npm run build → Success (no errors, no warnings)
```

## NOT Implemented

- No full app translation (per roadmap: "Do not perform a full app translation in one massive change")
- No changes to Customer PWA
- No changes to Tenant Admin
- No branch/driver/numbering/POS workflow changes
- No schema changes
- No new migrations
