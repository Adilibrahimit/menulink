# LLM Council Transcript — Menu-View / QR-Visit Tracking Spec

**Timestamp:** 2026-06-30 18:37
**Counciled:** `docs/superpowers/specs/2026-06-29-menu-view-tracking-design.md`
**Method:** 5 advisors (parallel) → anonymized peer review → chairman synthesis. Run as a background Workflow on Opus 4.8.

> **Note on this run:** the framed question was passed via the workflow `args` global, which arrived `undefined` inside the script (a wiring bug — the inline spec text did not reach the advisors). Because each advisor was given the real file paths and instructed to inspect the repo, they read the actual code (`0059`, `0065`, `0002`, `page.tsx`) **and** the committed spec doc directly — so the critiques are grounded in the real implementation, arguably more so than from the inline text. The Contrarian, however, leaned on the missing inline block and partly misread which code path the design patches (peer reviewers caught this).

---

## The Framed Question

Is the menu-view / QR-visit tracking design spec sound and ready to implement as written? Technical review covering: Postgres/RLS, Next.js 14 App Router server-component caching, privacy (Saudi PDPL), performance on the hot menu path, correctness, and whether it answers the owner's question (per-tenant QR visitors, including menu-only tenants). Stack: Next.js 14 + Supabase + Vercel, multi-tenant `/m/[slug]`, ~10 tenants. The design: server-side `log_menu_view` RPC fired from `/m/[slug]/page.tsx`, reuse `qr_scan_events`, store `sha256(ip|ua|date)`, surface per-tenant counts in `/ops/analytics`.

---

## Advisor Responses

### The Contrarian

The spec wasn't actually pasted (the decision block is `undefined`), so I'll ground my critique on the real files referenced — and the gaps there are damning enough.

The fatal flaw is in **0065_resolve_qr_link.sql**: it is an append-only event logger with **zero dedup, zero bot filtering, and an exception swallow that hides corruption**.

1. **Double-count by design.** Browsers issue duplicate GETs (link prefetch, Safari speculative loads, WhatsApp/Telegram/Slack link-preview crawlers all hit `/q/{code}` before the human ever taps). Each one INSERTs a row. WhatsApp is your primary distribution channel — every shared menu link gets a preview fetch that inflates "scans" before anyone scans. There is no `user_agent` bot regex, no IP/dedup window. Your scan counts are preview-traffic noise.
2. **No IP, so no dedup is even possible.** The table stores `user_agent` and `referrer` but no IP hash — so you cannot dedup, rate-limit, or detect a single actor hammering. If the spec claims unique-visitor or anti-fraud counting, it can't be built on this schema. If it adds raw IP, that's a PDPL/privacy problem with no retention policy shown.
3. **`exception when others then null`** silently eats *every* failure — constraint violations, type errors, a future NOT NULL column. Your verification plan will see redirects work and assume tracking works, while events vanish. Untestable by black-box.
4. **SECURITY DEFINER + `grant to anon`** means any anonymous caller invokes `resolve_qr_link('x',...)` directly via PostgREST in a loop — unbounded write amplification into `qr_scan_events`, no rate limit. Trivial DoS / count-poisoning vector.

Net: counts are inflated, unauditable, and forgeable. Before anything ships, paste the actual spec — but these four are real today.

### The First Principles Thinker

Strip the surface request. The owner does not want "page views." No restaurant owner in Riyadh has ever asked "how many times was my menu HTML rendered?" They want to answer one of three real questions: *are my printed QR posters working, which dishes get attention, and how many lookers become orders?* The spec answers none of these well by dumping page-views into `qr_scan_events`.

**Fatal conflation — the table is a scan log, not a pageview log.** `qr_scan_events` (0059) exists to attribute a *physical QR scan* to a `qr_link_id` and `source_type` ('table','poster','sticker'). That semantic is its entire value: it tells the owner *which poster* drove traffic. A server-component log in `page.tsx` has no `qr_link_id` and no real `source_type` — every row is `qr_link_id = NULL, source_type = 'unknown'`. You will drown the one signal that table is designed to carry (poster-level attribution) under a flood of nulls. The clean visit already flows through `resolve_qr_link` (0065). Logging *again* in `page.tsx` double-counts every scanned visit and mixes it with direct/bookmarked hits.

