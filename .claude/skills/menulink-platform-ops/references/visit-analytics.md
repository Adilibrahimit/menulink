# Visit / QR Analytics — data model

Shipped 2026-06-30 (migration `0077_menu_view_tracking.sql`, PR #29 → main `61a79c4`). Design was
LLM-Council-reviewed; spec at `docs/superpowers/specs/2026-06-29-menu-view-tracking-design.md`,
council report/transcript in `docs/superpowers/council/`.

## The pipeline

```
Customer opens /m/[slug]  (server component, export const dynamic = "force-dynamic")
  → lib/track-visit.ts: read UA + x-forwarded-for, compute ip_hash, bot-filter, skip if ?qr=1
  → rpc log_menu_view(slug, table, ua, referrer, ip_hash)   [SECURITY DEFINER, best-effort]
  → insert into qr_scan_events (source_type 'menu' | 'table', qr_link_id NULL, ip_hash)
/q/[code] route  → resolve_qr_link (logs the scan) → 302 to /m/[slug]?qr=1  (so page.tsx skips it)
Platform owner → /ops/analytics → select * from v_tenant_engagement
```

Why server-side (not a client beacon): reliable (no ad-block gaps), covers menu-only tenants via the
same file, zero client JS. The cost is one indexed insert on the menu render (best-effort, awaited,
fail-open).

## `qr_scan_events` (the event table, from 0059)
`id, restaurant_id, qr_link_id (nullable), scanned_at, user_agent, referrer, source_type, ip_hash`.
- `source_type` CHECK: `table, poster, sticker, offer, category, item, unknown, menu` (0077 added
  `menu`). Direct menu opens = `'menu'`; opens with `?table=` = `'table'`; `/q/[code]` scans carry
  the QR's own source_type via `resolve_qr_link`.
- `qr_link_id` is NULL for direct `/m/[slug]` opens; non-null only for dynamic short-link scans.
- `ip_hash = sha256(ip | ua | Riyadh-date)` — computed in `lib/track-visit.ts`. Riyadh date so the
  daily bucket matches the restaurant's day, not UTC midnight. No raw IP is stored.
- Index `qr_scan_events_rid_time_src_idx (restaurant_id, scanned_at, source_type)` for the ops query.
- RLS: `qr_scan_events_ops_all USING is_platform_admin()` (all) + `qr_scan_events_owner_read USING
  owns_restaurant(restaurant_id)`. No anon policy.

## `v_tenant_engagement` (the ops view)
`security_invoker = true` (so base-table RLS applies to whoever queries — ops see all, owners see
only their own, anon nothing). Granted to `authenticated` only. One row per restaurant:

| column | meaning |
|---|---|
| `restaurant_id, name, slug` | tenant |
| `menu_only` | `restaurants.display_only_mode` |
| `total_views` | `count(*)` — raw opens |
| `device_days` | `count(distinct ip_hash)` = distinct device×day buckets (NOT unique people) |
| `views_30d`, `device_days_30d` | same, last 30 days |
| `orders_total`, `orders_30d` | order counts (parity with the rest of /ops) |
| `last_visit_at` | `max(scanned_at)` |

Honest-naming rule: surface `device_days` as "أجهزة/يوم (تقديري)" with a footnote, never as "unique
visitors" — Saudi carrier-NAT collapses many people behind shared IPs, so it's a lower-bound proxy.

## Retention
`pg_cron` job `purge_qr_scan_events_90d` (daily 00:17 UTC): `delete from qr_scan_events where
scanned_at < now() - interval '90 days'`. PDPL hygiene for `ip_hash` + `user_agent`.

## Gotchas
- **Pre-2026-06-30 data is empty by design.** Printed client QRs point at `/m/[slug]` (not
  `/q/[code]`), which logged nothing before this feature. Counts accrue from the deploy. A near-zero
  history is expected, not a bug.
- **Don't double-count.** The `?qr=1` marker is the guard between `resolve_qr_link` (logs `/q/[code]`
  scans) and `log_menu_view` (logs direct opens). If you change either route, keep the guard.
- **Verifying live:** hit a prod `/m/<slug>` with a unique non-bot UA, then check
  `qr_scan_events where user_agent like '<marker>%'`; opening twice from one "device" = 2 views /
  1 device_day. **Delete your test rows after.** A bot UA (e.g. contains `WhatsApp`) must NOT create a
  row; `?qr=1` must NOT create a row.

## Deferred fast-follow (LLM Council recommendation)
`v_qr_conversion` — scans→orders by `source_type`, e.g. "table QRs convert at 22%, poster QRs at 3%".
A concrete QR-ROI / renewal lever, especially for menu-only tenants who have no orders signal. Build
only after honest counts have accrued so the funnel isn't built on noise.
