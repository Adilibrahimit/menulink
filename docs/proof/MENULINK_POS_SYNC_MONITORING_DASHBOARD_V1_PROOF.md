# POS Sync Monitoring Dashboard v1 — Proof File

## Date: 2026-05-25

## What was built

`/admin/pos` — POS Sync Monitoring Dashboard gated by `pos_bridge` addon.

## Files created/modified

| File | Action |
|------|--------|
| `apps/web/app/admin/pos/page.tsx` | Created — server component |
| `apps/web/app/admin/pos/pos-dashboard.tsx` | Created — client component, 5 tabs |
| `apps/web/app/admin/layout.tsx` | Modified — added nav entry |

## Features

- 5-tab dashboard: Overview, Outbox Queue, Sync Events, POS Settings, Item Mapping
- 6 KPI cards computed from pos_outbox data
- "آخر نشاط مزامنة" health banner (active/idle/stale) — NOT labeled "heartbeat"
- Realtime subscription on pos_outbox for live updates
- Status/branch filters on outbox tab
- Click-to-expand outbox rows with redacted customer data
- Manual refresh on sync events tab
- Read-only POS settings display
- Item mapping progress bar + mapped/unmapped lists (read-only in v1)
- Customer phone/address redacted in payload viewer

## v1 Limitations (by design)

- No local SQL Server connection from web app
- No Bridge App version/machine display
- No item mapping writes (read-only)
- No retry/skip of failed outbox rows
- No POS settings editing
- Uses "آخر نشاط مزامنة" not "heartbeat" (no real heartbeat table)

## Verification

- Local dev server: `/admin/pos` returns 200
- `/m/koko` unchanged (200)
- `/m/rzrz-bukhari` unchanged (200)
- KO-KO has no pos_bridge addon — `/admin/pos` returns 404 for KO-KO owner
- RzRz has pos_bridge addon — dashboard shows for RzRz owner

## Safety

- No credentials in any committed file
- No destructive SQL
- No production Playwright without approval
- Customer data redacted in payload viewer
