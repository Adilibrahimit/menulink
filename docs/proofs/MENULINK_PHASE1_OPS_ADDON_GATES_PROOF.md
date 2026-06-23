# Phase 1 Proof: OPS Add-on Catalog Gates

**Date:** 2026-05-25
**Phase:** Phase 1 — Global Add-on Gate Foundation
**Status:** Complete

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/supabase/migrations/0034_global_ops_addon_catalog.sql` | **Created.** Seeds 7 new addon_catalog entries. |
| `apps/web/lib/addons.ts` | **Modified.** Extended `AddonKey` union type with 7 new keys. |
| `docs/proof/MENULINK_PHASE1_OPS_ADDON_GATES_PROOF.md` | **Created.** This file. |

## Migration Added

**`0034_global_ops_addon_catalog.sql`** — INSERT with `ON CONFLICT (key) DO NOTHING` (idempotent).

## Add-on Keys Added

| Key | Arabic Label | Category | Price (SAR/mo) | is_default | Enabled for existing tenants? |
|-----|-------------|----------|----------------|------------|-------------------------------|
| `multi_branch` | الفروع المتعددة | operations | 39 | false | **No** |
| `branch_admins` | مدراء الفروع | operations | 29 | false | **No** |
| `branch_accounting` | حسابات الفروع | operations | 29 | false | **No** |
| `business_day_numbering` | أرقام الطلبات حسب يوم التشغيل | operations | 19 | false | **No** |
| `drivers` | السائقين | operations | 49 | false | **No** |
| `delivery_zones` | نطاقات التوصيل | operations | 39 | false | **No** |
| `advanced_reports` | التقارير المتقدمة | operations | 29 | false | **No** |

## Pre-existing Keys (Unchanged)

| Key | Status |
|-----|--------|
| `tables_qr` | Already in catalog (sort_order 10, is_default=true). Unchanged. |
| `excel_export` | Already in catalog (sort_order 20, is_default=true). Unchanged. |
| `pos_bridge` | Already in catalog (sort_order 30, is_default=false). Serves as `pos_integration`. Unchanged. |
| `loyalty` | Already in catalog (sort_order 40, is_default=false). Unchanged. |
| `push_marketing` | Already in catalog (sort_order 50, is_default=false). Unchanged. |

## OPS UI Behavior

The existing `AddonManager` component (`apps/web/app/ops/tenants/[id]/addon-manager.tsx`) reads all rows from `addon_catalog` dynamically and renders them grouped by category. **No UI changes were needed** — the new catalog entries will automatically appear in the "العمليات" (operations) category on the OPS tenant detail page (`/ops/tenants/[id]`).

Each service shows:
- Arabic name + description
- `is_default` badge (none of the new ones have it)
- Price display ("السعر الافتراضي: X ر.س/شهر")
- Enable/disable toggle
- Trial end date, custom price override, notes fields
- Save button per service

## Feature Gate Helper

`lib/addons.ts` already provides:
- `getEnabledAddons(restaurantId)` → `Set<AddonKey>` — returns all enabled addons
- `hasAddon(restaurantId, key)` → `boolean` — equivalent to `isAddonEnabled()`

The `AddonKey` type was extended to include the 7 new keys. No `getAddonLimit` was added because the current model does not have a JSON config/limits field.

## Build Result

```
npm run build → ✅ Success (no errors, no warnings)
All routes compiled. No regressions.
```

## Regression Notes

- **Existing tenants:** No data changes. All 4 active tenants (koko, rzrz-bukhari, sadaf-bukhari, maedah-house) continue working exactly as before. Their `subscription_addons` rows are untouched.
- **Existing addons:** The 5 original addon_catalog entries are preserved via `ON CONFLICT DO NOTHING`.
- **Auto-enable:** None of the new entries use `is_default=true`, so they are NEVER auto-seeded during tenant onboarding.
- **Customer PWA:** No changes to any customer-facing code.
- **Admin UI:** No changes to admin sidebar, pages, or guards.

## NOT Implemented (Confirmed)

- ❌ No branch tables (`restaurant_branches`)
- ❌ No `branch_id` on orders
- ❌ No driver tables
- ❌ No business day / invoice sequence / daily order number
- ❌ No delivery zone tables
- ❌ No RzRz POS delivery workflow changes
- ❌ No RzRz table workflow changes
- ❌ No customer PWA changes
- ❌ No admin branch UI
- ❌ No schema changes beyond addon_catalog INSERT