**"Unique by ip+ua+day hash" is a fabricated metric.** Saudi mobile traffic is overwhelmingly carrier-NAT'd — thousands of users share a handful of STC/Mobily egress IPs, with near-identical iOS Safari UAs. That hash collapses real diners into one "unique visitor" and inflates the denominator of any conversion rate. You are not measuring people; you are measuring NAT pools.

**Right primitive:** don't log in the server component at all (it fires on prefetch/bot/SSR and isn't reliable). Keep `qr_scan_events` for scans only. Add a separate, honest `menu_views` event from a client beacon, and define success as **scan → engaged-session → order**, joinable to `orders` (0002 views) — that is the number the owner pays 59 SAR to see.

### The Expansionist

This spec massively undersells what it unlocks because it stops at "count menu views." Look at what's *already wired*: `0002_analytics_views.sql` has `v_customer_rfm` and `v_customer_ltv` joining `orders→customers`, and `0065_resolve_qr_link.sql` already stamps every scan with `source_type in ('table','poster','sticker','offer','category','item')` plus `referrer` and `restaurant_id`. The conversion funnel is one JOIN away from existing: `qr_scan_events` (top of funnel) → `orders` (bottom). Add a single `v_qr_conversion` view bucketing scans-to-orders by `source_type`, and you can tell a tenant "your *table* QRs convert at 22%, your *poster* QRs at 3%" — that's a printed-poster ROI proof, not a vanity counter.

The biggest miss: **this is your renewal weapon for menu-only tenants.** Mazaj, Coffee Secret, Wadi all pay setup+renewal with zero order data, so today you renew them on faith. With view counts per `source_type`, you walk in with "11,400 menu views this quarter" — concrete QR-ROI that justifies the 499. And the `source_type='offer'/'item'` granularity already in the CHECK constraint means you can prove *which dish photo* drives scans — directly feeding the photo-catalog upsell.

Adjacent value one cheap step away: a `created_at` time-series on `qr_scan_events` gives you the weekly trend chart for ops (`apps/web/app/ops/`), and **the cleanest upsell trigger you have** — a menu-only tenant with high views + an `'item'` scan spike is your ranked list of who to convert to WhatsApp ordering. The funnel data literally scores your own pipeline. Don't ship a counter; ship the funnel view and surface it in `/ops`.

### The Outsider

There is no `export const dynamic` / `revalidate` in the route. The spec's data-flow comment asserts "page is dynamic via cookies (runs every request)" — that's an unverified assumption, and it's the load-bearing one.

**The headline word is the problem: "visitor."** A restaurant owner — and frankly a new engineer — reads `unique_visitors` as *unique people*. This counts unique `sha256(ip|ua|date)` tuples, re-salted daily. So one customer who opens the menu on hotel Wi-Fi today and cellular tomorrow is 2 "visitors"; a family of five behind one CGNAT/restaurant-router IP with identical phones could collapse toward 1; and the count resets every midnight, so "unique visitors" over 30 days (`unique_30d`) silently means "sum of daily-unique device-buckets," not unique people over the month. The number will be defensible to an engineer and *wrong* to whoever reads the Ops table. Rename it `daily_devices` or footnote it, or the platform owner will quote it to a paying client and be embarrassed.

**The load-bearing assumption is unverified.** The data-flow comment claims the page "runs every request; page is dynamic via cookies." But `/m/[slug]/page.tsx` has **no `export const dynamic = "force-dynamic"`** and no `revalidate`. If Next statically caches or ISR-caches this route, `log_menu_view` fires once per build/revalidation, not per visit — and the whole feature reports near-zero. "Dynamic via cookies" is exactly the kind of curse-of-knowledge claim that needs a one-line proof in the spec, not an aside.

**"Best-effort but awaited" is a contradiction worth naming.** The spec `await`s the insert on the render path while promising "never blocks." A blocking awaited RPC *is* a block; it just fails open. Say "adds one round-trip to TTFB."

Rename the metric and prove the route is dynamic before building.

### The Executor

The constraint at migration 0059 line 195 is an **inline unnamed CHECK** — Postgres auto-names it `qr_scan_events_source_type_check`. The spec says "widen the CHECK" but gives no DDL. There is no `ALTER ... ALTER CONSTRAINT` for CHECKs; you must `ALTER TABLE public.qr_scan_events DROP CONSTRAINT qr_scan_events_source_type_check, ADD CONSTRAINT qr_scan_events_source_type_check CHECK (source_type IN (...,'menu'));`. If that auto-name was ever overridden, the migration silently fails. Monday-morning fix: verify the exact name first (`\d qr_scan_events`), make the drop `IF EXISTS`, re-add named. This is the single most likely thing to break the migration.

