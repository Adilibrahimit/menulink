# POS Sync Monitoring Dashboard — Architecture & Debugging Guide

> Reference for building, using, and debugging the POS sync monitoring dashboard.

## Dashboard Location

- **URL:** `/admin/pos`
- **Gated by:** `pos_bridge` addon (only restaurants with POS integration see it)
- **Files:** `apps/web/app/admin/pos/page.tsx` (server) + `pos-dashboard.tsx` (client)

## Data Sources (v1 — MenuLink-side only)

| Source | What it shows | Realtime? |
|--------|--------------|-----------|
| `pos_outbox` | Sync queue: pending/claimed/synced/failed orders | Yes (Supabase Realtime) |
| `pos_sync_events` | Audit trail per sync operation | No (manual refresh) |
| `pos_settings` | POS config for this restaurant | No (static) |
| `pos_item_map` | Item ID mapping (MenuLink → POS) | No (static) |
| `pos_table_map` | Table mapping (MenuLink → POS) | No (static) |
| `menu_items` | Active items for unmapped count | No (static) |

## 5 Tabs

### Tab 1: نظرة عامة (Overview)
- 6 KPI cards computed from pos_outbox: synced, failed, pending, claimed, success rate, avg duration
- "آخر نشاط مزامنة" (last sync activity) banner — derived from MAX(claimed_at, synced_at)
  - 🟢 نشط: activity within 5 min OR no pending rows
  - ⚪ خامل: no pending, no recent activity (Bridge has nothing to do)
  - 🔴 متأخر: pending > 5 min old, no activity (Bridge may be offline)
- Recent failures: last 5 failed outbox rows

### Tab 2: صندوق الصادر (Outbox Queue)
- Full outbox table with status pills, POS invoice #, attempts, errors
- Realtime updates (INSERT/UPDATE on pos_outbox)
- Status + branch filters
- Click-to-expand: payload with customer data redacted

### Tab 3: سجل المزامنة (Sync Events)
- pos_sync_events table with operation type, status, duration, errors
- Manual refresh button (not in Realtime publication)

### Tab 4: إعدادات POS (Settings)
- Read-only display of pos_settings
- Owner cannot edit (RLS)

### Tab 5: ربط الأصناف (Item Mapping)
- Mapped items count + table
- Unmapped items list
- Read-only in v1

## Debugging Common Issues

### "All orders stuck in pending"
1. Check "آخر نشاط مزامنة" — if 🔴, Bridge App is likely offline
2. Verify Bridge App is running on the restaurant's cashier PC
3. Check if the restaurant's internet is up (Bridge needs Supabase WebSocket)
4. Check pos_settings.enabled — is it true?

### "Order failed with error"
1. Open the failed row in Outbox tab, expand to see full error
2. Common causes:
   - "Cannot insert NULL into column ItemID" → XML format wrong (check for wrapper element)
   - "Invalid ItemID" → pos_item_map has wrong POS item ID
   - "Connection timeout" → SQL Server not reachable from Bridge
   - "Authentication failed" → SQL credentials changed

### "Order synced but not printing"
1. Invoice exists in POS (pos_invoice_id is populated)
2. Check if invoice is held (IsHold=1) — cashier needs to finalize
3. Check kitchen printer name in Windows matches `KETCHIN` (the typo)
4. Check ItemPrinters table has routing entries for the ordered items

### "Item mapping shows unmapped items"
1. New items added to MenuLink menu but not mapped to POS ItemIDs
2. Owner or ops needs to find the matching POS ItemID from the POS Items table
3. Map it via ops panel (v1 is read-only; mapping writes planned for later with validation)

## What v1 Does NOT Show

- Bridge App version/machine/DB (no heartbeat table yet)
- POS-side invoice status (only knows MenuLink-side outbox status)
- Real-time reconciliation (no Bridge→POS query yet)
- Item mapping writes (read-only for safety)

## Future Phases

| Phase | What it adds |
|-------|-------------|
| BRIDGE-1 | Bridge heartbeat, version display, sync event writing, reconciliation |
| RZRZ-DELIVERY-1 | Delivery lifecycle monitoring, cash settlement, failure reasons |
| RZRZ-TABLE-1 | Table open/close lifecycle, pos_table_map, kitchen print verification |
