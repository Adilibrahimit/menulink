# F1: Order Status Tracker — Proof

**Date:** 2026-05-26
**Phase:** 4

## Files Created

| File | Purpose |
|------|---------|
| `apps/web/supabase/migrations/0050_customer_order_visibility.sql` | RLS policies: customer_read_own_orders, customer_read_own_order_items, customer_read_own_events |
| `apps/web/app/m/[slug]/orders/order-status-tracker.tsx` | Visual step timeline component |

## Files Changed

| File | Change |
|------|--------|
| `apps/web/app/m/[slug]/orders/page.tsx` | Fetch order_events, pass customerId/restaurantId to client |
| `apps/web/app/m/[slug]/orders/orders-client.tsx` | Realtime subscription + status tracker rendering |

## Migration Applied

`0050_customer_order_visibility.sql` — 3 new RLS policies:
- `customer_read_own_orders` on orders
- `customer_read_own_order_items` on order_items
- `customer_read_own_events` on order_events

All use `customers.auth_user_id = auth.uid()` join pattern.

## Build Result

TypeScript type-check: PASSED

## Key Design Decisions

- **Realtime channel:** `customer-orders:${customerId}` — listens for UPDATE on orders filtered by customer_id
- **Event refresh:** On each status update, fetches fresh `order_events` for timeline timestamps
- **Timeline:** 5 steps (submitted → confirmed → preparing → ready → delivered), active step pulses
- **Cancelled:** Shows red X badge instead of timeline
- **Tracker shown for:** Active orders (submitted/confirmed/preparing/ready) + cancelled orders in expanded view

## Also Fixed

Previously, customers couldn't read their own orders via RLS — the orders table only had owner/ops policies. The new `customer_read_own_orders` policy enables the orders page to actually return data for signed-in customers.

## Production Safety

- KO-KO: NOT modified (RLS policies are additive, not tenant-specific)
- Live RzRz: NOT modified
- rzrz-bukhari-test: restored to `display_only_mode = false` for full testing
- Test on `/m/rzrz-bukhari-test/orders`