This is buildable and the spec is unusually concrete — `ip_hash` already exists on `qr_scan_events` (0059 line 196), so no column add. But four things bite on implementation:

1. **The CHECK widen has no first step.** Inline unnamed constraint (0059:195) → auto-named `qr_scan_events_source_type_check`. No `ALTER CONSTRAINT` for CHECKs — `DROP CONSTRAINT … ADD CONSTRAINT … CHECK(... 'menu')`. Run `\d qr_scan_events` first, make the DROP `IF EXISTS`. Test on a Supabase branch, not prod.
2. **"Page is dynamic via cookies" is an assumption, not a guarantee.** `supabase-server.ts` calls `cookies()`, which *does* opt into dynamic rendering today — but it's incidental. If anyone adds `unstable_cache` or the route gets statically optimized, logging silently stops. Add `export const dynamic = "force-dynamic"` to `page.tsx`. One line, removes the whole class of "why did views go to zero" bugs.
3. **IP extraction on Vercel.** `x-forwarded-for` is a comma list; "first hop" is correct, but it's also client-spoofable, so unique counts are soft — fine for an internal Ops number, don't market it as analytics-grade. Use `headers()` from `next/headers` (the page is a Server Component, not the route handler), not `request.ip`.
4. **The view needs its own grant + RLS reality check.** `v_tenant_engagement` reads RLS-protected `qr_scan_events`. A plain (non-`security_invoker`) view runs as its definer/owner and **bypasses base-table RLS** — any `authenticated` user could read all-tenant counts. The Ops page gates with `requireOps()`, so acceptable, but state it explicitly and don't `grant select` to `anon`.

Verification step 5 (Googlebot UA → no row) is the only behavior with no unit-testable seam; everything else you can check with a direct `execute_sql` against a branch before shipping. Net: ~1 day, low risk once the constraint DDL is written out.

---

## Peer Reviews (anonymized A–E → A=First Principles, B=Outsider, C=Contrarian, D=Executor, E=Expansionist)

**Review 1:** D strongest (verified the spec is real; highest-leverage catch = unnamed CHECK needs DROP+ADD; non-`security_invoker` RLS bypass; Vercel `headers()`). C biggest blind spot (anchored on unpasted spec, attacked `resolve_qr_link`, misfired on `ip_hash` which already exists). All missed write-amplification cost + indexing for the new aggregation.

**Review 2:** D strongest (line-number grounded; Monday-morning blocker). E biggest blind spot (a sales pitch assuming the data is trustworthy — funnel built on counts shown inflated by preview crawlers, NAT collapse, double-logging). All missed PDPL/retention (deletion policy / lawful basis for `ip_hash`+UA) and per-render write cost / missing index.

**Review 3:** D strongest. C biggest blind spot (argues from absence; `ip_hash` already exists at 0059:196). All missed the double-write/attribution split (one row or two per QR visit? no dedup key) + `ip_hash` salt/retention + **timezone**: UTC daily boundary splits a Riyadh (UTC+3) evening service across two days, corrupting every daily metric.

**Review 4:** D strongest. C biggest blind spot. All missed: **no index for the read path** — `v_tenant_engagement` aggregates a growing append-only table by `restaurant_id`+time+`source_type` with no composite index → widening seq-scan; plus retention/partitioning.

**Review 5:** D strongest. E biggest blind spot (pure upside; ignores double-counting, CGNAT, bots, RLS leakage). All missed PDPL/retention as a concrete deliverable + **clock/timezone for the daily salt** (UTC vs Asia/Riyadh +3) + an index on `(restaurant_id, created_at, source_type)`.

---

## Chairman's Verdict

## Where the Council Agrees

Five advisors converged independently on three things, and the peer reviews ratified them.

1. **The metric name lies.** Three advisors (First Principles, Outsider, Contrarian) independently land on the same point: "unique_visitors" / "unique" is not unique people. It's a daily-salted `sha256(ip|ua|date)` bucket that collapses Saudi carrier-NAT traffic into one "visitor," splits one real person across two days/networks, and silently resets at midnight. Rename to `daily_devices` or footnote it.

