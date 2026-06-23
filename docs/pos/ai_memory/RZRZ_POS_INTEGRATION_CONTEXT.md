# RzRz POS Integration Context

> Master context for any Claude session working on POS integration.
> Last updated: 2026-05-26 (session 6 final: all features shipped, heartbeat + invoice sync API built)

## Partnership Model

- **Adil** (the user) is Samer Cefalu's **business partner** in the POS software venture (Punnelifosys)
- They co-own/co-sell the RzRz POS to restaurants
- This means: schema changes are on the table, we ARE Punnelifosys, not asking them to integrate
- Co-branded "RzRz POS + MenuLink" rollout to all Punnelifosys customers is the endgame

## Integration Approach

- **Samer does not provide API keys** — there is no REST API on the POS
- All integration goes through the **Bridge App** (.NET Windows Service)
- Bridge App reads from Supabase `pos_outbox` via Realtime subscription
- Bridge App calls SQL Server `InsertInvoice` stored procedure to create POS invoices
- Bridge App runs on the restaurant's local network, co-located with the POS SQL Server

## What's Proven (2026-05-20)

1. MenuLink online customer row inserted into POS (`OnlineCustomerID = 999`)
2. MenuLink shows up in cashier UI's Online customer picker alongside HungerStation/Jahez/Keeta
3. Direct `EXEC InsertInvoice` from SQL produces correct DB state
4. Held invoice → Finalize transition works
5. Kitchen printers fire correctly when Windows printer name is `KETCHIN` (the typo)
6. Print routing is data-driven via `ItemPrinters(ItemID, Printer, InvoiceTypeID)` — Bridge App doesn't implement routing

## What's Done (session 6)

1. **POS Sync Monitoring Dashboard** — 5 tabs, realtime outbox, sync events, settings, item mapping with auto-suggest
2. **Bridge App heartbeat** — `bridge_heartbeats` table + `POST/GET /api/bridge/heartbeat` + dashboard status card
3. **Invoice status sync** — `POST/GET /api/bridge/invoice-status` for held→confirmed feedback loop
4. **POS items catalog** — `pos_items_catalog` table, 186 items synced on test tenant
5. **Auto-suggest mapping** — Arabic fuzzy matching (normalizeAr) + manual entry with live POS name preview

## What's Remaining

1. **Bridge App .NET side** — add heartbeat sender (60s timer), invoice status poller, pos_items_catalog sync
2. **Delivery invoice workflow** — driver assignment sync, cash settlement, cancellation sync
3. **Table dining invoice workflow** — POS table open/append/close
4. **Reconciliation** — compare MenuLink orders vs POS invoices for discrepancies

## RzRz POS Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | .NET Framework 4.7.2 (Windows-only) |
| UI | WinForms with typed DataSets |
| Database | Microsoft SQL Server (Express or full) |
| ORM | Entity Framework (classic) + ADO.NET stored procedures |
| Reports | Microsoft Report Viewer (RDLC) |
| ZATCA | Built-in UBL 2.1 XML + QR generation |
| Print | Raw ESC/POS via Win32 spooler |
| Auth | Plaintext passwords to sprocs, static session state |

## Two-App Architecture

- **Branch app** (`PunnelifosysResApp.exe`) — 125 WinForms, runs on each POS counter
- **Server app** (`PunnelifosysResAppServer.exe`) — 99 WinForms, head-office admin + reporting
- ~80% form code duplicated between the two

## Connection Topology (Almalaz Branch — verified 2026-05-20)

- Machine: `DESKTOP-8Q7DQKA` (LAN hostname `PUNNELIFOSYS`)
- LAN IP: `192.168.1.113`
- SQL Server: 2022 Express, default instance
- Active DB: `client` (not the stale config name)
- Accounting DB: `samer910_accreef`
- Sync to central: `192.250.231.22` at application level

## Local Test DB (user's machine)

- Server: `(localdb)\ProjectModels`
- Database: `RZRZCLIENT`
- Auth: Windows Authentication
- Data: Copy of old Almalaz branch (414 items, 7 drivers, 6 online customers, 1 test invoice)
- **READ ONLY** — never write unless explicitly approved

## MenuLink Supabase Tables for POS

| Table | Purpose |
|-------|---------|
| `pos_outbox` | Queue of orders awaiting POS sync (pending/claimed/synced/failed/skipped) |
| `pos_sync_events` | Audit trail for every sync operation |
| `pos_settings` | Per-restaurant POS config (kind, branch, customer ID, counter, invoice type, tax) |
| `pos_item_map` | MenuLink item ID → POS item ID mapping |
| `pos_table_map` | MenuLink table → POS table mapping |

## RzRz Restaurant in MenuLink

- **Tenant UUID:** `ef60381c-50db-4379-a9b7-97f5902aa54b`
- **Slug:** `rzrz-bukhari`
- **Branches:** 2 (فرع العزيزية = default, فرع الملز = second)
- **Addons enabled:** pos_bridge, multi_branch, drivers, delivery_zones, advanced_reports, tables_qr, excel_export, loyalty, push_marketing
- **52 pos_item_map rows** — all items mapped to POS ItemIDs

## Key Decision: Test Surface

- **`/m/rzrz-bukhari`** is near-production — never use for experiments
- **`/m/rzrz-bukhari-test`** — confirmed live as of 2026-05-26 (LAB-1 PASS)
  - restaurant_id: `c13aa2bf-df82-4c30-810d-f9ea833ed3cc`
  - Dummy WhatsApp (966504744517), separate from live RzRz
  - POS sync enabled (user chose to leave it on)
  - Clearly marked TEST in name and tagline
  - `display_only_mode = true` (currently testing F5 menu-only mode)

## Current RzRz Problem Summary

The remaining RzRz problem is **workflow, not bridge compatibility:**
- Delivery invoice INSERT already works (proven 2026-05-20)
- HoldMode works (proven 2026-05-23)
- Kitchen print fires correctly
- The blocker is: per-order-type `InvoiceType` triggers a "Please select Payment type" popup loop in the .NET cashier UI — **only Samer can fix this** (hardcoded in WinForms, not configurable)
- Workaround: all orders use InvoiceType=1 (Dine-In as neutral), losing per-type kitchen icons
- The `invoice_type_map` infrastructure is built and ready; flip the map back when Samer patches
