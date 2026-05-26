# POSMON-1: POS Sync Monitoring Dashboard v1 — Proof

**Date:** 2026-05-26
**Phase:** 3 (POSMON-1)

## Files Changed

| File | Change |
|------|--------|
| `apps/web/app/admin/pos/pos-dashboard.tsx` | Removed item mapping write controls, added branch filter |

## Files NOT Changed (already existed and met requirements)

| File | Status |
|------|--------|
| `apps/web/app/admin/pos/page.tsx` | Already had: requireOwner guard, hasAddon("pos_bridge") gate, all 6 data fetches |
| `apps/web/app/admin/layout.tsx` | Already had: nav entry `{ href: "/admin/pos", addon: "pos_bridge" }` |

## Migrations

None. All required tables (`pos_outbox`, `pos_sync_events`, `pos_settings`, `pos_item_map`) already exist from migrations 0009, 0012, 0043.

## Dashboard URL

`/admin/pos` — visible only when `pos_bridge` addon is enabled for the tenant.

## Dashboard Tabs

| Tab | Content | Realtime? | Read-only? |
|-----|---------|-----------|------------|
| Overview | 6 KPI cards + health banner + recent failures | Yes (via outbox) | Yes |
| Outbox Queue | Full table with status + branch filters, expandable rows with redacted payload | Yes (INSERT + UPDATE) | Yes |
| Sync Events | Audit trail table | No (manual refresh) | Yes |
| POS Settings | Read-only config display | No | Yes |
| Item Mapping | Mapped/unmapped counts + lists | No | Yes (write controls removed) |

## Overview Cards

| Card | Color | Source |
|------|-------|--------|
| Synced | Green | `pos_outbox WHERE status='synced'` count |
| Failed | Rose | `pos_outbox WHERE status='failed'` count |
| Pending | Amber | `pos_outbox WHERE status='pending'` count |
| In Progress | Blue | `pos_outbox WHERE status='claimed'` count |
| Success Rate | Emerald | `synced / (synced + failed) * 100` |
| Avg Duration | Purple | `AVG(pos_sync_events.duration_ms)` |

## Health Banner

Uses "آخر نشاط مزامنة" (NOT "heartbeat"):
- 🟢 Active: sync activity within 5 minutes
- ⚪ Idle: no pending rows, no recent activity
- 🔴 Stale: pending rows older than 5 minutes with no activity

## Security

| Check | Result |
|-------|--------|
| Auth guard | `requireOwner()` in page.tsx |
| Addon gate | `hasAddon(me.restaurant_id, "pos_bridge")` → 404 if disabled |
| Cross-tenant | RLS on all tables scopes to `restaurant_id` via `owns_restaurant()` |
| Payload redaction | `redactPayload()` masks phone, address, name |
| Nav visibility | Layout filters by addon — POS nav hidden when addon disabled |

## Addon Gate Behavior

| Tenant | pos_bridge enabled? | Nav visible? | Page accessible? |
|--------|-------------------|-------------|-----------------|
| KO-KO | No | No | 404 |
| rzrz-bukhari | Yes | Yes | Yes |
| rzrz-bukhari-test | Yes | Yes | Yes |

## Read-Only Item Mapping Confirmation

- `mapItem()` function: REMOVED
- Input fields: REMOVED
- "ربط" buttons: REMOVED
- Write state (`mappingInputs`, `mappingError`, `mappingSaving`): REMOVED
- Unmapped items show static "بدون ربط" label + contact support message

## Safety Confirmation

- No Bridge App changes
- No local SQL connection
- No migrations created or applied
- No credentials stored or printed
- No customer data exposed (payload redaction active)
- KO-KO: NOT modified (pos_bridge not enabled, nav hidden)
- Live RzRz: NOT modified
- rzrz-bukhari-test: NOT modified

## Build Result

TypeScript type-check: PASSED (no errors)
