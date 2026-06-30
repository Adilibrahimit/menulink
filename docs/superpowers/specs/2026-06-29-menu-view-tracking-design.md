# Spec · Menu-View / QR-Visit Tracking (all tenants, incl. menu-only)

**Date:** 2026-06-29 · **v2:** 2026-06-30
**Status:** ✅ IMPLEMENTED (migration 0077 applied to prod; app code shipped; live-verified)
**Author:** Claude (with Adil)

## v2 — Council fixes (applied)

This spec was pressure-tested by the LLM Council (report + transcript in
`docs/superpowers/council/*-20260630-183716.*`). All nine must-fixes were folded
into the implementation:

1. **CHECK widen written as explicit DDL** — `DROP CONSTRAINT IF EXISTS
   qr_scan_events_source_type_check` + `ADD CONSTRAINT … CHECK (… 'menu')` (no
   `ALTER CONSTRAINT` exists for CHECKs; name verified live).
2. **`export const dynamic = "force-dynamic"`** added to `/m/[slug]/page.tsx` —
   kills the silent-zero (cache-swallows-the-log) failure mode.
3. **Metric renamed** `unique_visitors` → **`device_days`** (distinct device ×
   Riyadh-day; honestly NOT unique people — Saudi carrier-NAT). Ops page carries
   a footnote saying so.
4. **View is `security_invoker = true`**, granted to `authenticated` only (never
   `anon`); base-table RLS (`is_platform_admin()` / `owns_restaurant()`) applies.
5. **Composite index** `(restaurant_id, scanned_at, source_type)` for the Ops
   aggregation read path.
6. **Daily bucket in Asia/Riyadh** — the `ip_hash` date component is computed in
   Riyadh time (route), so an evening service isn't split across UTC midnight.
7. **Double-write resolved** — `/q/[code]` appends `?qr=1` to its redirect;
   `page.tsx` skips `log_menu_view` when `?qr=` is present (the scan was already
   logged by `resolve_qr_link`), so QR scans are never counted twice.
8. **Bot / link-preview UA filter** before insert (Googlebot, WhatsApp/Telegram/
   Slack previews, headless, curl/wget, etc.).
9. **PDPL retention** — `pg_cron` job `purge_qr_scan_events_90d` deletes scan
   rows older than 90 days (daily 00:17 UTC).

**Deferred (fast-follow, per the council):** the conversion-funnel view
`v_qr_conversion` (scans→orders by `source_type`) as a renewal/upsell lever for
menu-only tenants — to be built only after these honest counts have accrued.

## Problem

The platform has a `qr_scan_events` table and a `resolve_qr_link` RPC, but they only
record a scan when a customer arrives via the dynamic short-link route `/q/[code]`.
The QR codes actually printed/deployed for clients point **directly** to the menu URL
`/m/[slug]`, which records nothing. Result: `qr_scan_events` holds only 6 test rows
(29–31 May 2026) and we cannot report real visitor counts per client — including the
menu-only (display-only) tenants who have no orders signal at all.

## Goal

Record every menu open for **every** tenant (ordering tenants *and* `display_only_mode`
tenants), store enough to derive both **total views** and **unique visitors**, and
surface per-tenant numbers (views + unique + orders) to the platform owner in
Platform Ops.

## Decisions (locked)

- **Visit definition:** log every page open; store a hashed IP so we can derive both
  total views and unique visitors. (Not unique-only; not raw-only.)
- **Where shown:** Platform Ops, one page listing all tenants.
- **Where logged:** server-side, inside the `/m/[slug]` page render (option A). Chosen
  over a client beacon because it is reliable (no ad-block gaps), covers menu-only
  tenants via the same file, and adds no client JS. Bot traffic is filtered by UA.
- **Storage:** reuse `qr_scan_events` (no new table).

## Non-goals (YAGNI)

- No per-item / per-category view tracking (page-level menu open only).
- No geo/IP enrichment, no cookie-based visitor IDs.
- No owner-facing (Tenant Admin) view in this iteration — Ops only.
- Raw IP is never stored — only a daily SHA-256 hash.

## Architecture

### 1. Database — migration `0077_menu_view_tracking.sql`

**a) Widen the `source_type` CHECK constraint** on `qr_scan_events` to add `'menu'`
(direct menu open). Existing allowed values stay: `table, poster, sticker, offer,
category, item, unknown`.

**b) RPC `log_menu_view(p_slug text, p_table text, p_user_agent text, p_referrer text, p_ip_hash text) returns void`:**
- `SECURITY DEFINER`, `set search_path = public`.
- Look up `restaurant_id` from `restaurants` by `slug` (active rows). Miss → return
  (no-op).
- Insert into `qr_scan_events (restaurant_id, qr_link_id, user_agent, referrer,
  source_type, ip_hash)`:
  - `qr_link_id = NULL` (direct open, no short-link).
  - `source_type = 'table'` when `p_table` is non-null/non-empty, else `'menu'`.
  - `ip_hash = p_ip_hash` (already hashed by the caller).
  - `user_agent`/`referrer` truncated to 500 chars (mirror `resolve_qr_link`).
