---
name: menulink-platform-ops
description: >-
  Operate the MenuLink Platform Ops console (/ops) — the platform owner's back-office across ALL
  tenants. Use this skill WHENEVER you are: logging a tenant payment, recording a subscription or
  renewal, marking a client as paid, activating a subscription, enabling or billing a paid addon
  (google_review, tables_qr, loyalty, pos_bridge, push_marketing…), OR reading cross-tenant
  analytics (menu/QR visit counts, "how many visitors/views per client", views per tenant,
  device_days, orders per tenant, the /ops/analytics page). Trigger on phrases like "log a payment",
  "record the subscription", "mark X as paid", "activate this tenant", "حدّث الدفعة", "سجّل اشتراك",
  "كم زائر/مشاهدة لكل عميل", "تحليلات", "/ops", "ops console", even when the user doesn't name /ops.
  This skill carries two things that are easy to get WRONG without it: the payments-trigger
  period-stacking gotcha (or you'll bill the wrong dates) and the visit-tracking data model + honest
  metric naming (or you'll report a misleading number). NOT for editing a single restaurant's menu
  (that's the tenant /admin surface + menu-onboarding skill) or onboarding a brand-new tenant
  (tenant-deployment skill) — this is the ongoing platform-operator surface.
---

# MenuLink Platform Ops

The platform owner's console lives at **`/ops/*`** (separate from the per-restaurant `/admin/*`).
It's the only place that sees **across all tenants**: tenant list, onboarding wizard, payments,
per-tenant design, and analytics. Access is gated by `requireOps()` → only rows in
`platform_admins` (i.e. `is_platform_admin()` in SQL) get in.

| /ops surface | Does |
|---|---|
| `/ops` | All tenants + subscription status |
| `/ops/tenants/new` | Onboarding wizard (creates restaurant + auth user + subscription) |
| `/ops/tenants/[id]` | Drill-in: subscription, owners, payments, **addons (الخدمات)**, design |
| `/ops/payments` | Log a received payment → activates the subscription |
| `/ops/analytics` | Per-tenant menu/QR visit counts + orders (added 2026-06-30) |

Two operator tasks are covered in depth below. For schema-level detail and copy-paste SQL, read the
reference file named at the end of each section.

---

## Task 1 — Log a tenant payment / activate a subscription

A payment is recorded by **inserting a row into `public.payments`**. An AFTER-INSERT trigger
(`apply_payment_to_subscription`) then flips the subscription to `active`, sets `last_payment_at`,
republishes the restaurant, and **extends the period**. You can insert via the ops UI
(`/ops/payments` → the form just inserts the row) or via SQL (Management API) for backfills/precise
dating.

### ⚠️ The period-stacking gotcha (read this before every backdated payment)

`apply_payment_to_subscription()` computes the new period from **`now()`** and **stacks it on top of
the existing `current_period_end`** when that end is still in the future:

```
current_period_end = (current_period_end > now ? current_period_end : now) + plan_interval
```

Tenant *creation* pre-seeds `current_period_end = created_at + 1 year` while the sub is still
`pending_payment`. So the first real payment sees "end is in the future" and **pushes it out to
~2 years** — wrong if the client paid for one year from their start date.

**The fix:** record the payment row(s) for the money ledger, then run an **explicit UPDATE** to set
the authoritative state. This overrides whatever the trigger did:

```sql
update public.subscriptions s
   set status='active',
       amount_sar = <annual_price>,            -- e.g. 500; coffee-secret was 0, had to set it
       last_payment_at      = r.created_at,     -- or the real paid date
       current_period_start = r.created_at,     -- "from creation day" per the deal
       current_period_end   = r.created_at + interval '365 days',
       cancelled_at = null, updated_at = now()
  from public.restaurants r
 where r.id = s.restaurant_id and r.slug = '<slug>';
```

If you DON'T need backdating (a normal "they just paid today" renewal), the trigger's default
behaviour is usually fine — just insert the payment and verify the resulting `current_period_end`.

### Addons (paid services) are billed separately

A subscription's `amount_sar` is the recurring **base** only. A paid addon (e.g. `google_review`
100 SAR) is tracked in `public.subscription_addons` (`enabled`, `price_override_sar`). To record the
money the client paid for it, add a **second `payments` row** with a clear note, so the ledger total
is correct (e.g. Wadi = 500 base + 100 addon = 600). Enable the addon in `subscription_addons` if it
isn't already.

**Worked example (2026-06-30):**
- Coffee Secret → 1 payment 500, sub set active, period 2026-06-27→2027-06-27 (creation day).
- Wadi Almusafir → 2 payments (500 base + 100 `google_review`), period 2026-06-28→2027-06-28.

→ Full schema, the trigger definition, and ready SQL: **`references/billing-payments.md`**

---

## Task 2 — Read cross-tenant visit / QR analytics

"How many QR visitors per client?" is answered by the visit-tracking system shipped 2026-06-30.
The numbers live in the view **`v_tenant_engagement`**, surfaced at **`/ops/analytics`**.

Key things to get right (or you'll mislead the owner):

- **Where visits are logged:** server-side in `apps/web/app/m/[slug]/page.tsx` (it's
  `force-dynamic`) via `lib/track-visit.ts` → the `log_menu_view` RPC → a row in `qr_scan_events`.
  This covers **every** tenant, including menu-only (display-only) ones. Bot/preview UAs (WhatsApp,
  Telegram…) are filtered out; `?qr=1` visits are skipped (they came via `/q/[code]`, already logged
  by `resolve_qr_link`) to avoid double-counting.
- **The metric is `device_days`, NOT "unique visitors".** `device_days = count(distinct ip_hash)`,
  where `ip_hash = sha256(ip | ua | Riyadh-date)`. So it counts distinct **device × day** buckets —
  an honest, slightly-low proxy. Saudi mobile is carrier-NAT'd (many people behind one IP), so never
  call it "unique people". `total_views` = raw opens.
- **Privacy:** no raw IP is stored; a `pg_cron` job (`purge_qr_scan_events_90d`) deletes rows after
  90 days.
- **History caveat:** before 2026-06-30 the printed client QRs pointed straight at `/m/[slug]`, which
  logged nothing (only `/q/[code]` did). So pre-2026-06-30 visit data is effectively empty — counts
  start accruing from the deploy. If a tenant shows ~0 older data, that's why, not a bug.

Quick query (via Management API / PAT) when you don't want the UI:
```sql
select name, slug, menu_only, total_views, device_days, views_30d, orders_total, last_visit_at
from public.v_tenant_engagement order by total_views desc;
```

**Deferred fast-follow (per the LLM Council):** `v_qr_conversion` (scans→orders by `source_type`) as
a renewal/upsell lever for menu-only tenants — build it once enough honest counts have accrued.

→ Data model, RLS (`security_invoker`), source_type values, retention, and the migration:
**`references/visit-analytics.md`**

---

## How to apply DB changes / queries

This project has **no local Postgres** — apply SQL to the live cloud DB via the **Supabase
Management API** (`POST https://api.supabase.com/v1/projects/dhmjrrsynfvomlzhggvu/database/query`,
`Authorization: Bearer <PAT>`, with a **non-browser `User-Agent`** header or it 403s). The PAT lives
in your secure notes (auto-memory `reference_supabase_pat`) — **never hardcode it in this repo
(it's public).** PowerShell `Invoke-RestMethod` is the established pattern. Always **verify** after a
write (re-select the affected rows) and **clean up** any test rows you insert.

## Standing rule — council before features

When the work is a **substantial new feature** (not a payment log or menu edit), proactively offer
to run the design through the **LLM Council** (`/council`) before building — it caught 9 real
must-fixes on the analytics feature. Sequence: brainstorm → spec → `/council` → fold fixes →
implement → verify.
