# RzRz Bridge App — Architecture & Integration Rules

> Reference for building, debugging, and extending the Bridge App.
> The Bridge App is the ONLY integration layer between MenuLink and RzRz POS.

## What the Bridge App Does

The Bridge App is a .NET Windows Service that runs on the restaurant's local network. It:
1. Subscribes to Supabase `pos_outbox` table via Realtime (with polling fallback)
2. Claims pending outbox rows (status: pending → claimed)
3. Builds InsertInvoice XML from the outbox payload + pos_item_map
4. Calls SQL Server `EXEC InsertInvoice` to create a POS invoice
5. Updates the outbox row with result (synced + pos_invoice_id, or failed + error)

## Architecture

```
MenuLink Cloud (Supabase)          Restaurant LAN
┌─────────────────────┐            ┌──────────────────────┐
│  pos_outbox         │            │  Bridge App (.NET)   │
│  (Realtime pub)     │◄──────────►│  - Realtime sub      │
│                     │   wss://   │  - Polling fallback  │
│  pos_settings       │            │  - XML builder       │
│  pos_item_map       │            │  - SQL caller        │
└─────────────────────┘            │                      │
                                   │         ▼            │
                                   │  SQL Server          │
                                   │  InsertInvoice       │
                                   │  → Invoice           │
                                   │  → InvoiceDetails    │
                                   │  → KitichenOrderForPrint │
                                   │  → Kitchen printers  │
                                   └──────────────────────┘
```

## Bridge App Version History

- **v2.3** — HoldMode default true (orders land as held drafts)
- **v2.4** — InvoiceNotes_A shortened for thermal printer width
- **v2.5** — reads InvoiceType/OnlineCustomerId/CounterId/SectionId from payload.pos snapshot
- **v2.6** — Arabic order_type label in InvoiceNotes (later found to be stripped by cashier UI)
- **v2.7** — order_type label moved to InvoiceNotes_A as prefix (durable)

## Configuration (per-tenant, per-branch)

Bridge App reads config from `pos_settings` payload snapshot in each `pos_outbox` row:

| Setting | Source | Example |
|---------|--------|---------|
| `online_customer_id` | `pos_settings.online_customer_id` | `999` (MenuLink) |
| `invoice_type` | `pos_settings.invoice_type` | `1` (Dine-In as neutral default) |
| `counter_id` | `pos_settings.counter_id` | `1` (SERVER-RES2) |
| `default_user_id` | `pos_settings.default_user_id` | `1` (Admin) |
| `tax_percent` | `pos_settings.tax_percent` | `15.00` |
| `is_tax_inclusive` | `pos_settings.is_tax_inclusive` | `true` |

**Current live config on RzRz Bukhari:**
- `online_customer_id = 0` (was 999 during testing, reset to 0 for neutral)
- `invoice_type = 1` (Dine-In as neutral — per-type map parked at `{}`)
- Per-type invoice_type_map is parked because changing types in cashier UI triggers a workflow popup loop
- Infrastructure for per-type icons is in place; flip the map back when Samer patches the .NET cashier UI

## Item Mapping Flow

1. MenuLink `menu_items` have UUIDs as IDs
2. POS `Items` have bigint `ItemID`s
3. `pos_item_map` links them: `(restaurant_id, menu_item_id, pos_item_id, pos_variant_key)`
4. Bridge App looks up each order item's `pos_item_id` from the payload's item mapping
5. If an item has no mapping, Bridge logs an error and skips that item (or fails the order)

**RzRz Bukhari:** 52 pos_item_map rows — all 62 menu items mapped (including variant-level mappings)

## Kitchen Print Routing

Bridge App does NOT implement print routing. Writing `InvoiceDetails` + `KitichenOrderForPrint` rows is sufficient — the POS cashier UI's print dispatcher reads `ItemPrinters` table and routes to the correct Windows printer.

**Almalaz kitchen printers (TCP/IP on LAN):**
- `KETCHIN` (192.168.1.177) — master, prints ALL items
- `BBQ` (192.168.1.175) — BBQ section only
- `DESERT` (192.168.1.179) — Dessert section only
- `KABULE` (192.168.1.181) — Family section only

**Critical:** Windows printer name must be `KETCHIN` (the typo), not `KITCHEN`.

## Outbox Row Lifecycle

```
pending   → Bridge hasn't seen it yet
claimed   → Bridge picked it up, processing
synced    → Successfully inserted into POS
failed    → InsertInvoice call failed (see last_error)
skipped   → Manually skipped by ops
```

## Error Handling

- Bridge retries up to `attempts` times (configurable)
- Failed rows stay in outbox with `last_error` message
- Common errors: wrong ItemID (unmapped item), SQL connection timeout, InsertInvoice proc exception
- Ops can manually skip or retry failed rows from the ops panel

## What the Bridge App Does NOT Do

- Does NOT connect to MenuLink Cloud directly (only via Supabase Realtime)
- Does NOT modify MenuLink data (only reads pos_outbox, writes status back)
- Does NOT implement kitchen print routing (POS handles it)
- Does NOT handle ZATCA (POS handles it)
- Does NOT manage the POS UI (it's headless, writes to DB only)

## Future Enhancements (planned)

1. **Heartbeat reporting** — write to a `bridge_heartbeats` table every 60s with version, machine name, local DB name
2. **Sync event logging** — write to `pos_sync_events` after each InsertInvoice with duration, result, error details
3. **Reconciliation** — periodically query POS Invoice table, compare against pos_outbox for discrepancies
4. **Table operations** — open/append POS tables for dine-in sessions
5. **Driver assignment** — sync driver info to POS if supported