2. **The "page is dynamic" claim is load-bearing and unverified.** Outsider and Executor both flag that `/m/[slug]/page.tsx` has no `export const dynamic = "force-dynamic"`. It's dynamic *today* only incidentally, because `supabase-server.ts` calls `cookies()`. The moment someone adds `unstable_cache` or the route gets statically optimized, logging silently drops to near-zero with no error. One-line fix.

3. **The view will bypass RLS unless it's `security_invoker`.** A plain Postgres view runs as its owner and reads through base-table RLS — any `authenticated` user could read all-tenant counts. Acceptable only because `requireOps()` gates the Ops page, but it must be stated and must **not** `grant select` to `anon`.

## Where the Council Clashes

**Is the existing infrastructure trustworthy enough to build on?**

- **Contrarian and First Principles say no** — counts inflated/unauditable before you start (WhatsApp preview crawlers, double-logging, NAT collapse, bots).
- **Expansionist says yes, enthusiastically** — build the conversion funnel, it's the renewal weapon for menu-only tenants.
- **Executor says yes, soberly** — buildable in ~1 day, low risk, column already exists; just don't market the unique count as analytics-grade.

They're answering different questions: *"is this number true?"* vs *"does the migration run?"* vs *"what's it worth if it works?"* Four of five reviews named Expansionist's pitch as the biggest blind spot precisely because it sells a funnel built on counts the others proved inflated.

**Which code path is being patched?** Contrarian built its review around `resolve_qr_link` and "no IP exists." Every peer reviewer flagged this as the biggest error: the new logging is in `page.tsx` against `qr_scan_events`, and `ip_hash` *already exists* (0059:196). Discount Contrarian's DoS/forgery/"dedup impossible" alarms — but its bot/preview-fetch and `exception when others then null` points survive.

## Blind Spots the Council Caught (via peer review)

1. **Write cost on the hot path.** Every menu render does a blocking-but-fail-open INSERT — added TTFB on the busiest route, no batching/sampling.
2. **No index for the read path.** `(restaurant_id, scanned_at, source_type)` composite index missing → widening seq-scan as the append-only table grows.
3. **Timezone corrupts every daily metric.** Daily salt + Ops buckets are UTC; Riyadh is UTC+3, so midnight UTC splits an evening dinner rush across two days.
4. **PDPL / retention.** Storing `ip_hash` + UA tied to behavioral data with no retention window or lawful basis is a compliance exposure for a paid platform.

## The Recommendation

**Ship — but with changes. Do not ship as-is, and do not rethink the whole thing.** ~1-day, low-risk build on real infrastructure, but the current spec verbatim produces a counter that is wrong, slow-degrading, and quotable-but-embarrassing.

**Must-fix before implementation:**

1. **Write the CHECK-widen DDL explicitly** — `DROP CONSTRAINT IF EXISTS qr_scan_events_source_type_check … ADD CONSTRAINT … CHECK (source_type IN (…, 'menu'))`. Verify the name with `\d` first. No `ALTER CONSTRAINT` for CHECKs. Test on a Supabase branch.
2. **Add `export const dynamic = "force-dynamic"` to `page.tsx`.** Kills the silent-zero failure mode.
3. **Rename the metric** to `daily_devices` (or footnote). Never market as analytics-grade.
4. **Make the view `security_invoker = true`**, do not grant to `anon`, comment the `requireOps()` gating.
5. **Add the composite index** `(restaurant_id, scanned_at, source_type)`.
6. **Fix the daily boundary to Asia/Riyadh** in salt + Ops bucketing.
7. **Resolve the double-write** — one row or two per QR visit? `page.tsx` logs only `source_type='menu'` for direct/bookmarked hits and excludes resolved-QR traffic so the two never double-count.
8. **Filter bot/preview UAs** (Googlebot, WhatsApp/Telegram/Slack link-preview crawlers) before insert.
9. **Add a PDPL retention policy** — e.g. 90-day deletion job for `ip_hash`/UA.

Defer Expansionist's funnel view (`v_qr_conversion`, `/ops` surfacing) to a fast-follow — right business instinct, but only after the counts are honest.

## The One Thing to Do First

Run `\d qr_scan_events` against a Supabase branch to confirm the exact constraint name, then write and test the `DROP CONSTRAINT IF EXISTS … ADD CONSTRAINT … CHECK (… 'menu')` migration there. The single most likely thing to silently break the migration, and it gates everything else.