- Wrap the insert in `begin … exception when others then null end` — tracking is
  best-effort and must never raise.
- `grant execute … to anon, authenticated`.

**c) View `v_tenant_engagement`** — one row per restaurant:
- `restaurant_id, name, slug, display_only_mode (as menu_only)`
- `total_views` = `count(*)` of qr_scan_events for the restaurant
- `unique_visitors` = `count(distinct ip_hash)`
- `views_30d`, `unique_30d` = same, filtered to `scanned_at >= now() - interval '30 days'`
- `orders_total`, `orders_30d` = order counts (parity with the existing ops numbers)
- `last_visit_at` = `max(scanned_at)`
- `grant select … to authenticated` (Ops reads it; RLS on the base
  `qr_scan_events` already allows platform admins via the `qr_scan_events_ops_all`
  policy, and owners via `qr_scan_events_owner_read`).

### 2. Logging hook — `apps/web/app/m/[slug]/page.tsx`

In the server component, after `get_public_menu` resolves and before returning JSX:
- Read request headers via `next/headers`: `user-agent`, `referer`, and client IP from
  `x-forwarded-for` (first hop) / `x-real-ip`.
- Compute `ip_hash = sha256(ip + "|" + userAgent + "|" + YYYY-MM-DD)` using Node
  `crypto` — non-reversible, dedupes the same device within the same day.
- **Bot filter:** skip logging when `user-agent` matches a small bot/crawler regex
  (`bot, crawler, spider, facebookexternalhit, WhatsApp, Twitterbot, Slackbot,
  TelegramBot, preview, headless`).
- Call `sb.rpc("log_menu_view", { p_slug, p_table, p_user_agent, p_referrer, p_ip_hash })`
  inside `try/catch`. Pass the same first-value-trimmed `?table=` already computed for
  `rawTableLabel`. Failure is swallowed — never affects the menu render.
- The call is `await`ed (single indexed insert; matches the page's existing awaited
  RPCs). The menu-only branch (`display_only_mode`) is downstream of this line, so
  menu-only tenants are logged automatically.

### 3. Ops page — `apps/web/app/ops/analytics/page.tsx`

- `await requireOps()`; `createClient()` (same pattern as `/ops/page.tsx`).
- Query `v_tenant_engagement`, ordered by `total_views desc` (then `orders_total desc`).
- Render a dark table consistent with `/ops/page.tsx`: columns = المطعم / النوع
  (طلبات vs عرض-فقط) / المشاهدات / الزوّار الفريدون / آخر ٣٠ يوم / الطلبات / آخر زيارة.
- Add a nav entry to `apps/web/app/ops/layout.tsx`: `{ href: "/ops/analytics",
  label: "التحليلات" / "Analytics", icon: "📊" }`.

## Data flow

```
Customer opens /m/wadi-almusafir
  → server component renders (runs every request; page is dynamic via cookies)
  → read UA / referer / x-forwarded-for, compute ip_hash
  → if NOT a bot UA: await log_menu_view(slug, table?, ua, referer, ip_hash)
      → RPC resolves restaurant_id from slug
      → insert qr_scan_events (source_type 'menu' | 'table', qr_link_id NULL, ip_hash)
  → menu renders (ordering or display-only branch) — unaffected by logging result
Platform owner opens /ops/analytics
  → requireOps → select * from v_tenant_engagement
  → table: views, unique visitors, orders per tenant
```

## Error handling

- RPC: inner `exception when others then null` — insert failure is silent.
- Route: `try/catch` around the `rpc` call — network/parse errors swallowed.
- Logging never blocks or breaks the customer's menu, by construction.

## Privacy

- No raw IP persisted. Only `sha256(ip|ua|date)` in the existing `ip_hash` column.
- Daily-salted by date string → same device counts once per day, cannot be correlated
  across days or reversed to an IP.

## Verification

1. Deploy migration + app. Open `/m/koko` twice from one device → expect `total_views`
   +2 but `unique_visitors` +1 (same-day dedup) in `v_tenant_engagement`.
2. Open from a second device → `unique_visitors` +1.
3. Open a **menu-only** tenant (`/m/wadi-almusafir`) → row appears with
   `source_type='menu'` and `menu_only=true`.
4. Open with `?table=3` → row has `source_type='table'`.
5. `curl` the URL with a Googlebot UA → **no** new row (bot filtered).
6. `/ops/analytics` lists all tenants with the right numbers; ordering and menu-only
   tenants both appear.

## Files touched

| File | Change |
|---|---|
| `apps/web/supabase/migrations/0077_menu_view_tracking.sql` | new: constraint widen + `log_menu_view` RPC + `v_tenant_engagement` view |
| `apps/web/app/m/[slug]/page.tsx` | add server-side best-effort `log_menu_view` call + bot filter + ip_hash |
| `apps/web/app/ops/analytics/page.tsx` | new: per-tenant engagement table |
| `apps/web/app/ops/layout.tsx` | add "التحليلات / Analytics" nav item |
