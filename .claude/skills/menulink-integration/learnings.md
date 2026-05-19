# Learnings · MenuLink Integration

> **This file is read at the start of every session.** It accumulates knowledge across deployments so the same mistake never costs us twice.
>
> **🆕 Read [`memory.md`](../../../memory.md) at project root for current state.** This file is for *transferable gotchas* — patterns that apply to any tenant, any session.
>
> **Last updated:** 2026-05-19 (post-RLS-rewrite: 0008 shipped, 4 tenants live, dashboard charts, owner self-service logo)
> **Update protocol:** Append new entries under the right section. Keep each entry to 2-4 lines. Tag with confidence level.

---

## 🗂️ Customer Taxonomy (CRITICAL — read first)

We have **two distinct customer profiles** and they must never be conflated:

| Profile | Name | POS | Role | Relationship |
|---------|------|-----|------|--------------|
| 🥇 **First paying customer** | KO-KO Chicky Licky | TBD (probably none / WhatsApp only) | Revenue proof | Direct lead |
| 🔧 **Integration testbed** | RzRz Restaurant (name TBD) | RzRz (Punnelifosys ResApp) | Engineering R&D lab | User's brother is operations manager |

**Do not assume KO-KO has RzRz.** Do not assume the RzRz restaurant wants to pay. They serve different strategic purposes.

---

## ✅ What Has Worked

### LRN-2026-05-19-rls-rewrite-confirmed (confidence: high)
**Context:** Migration 0008 rewrote RLS using `auth.uid()` + lookup tables instead of JWT-claim paths, plus added missing `platform_admin` policies and `name_en` columns. User manually tested every owner + ops surface after `git push 8e5cb26` and the migration applied on 2026-05-19.  
**Learning:** **Confirmed working in production.** Test order persisted by `submit_order` was always in the DB — it became visible the moment owner RLS started resolving. Owner can create categories + items (simple modal), upload photos to `menu-images/<restaurant_id>/<item_id>-*`, upload logo + cover to `menu-images/<restaurant_id>/_brand/*`. Ops onboarding wizard (now using service_role admin client for restaurants INSERT) created 3 new tenants successfully — all 3 paid and active in `subscriptions`. Dashboard Chart.js (`react-chartjs-2` Line + Bar over `v_revenue_daily` scoped to `restaurant_id`) renders cleanly with seed data. **No sign-out was needed** — `auth.uid()` reads `sub` which is always in the JWT.  
**Source:** session:2026-05-19 user test report  
**Triggers:** RLS, post-deploy verification, 0008, dashboard charts, onboarding wizard, multi-tenant test

### LRN-2026-05-18-direct-db-rzrz (confidence: high)
**Context:** Investigating how to push MenuLink orders into RzRz POS  
**Learning:** RzRz stored procedure `InsertInvoice` accepts XML and automatically handles kitchen printing via `KitichenOrderForPrint` table — we can integrate WITHOUT modifying the .NET POS source code. The system has `OnlineCustomerID` field built-in, meaning it was designed for online orders from the start.  
**Source:** session:2026-05-18 | applies-to:rzrz-restaurant  
**Triggers:** RzRz integration, .NET POS, InsertInvoice, kitchen printing, online order

### LRN-2026-05-18-zatca-already-handled (confidence: high)
**Context:** Wondering if MenuLink needs to handle Saudi ZATCA e-invoicing for RzRz customers  
**Learning:** RzRz already has ZATCA support built-in (folder `2025/10/Zatca Service`). When we push orders via `InsertInvoice`, the tax calculations happen inside the procedure automatically. **We do not need to compute ZATCA on the MenuLink side.**  
**Source:** session:2026-05-18 | applies-to:rzrz-restaurant  
**Triggers:** ZATCA, e-invoicing, tax, فاتورة, Saudi compliance

### LRN-2026-05-18-multibranch-architecture (confidence: high)
**Context:** Understanding RzRz deployment topology  
**Learning:** RzRz uses central SQL Server (hosted at 192.250.231.22) + local branch DBs (`RZRZCLIENT.mdf`). Sync happens via `IsSyncRequired=1` flag. For MenuLink integration, write to the central server when DB is remote; use Bridge App pattern when DB is local-only.  
**Source:** session:2026-05-18 | applies-to:rzrz-restaurant  
**Triggers:** multi-branch, sync, central database, local database, IsSyncRequired

### LRN-2026-05-18-supabase-cli-same-software (confidence: high)
**Context:** Choosing between Docker Postgres → migrate-to-Supabase vs Supabase CLI for local dev
**Learning:** Supabase CLI's local stack (`npx supabase start`) is the SAME software as Supabase Cloud — Postgres, Auth, Storage, Realtime, Studio. So there's no "migration" step from local to cloud: write schema once as `supabase/migrations/*.sql`, run `supabase db push` when cloud creds arrive. Raw Docker Postgres would have meant rebuilding auth/RLS at deploy time.
**Why:** Avoiding schema drift was the deciding factor; the local-vs-prod-software parity guarantees that what works locally works in cloud.
**How to apply:** For any new MenuLink app (admin, bridge integrations), always use `supabase init` + `supabase start` rather than rolling raw Postgres. Resolves [[opn-local-dev-strategy]].
**Source:** session:2026-05-18 | applies-to:all customers
**Triggers:** local dev, Supabase, Docker Postgres, migration, schema drift

### LRN-2026-05-18-apps-web-monorepo-layout (confidence: high)
**Context:** Naming the Next.js+Supabase project directory
**Learning:** Code lives under `apps/web/` (monorepo convention), not `backend/`. Next.js is fullstack (frontend + serverless API routes), and the layout makes room for `apps/admin/` (restaurant dashboard) and `apps/bridge/` (.NET RzRz Bridge App) later without restructuring.
**Why:** Calling Next.js code "backend" is misleading; the `apps/*` convention matches Vercel/Turborepo norms and won't need rename when sibling apps land.
**How to apply:** New runnable apps go under `apps/<name>/`. Shared libs/types eventually under `packages/`.
**Source:** session:2026-05-18 (user correction during plan execution)
**Triggers:** project structure, monorepo, backend vs frontend, app naming

### LRN-2026-05-18-rls-tenant-via-jwt-claim (confidence: high)
**Context:** Designing multi-tenant RLS for `restaurants`, `customers`, `orders`, `order_items`
**Learning:** Use `restaurant_id::text = (auth.jwt() ->> 'restaurant_id')` for owner-side policies; Supabase puts custom JWT claims under `auth.jwt()`. Child tables (`order_items`, `customer_tags`) check parent via `EXISTS` subquery instead of duplicating `restaurant_id` on every row. Service role bypasses RLS so seed scripts and server-side Next.js routes Just Work.
**Why:** Keeps the schema normalised, makes RLS policies self-evident, and matches Supabase's JWT-claim mechanic.
**How to apply:** When adding any per-tenant table, follow this pattern. When adding an admin dashboard, the auth flow must inject `restaurant_id` into the JWT.
**Source:** session:2026-05-18 (first migration)
**Triggers:** RLS, multi-tenant, JWT claims, restaurant_id, owner policy

### LRN-2026-05-18-rfm-bucket-thresholds (confidence: medium)
**Context:** Defining customer segments for the analytics view `v_customer_rfm`
**Learning:** Initial bucket thresholds: Champion = recency ≤14d AND frequency ≥5; Loyal = recency ≤30d AND frequency ≥3; At-Risk = recency 31-60d; Lost = recency >60d; New = frequency = 1. These are starting heuristics for Saudi small-restaurant ordering cadence (most loyal customers order weekly).
**Why:** RFM thresholds are domain-sensitive; "recency ≤30 days" feels right for weekly-ordering food, would be wrong for monthly subscriptions.
**How to apply:** After first paying restaurant has 60+ days of real data, re-tune thresholds against actual cohort behaviour. Don't ship the dashboard with these as gospel.
**Source:** session:2026-05-18 (seed + view design)
**Triggers:** RFM, segmentation, customer analytics, churn, recency

### LRN-2026-05-18-snapshot-order-items (confidence: high)
**Context:** Designing `order_items` schema — link to a `menu_items` table or snapshot?
**Learning:** **Snapshot.** Store `item_name`, `variant`, `unit_price` directly on `order_items` rather than FK-ing to a `menu_items` row. If the owner edits the menu or changes a price next week, historical orders must still report what was actually sold at the time. Same reasoning for `total` on `orders` — frozen at submit time.
**Why:** Foreign key to a mutable menu would silently rewrite history; reporting and disputes would break.
**How to apply:** Any table representing a completed business event (order, invoice, payment) snapshots the relevant fields. Reference tables are for live state, not history.
**Source:** session:2026-05-18 (schema design)
**Triggers:** historical data, snapshot vs reference, order_items, menu changes

### LRN-2026-05-18-graphify-icons-noise (confidence: medium)
**Context:** Running `/graphify` on D:\menulink — detected 10 PWA icon images (all variants of the rooster logo)
**Learning:** Default detection treats every PNG as a separate input and would dispatch one subagent per image. For icon sets (identical content at different sizes), filter them out before extraction — they produce N redundant "rooster logo" nodes with no useful edges. Patched `.graphify_detect.json` to set `images: []` before semantic step.
**Why:** Graphify's strength is cross-document surprise; identical assets add noise, not signal.
**How to apply:** Before running `/graphify` on any project with sized-icon variants, drop the icon list from detection. Same trick for build output folders if they leak into detection.
**Source:** session:2026-05-18
**Triggers:** graphify, knowledge graph, image dedup, icons, PWA assets

### LRN-2026-05-19-ios-safari-geolocation-needs-gesture (confidence: high)
**Context:** v7 cart drawer had a Leaflet map that called `navigator.geolocation.getCurrentPosition` on mount. Worked on desktop and Android, but iPhones silently never asked for permission.
**Learning:** iOS Safari (and increasingly Chrome) requires geolocation requests to be inside a **direct user-gesture handler** (button click, tap). Auto-calling on mount doesn't even fire the permission prompt — it just fails silently with `PERMISSION_DENIED`. Always wire geolocation behind an explicit "📍 Use my location" button.
**Why:** Apple's privacy posture; same rule applies to push-notification subscription, audio playback, etc.
**How to apply:** Anywhere a permission-gated browser API is used, gate it behind an explicit user gesture. Provide a manual fallback (drag-pin, paste-link, etc.) that always works.
**Source:** session:2026-05-19 (v7 map fix)
**Triggers:** geolocation, iOS Safari, user gesture, permission denied silently, mobile

### LRN-2026-05-19-leaflet-zero-size-in-drawer (confidence: high)
**Context:** Leaflet map mounted inside a sliding-open cart drawer measured the container at 0×0 at first render → blank gray box.
**Learning:** Leaflet (and most JS map libs) calls `getBoundingClientRect()` once on init. If the container is hidden / mid-animation / `display: none`, the size sticks at 0 until you call `map.invalidateSize()`. **Single `setTimeout` isn't enough** for animated drawers — fire it at 60ms, 280ms, 600ms, 1200ms PLUS attach a `ResizeObserver` for any later layout shift (orientation, keyboard open, drawer resize).
**Why:** No way to know in advance when the parent will finish animating.
**How to apply:** Every map / chart / canvas / VR-canvas component mounted inside an animated parent needs the multi-stage invalidate + ResizeObserver pattern.
**Source:** session:2026-05-19 (v7 map fix)
**Triggers:** Leaflet, drawer, modal, map blank, invalidateSize, ResizeObserver

### LRN-2026-05-19-vercel-json-strict-schema (confidence: high)
**Context:** Added a `_comment` key to `vercel.json` for documentation. Deploy errored: "Vercel rejected unknown keys."
**Learning:** Vercel's `vercel.json` JSON schema is strict — unknown keys cause deployment failure, not warning. Document via git commit messages or a separate adjacent .md file. Never inline-comment vercel.json.
**Why:** Vercel validates the schema before bundling. Strict mode catches typos but also documentation attempts.
**How to apply:** Treat vercel.json as data-only. Comments live elsewhere.
**Source:** session:2026-05-19 (legacy redirect setup)
**Triggers:** vercel.json, schema error, deploy failed, unknown keys

### LRN-2026-05-19-stitch-design-system-vs-claude-design-md (confidence: medium)
**Context:** User invoked the `/stitch-skill`, generated a design system YAML for the customer PWA. Some choices conflicted with our `DESIGN.md` (Stitch picked `Inter` which is banned, picked `Hanken Grotesk` where we use Tajawal, picked `#141313` vs our `#0A0A0A`).
**Learning:** Treat Stitch (and any AI design tool) as an **input**, not authority. Our `DESIGN.md` is the source of truth. When Stitch's output conflicts, override the conflicting parts (font choices, banned colors, banned anti-patterns) and adopt the rest (structural ideas like 32px row heights, dot-indicator status chips, image-on-top cards, sticky bottom nav).
**Why:** Stitch is trained on generic patterns, doesn't know our Arabic-first / anti-Inter / no-purple constraints.
**How to apply:** Run Stitch → reconcile vs DESIGN.md → adopt the structural insights, reject the typography/color violations.
**Source:** session:2026-05-19 (v7 Stitch redesign)
**Triggers:** Stitch, design system, generated tokens, Inter banned, font conflict, design merge

### LRN-2026-05-19-image-on-side-vs-image-on-top-call (confidence: medium)
**Context:** When porting v6 (image-on-side compact list) to v7, I initially kept image-on-side. User pushed back — Stitch's image-on-top 2-col grid was the actual intent.
**Learning:** Image-on-top with 2-col grid (3 on tablet, 4 on desktop) creates a more "editorial" food-photography feel that matches modern Saudi restaurant ordering expectations. Image-on-side is denser but feels older/less premium. Default to image-on-top for new customer PWAs unless density is mandatory.
**Why:** Saudi users are highly visual; food photography sells. Density beats variety here.
**How to apply:** For any new customer-facing food/retail PWA, start with 2-col image-on-top. Only fall back to image-on-side if menu has 50+ items per category.
**Source:** session:2026-05-19 (v7 Stitch redesign, user corrected pragmatic-list choice)
**Triggers:** card layout, image position, food PWA, menu design

### LRN-2026-05-19-design-vs-operations-split (confidence: high)
**Context:** First version of `/admin/info` let restaurant owners edit logo, cover image, primary color, background color. User pushed back: "the dev id must do it i will take the design from the client... i'm the dev will be the designer not the tenant id or restaurants owners."
**Learning:** **Design is ops's job, not the tenant's.** Restaurant owners are operators — they should only edit operational data (menu items, prices, hours, WhatsApp number, address). Visual identity (logo, cover image, brand colors, name, slug) belongs to the platform team. This applies to MenuLink and to most agency-style SaaS where the platform takes on the design role.
**Why:** Owners aren't designers. Letting them pick colors leads to clashing brands and degraded platform aesthetic. The platform takes ownership of polish.
**How to apply:** When designing any tenant admin, audit each editable field: "Is this operational (data) or design (identity)?" Lock the design fields to ops only. Document the rule explicitly in DESIGN.md.
**Source:** session:2026-05-18 (user feedback after S7+)
**Triggers:** tenant admin, ops vs tenant, visual identity, brand colors, logo upload

### LRN-2026-05-18-new-secret-keys-block-server-side (confidence: high)
**Context:** Trying to create a Supabase Auth user via `POST /auth/v1/admin/users` with the new `sb_secret_*` key, got back `401 "Forbidden use of secret API key in browser"`.
**Learning:** Supabase's new key format (`sb_publishable_*` + `sb_secret_*`) is stricter than legacy JWT keys. The `sb_secret_*` is rejected by GoTrue's admin endpoints when the User-Agent looks browser-ish (and PowerShell's `Invoke-RestMethod` triggers this). **For Auth Admin API calls, fall back to the legacy `service_role` JWT** that's still issued alongside. Both keys point to the same role, but the legacy JWT bypasses the browser-context check.
**Why:** Supabase added this guard because pasting `sb_secret_*` into client code is catastrophic. The browser-context heuristic is over-broad.
**How to apply:** When writing operational scripts that hit the Auth Admin API, prefer the legacy `service_role` JWT (from `/v1/projects/<ref>/api-keys`). Keep `sb_secret_*` reserved for actual server runtimes (Vercel env, Supabase Edge Functions).
**Source:** session:2026-05-18 (creating the KO-KO test owner)
**Triggers:** auth admin api, sb_secret, 401, browser context, GoTrue, create user

### LRN-2026-05-18-realtime-needs-publication (confidence: high)
**Context:** Wrote the orders Realtime feed in /admin/orders before adding the table to the Supabase Realtime publication. Subscribed channel was silent.
**Learning:** Supabase Realtime only emits postgres_changes for tables explicitly added to the `supabase_realtime` publication. Run `alter publication supabase_realtime add table public.orders;` (and any other table you want live). Forgetting this is silent — no error, just no events.
**Why:** Supabase scopes Realtime per-publication to limit replication noise. The default publication doesn't include user tables.
**How to apply:** When adding a Realtime subscription to any new table, immediately run the ALTER PUBLICATION migration alongside the schema migration. Keep a checklist: schema + RLS + publication + client subscription.
**Source:** session:2026-05-18 (S5 admin orders feed)
**Triggers:** Realtime, postgres_changes, supabase_realtime, publication, ALTER PUBLICATION, silent subscription

### LRN-2026-05-18-nextjs-pathname-in-server-component (confidence: high)
**Context:** Wanted to detect whether the current /admin/* route was the login page in `app/admin/layout.tsx` to skip the auth guard for /admin/login. Next.js 14 Server Components have no direct way to read the request path.
**Learning:** Set `x-pathname: request.nextUrl.pathname` as a REQUEST header inside middleware, then read it in any Server Component via `headers().get('x-pathname')`. Don't use Next.js's `usePathname()` — that's client-only.
**Why:** Server Components don't have access to the request object; only middleware does. Middleware can mutate the request headers that flow downstream.
**How to apply:** Any time a Server Component needs to know the URL/path, route through middleware-injected headers.
**Source:** session:2026-05-18 (S3 admin layout skipping auth for /admin/login)
**Triggers:** Next.js, Server Component, pathname, middleware, headers, request URL

### LRN-2026-05-18-sw-stale-html-trap (confidence: high)
**Context:** First post-deploy live test of the wired PWA returned no rows in Supabase. Server was serving the new HTML (verified via direct fetch), but the user's browser saw old code.
**Learning:** PWA v6's service worker was cache-first **stale-while-revalidate** with a frozen VERSION key. On any user visit, the SW returned the previously-cached HTML and only fetched fresh in the background — so the customer always sees the previous deploy's HTML on first reload, never the latest. The cache_name is keyed off VERSION; if you never bump it, the activate handler never deletes the old cache.
**Why:** Cache-first SWE is fine for true static assets (icons, fonts) but a deploy-blocker for the page that contains your application code. Every deploy needs explicit cache invalidation.
**How to apply:** (1) Navigation/HTML requests should use **network-first** with cache fallback only for offline. (2) Bump VERSION on every meaningful deploy so the activate handler purges the old cache. (3) When debugging "my deploy seems to not be live" issues, always check via incognito or different browser first — eliminates the SW cache variable.
**Source:** session:2026-05-18 (first live PWA→Supabase test produced zero rows despite correct server code)
**Triggers:** service worker, cache-first, stale HTML, deploy not visible, PWA cache, sw VERSION

### LRN-2026-05-18-rls-conflict-with-cmd-all (confidence: high)
**Context:** Anon insert from PWA failing with "new row violates row-level security policy" even though `anon_insert_customers` policy had `with check (true)`.
**Learning:** When you have a PERMISSIVE policy with `cmd=ALL` scoped to `public` (all roles) AND a separate INSERT policy scoped to a specific role, the ALL policy still fires for that role's INSERT and its WITH CHECK is evaluated. Even though policies are OR'd in theory, in practice PostgREST/Supabase will refuse the insert when the ALL policy returns NULL/FALSE for an anon JWT. **Scope owner policies strictly to `to authenticated`** (never `to public` / no role clause), so they never fire for anon at all.
**Why:** Postgres permissive-OR semantics work as documented in isolation, but cmd=ALL policies are a footgun — they apply to INSERT too. Easier to never mix `to public` ALL policies with role-specific INSERT policies.
**How to apply:** When designing RLS for any new table: write SELECT, INSERT, UPDATE, DELETE policies as **separate, role-specific** statements. Never use `for all to public`. Make the role explicit on every policy.
**Source:** session:2026-05-18 (debugging first live PWA order that didn't land)
**Triggers:** RLS, row-level security, anon insert, cmd ALL, policy conflict, 42501

### LRN-2026-05-18-rpc-over-direct-writes (confidence: high)
**Context:** PWA needed to upsert customer, insert order, insert items as anon. Direct .from('table').upsert().select() pattern hit two problems: (1) RLS conflict above, (2) `.select('id').single()` requires SELECT permission on the table.
**Learning:** For anon-facing writes, prefer a single `SECURITY DEFINER` Postgres function over multiple direct-table calls. Benefits: (a) one atomic transaction, (b) one round-trip, (c) anon role gets EXECUTE on the function but NO direct table access — defence in depth, (d) the function is the security boundary and can validate inputs (`raise exception` on bad data), (e) easier to evolve later (add fields without changing client).
**Why:** The trade-off is that the function lives in SQL and is slightly less visible than client-side code. Worth it for the security/atomicity gains.
**How to apply:** For any future anon-facing write (push subscription, customer feedback, etc.), reach for an RPC first. Direct-table writes are for the admin app (authenticated, with RLS-enforced tenant scoping).
**Source:** session:2026-05-18 (live PWA order bug, fixed via submit_order RPC)
**Triggers:** anon write, RPC, security definer, RLS workaround, direct table insert

### LRN-2026-05-18-fire-and-forget-persist (confidence: high)
**Context:** Wiring v6 PWA to write each order to Supabase before opening WhatsApp.
**Learning:** Do NOT `await` the Supabase insert before opening the wa.me URL. Use fire-and-forget: kick off `persistOrder(...)` (no await), then immediately `window.open(...)`. Reasons: (1) zero perceived latency for the customer, (2) WhatsApp opens even if Supabase is down, (3) the Promise keeps running in the background after window.open. The persist function has its own try/catch so unhandled rejections never bubble.
**Why:** The customer's order experience must never depend on our database being healthy. Lost analytics row > lost customer order.
**How to apply:** Any "side-effect on action" call (analytics, telemetry, audit log) should fire-and-forget when latency to the user-visible action matters more than guaranteed delivery. Use awaited writes only when the next user action genuinely depends on the result.
**Source:** session:2026-05-18 (PWA wiring)
**Triggers:** fire-and-forget, await, latency, analytics, fail open

### LRN-2026-05-18-phone-normalization-saudi (confidence: high)
**Context:** Unique index `(restaurant_id, phone)` on customers — needed to catch repeat customers
**Learning:** Saudi customers type phones in at least 4 formats: `0501234567`, `966501234567`, `+966501234567`, and `٠٥٠١٢٣٤٥٦٧` (Arabic-Indic digits). Without normalization, the SAME customer creates a new row per format. Normalize to `+9665XXXXXXXX` at insert time: map Arabic-Indic → ASCII digits, strip non-digits, drop `00966`/`966`/`0` prefix, prepend `+966`.
**Why:** Repeat-customer detection drives RFM frequency, LTV, dormant-customer targeting. Wrong phone format = the analytics value layer silently breaks.
**How to apply:** Every new ingestion point (PWA, admin tool, POS import, CSV upload) must call `normalizePhone()` before any DB write. Same function lives in v6 PWA — copy it forward to apps/web later, don't reimplement.
**Source:** session:2026-05-18 (PWA wiring)
**Triggers:** phone normalization, Arabic-Indic digits, duplicate customers, unique index, RFM

### LRN-2026-05-18-cloud-pivot-via-mgmt-api (confidence: high)
**Context:** Docker daemon froze mid-pull during `supabase start`. User had just provided a Supabase access token (sbp_*) and project was already created in dashboard.
**Learning:** When the local Docker stack is unavailable, you can apply migrations directly to Supabase Cloud via the Management API: `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `Authorization: Bearer <access_token>` and `{"query":"<sql>"}`. No DB password needed, no Docker needed, no `supabase db push`. Used this to apply 0001_init.sql, 0002_analytics_views.sql, and seed.sql in 3 calls.
**Why:** The Supabase CLI's `db push` workflow requires Docker (for shadow DB diff) AND the database password. The Management API skips both.
**How to apply:** For any future "Docker is dead but I need to ship" moment, OR for one-off operational SQL on a cloud project, use the Management API. Save the user the trouble of a Docker Desktop restart.
**Source:** session:2026-05-18 (encountered + recovered live)
**Triggers:** supabase cloud, management API, Docker frozen, db push, alternative deploy path

### LRN-2026-05-18-mcp-vs-cli-account-separation (confidence: high)
**Context:** The Claude.ai Supabase MCP server is configured with one Supabase account (project "alsamlah", ap-northeast-2). The user created a separate MenuLink Supabase account (id.menulink@gmail.com) with project "Menu Link Project" in Singapore.
**Learning:** The MCP `mcp__claude_ai_Supabase__*` tools operate on whichever account the MCP server was wired to during Claude Code setup. They cannot reach a project on a different account, even if a personal access token for that account is available in the session. **For multi-account work, use the Management API via PowerShell + Invoke-RestMethod**, not the MCP.
**Why:** MCP tools are stateless wrappers around stored credentials in the MCP server config; the access token in chat does not retroactively switch accounts.
**How to apply:** Whenever the MCP `list_projects` shows a different project than the user is talking about, fall back to the Management API. Don't waste a tool call trying.
**Source:** session:2026-05-18
**Triggers:** Supabase MCP, multiple accounts, project ref mismatch, management API fallback

### LRN-2026-05-18-supabase-start-saturates-docker (confidence: medium)
**Context:** First-time `npx supabase start` on a clean Docker Desktop install
**Learning:** Supabase pulls ~14 images in parallel (postgres, kong, gotrue, postgrest, storage, realtime, studio, edge-runtime, logflare, imgproxy, vector, mailpit, postgres-meta, supabase-vector). On a moderately fast network this saturated Docker Desktop on Windows so badly that even `docker version` started timing out (>60s). Killed the start, daemon stayed unresponsive — Docker Desktop needed a manual restart.
**Why:** Parallel pull + parallel extract of multi-GB images stresses Docker Desktop's WSL2 layer.
**How to apply:** Warn the user before first `supabase start` that pulls will be slow and Docker may need a restart. After the initial pull, subsequent starts use cached layers and are fast (~30s). Consider pre-pulling images serially next time: `docker pull supabase/postgres:<ver>; docker pull supabase/gotrue:<ver>; ...` to avoid the saturation.
**Source:** session:2026-05-18 (encountered during plan execution)
**Triggers:** supabase start, Docker Desktop, frozen daemon, first-run pull, Windows WSL2

### LRN-2026-05-18-customer-segmentation (confidence: high)
**Context:** Initial assumption that KO-KO was the brother's restaurant and our test bed for RzRz  
**Learning:** **WRONG.** KO-KO is a paying customer who approached us directly, wants 2 instances of MenuLink, and may not use RzRz at all. The RzRz integration testbed is a DIFFERENT restaurant where brother is operations manager. **Always verify which customer you're working with before applying RzRz-specific knowledge.**  
**Source:** user correction on session:2026-05-18  
**Triggers:** KO-KO, brother's restaurant, customer taxonomy, RzRz testbed

---

## ❌ What Has Failed (Avoid These)

### LRN-2026-05-18-direct-db-only-if-remote (confidence: medium)
**Context:** Initially assumed direct SQL connection from Supabase Edge Functions would always work for RzRz  
**Learning:** Direct DB integration only works if the customer's SQL Server is publicly accessible (the central hosted server at 192.250.231.22). For local-only deployments (DB on cashier's PC behind a router), direct connection is impossible — **Bridge App is required.** The RzRz restaurant testbed is likely a local-only deployment.  
**Source:** session:2026-05-18  
**Triggers:** SQL connection, firewall, local database, port forwarding, NAT

### LRN-2026-05-18-no-overengineering (confidence: high)
**Context:** Tempted to evaluate Ruflo agent orchestration framework for the project  
**Learning:** Frameworks like Ruflo (314 MCP tools, 26 CLI commands, alpha-stage) are designed for complex enterprise software engineering with parallel agent swarms. For a solo developer building a restaurant SaaS, this is severe over-engineering. **Decision: skip. Stick with managed services + clear handoff docs + this skill.**  
**Source:** session:2026-05-18  
**Triggers:** Ruflo, agent orchestration, multi-agent, swarm, framework adoption

### LRN-2026-05-18-assumption-customer-conflation (confidence: high)
**Context:** Mistake in earlier session: I assumed KO-KO was the brother's restaurant with RzRz access  
**Learning:** When a user mentions a customer name and a technical detail (like POS access), **never assume they refer to the same restaurant.** Ask: "Is the POS at the same restaurant as the one ordering MenuLink, or a different one?" The cost of asking is 10 seconds; the cost of building on wrong assumption can be days.  
**Source:** user correction on session:2026-05-18  
**Triggers:** customer info, restaurant details, assumption check

### LRN-2026-05-19-supabase-jwt-claims-nested (confidence: high) ⚠️ CRITICAL
**Context:** Migrations 0001/0003/0004/0005/0007 wrote RLS policies using `auth.jwt() ->> 'restaurant_id'` and `auth.jwt() ->> 'role'`. After v7 launch, every authenticated query silently returned empty results: owner couldn't create categories ("RLS violation"), `/admin/info` threw "Cannot coerce to single JSON object", `/admin/orders` showed no rows. The dashboard "revenue" tile still showed numbers — *because views bypass RLS in PG15+ default `security_invoker=false`* (which is also a cross-tenant data leak by itself).  
**Learning:** **Supabase nests `app_metadata` claims inside the JWT — they are NOT top-level.** So `auth.jwt() ->> 'restaurant_id'` always returns NULL. The correct path is `auth.jwt() -> 'app_metadata' ->> 'restaurant_id'`. **Better fix: don't read JWT claims at all** — use `auth.uid()` + a lookup against `restaurant_owners` / `platform_admins`. That's what migration 0008 does (helper functions `public.owns_restaurant(uuid)` and `public.is_platform_admin()`, both SECURITY DEFINER to avoid RLS recursion).  
**Also:** views with default `security_invoker=false` will leak across tenants if the calling code doesn't add `.eq("restaurant_id", ...)`. The dashboard had this bug on `v_revenue_daily` until 0008.  
**Source:** session:2026-05-19 + advisor correction  
**Triggers:** RLS, Supabase, auth.jwt, app_metadata, restaurant_id claim, multi-tenant security

### LRN-2026-05-19-ops-needs-policies-or-service-role (confidence: high)
**Context:** Ops onboarding wizard (`/ops/tenants/new`) used the cookie client to INSERT into `restaurants`, but there was NEVER an INSERT policy for that table. RLS just dropped it silently.  
**Learning:** Two-prong fix: (1) add explicit `platform_admin` ALL policies on every table ops touches (restaurants, menu_*, customers, orders, payments, subscriptions) using the `is_platform_admin()` helper; (2) for ops actions specifically, prefer the **service_role admin client** — `requireOps()` is the auth gate, and bypassing RLS for ops is safer and simpler than chasing per-table policies.  
**Source:** session:2026-05-19  
**Triggers:** ops, platform_admin, service_role, RLS INSERT, cookie client

---

## 🏷️ Customer-Specific Quirks

### KO-KO Chicky Licky (first paying customer)
- POS: TBD (not RzRz — confirmed)
- Wants **2 instances** of MenuLink — meaning unclear (2 branches? 2 brands? 2 languages?)
- Has v6 PWA already built and ready
- Already has full menu, branding, design assets
- **Blocker:** clarify "نسختين" meaning before doing anything else
- See `customers/koko-chicky-licky.md` for full details

### RzRz Restaurant (integration testbed)
- POS: **RzRz (Punnelifosys ResApp)** — full version
- User's brother is operations manager → privileged access
- Likely Tier 1b (Bridge App) — local DB assumption
- This is where we build & validate Bridge App before selling to other RzRz customers
- Real production load — can't break for long
- **No pricing pressure** — free or discounted in exchange for R&D access
- See `customers/rzrz-restaurant.md` for full details

---

## ❓ Open Questions

### ~~OPN-2026-05-18-local-dev-strategy~~ ✅ RESOLVED
**Resolution:** Use Supabase CLI (`npx supabase start`), not raw Docker Postgres. See [[lrn-2026-05-18-supabase-cli-same-software]].

### OPN-2026-05-18-koko-instances (priority: critical, blocker)
**Question:** What does KO-KO mean by "نسختين من MenuLink"? Two branches? Two brands? Arabic+English versions? Test+Production?  
**How to investigate:** WhatsApp/call the owner directly. This is a blocker — we can't onboard them until we know.  
**Quick script:** "أهلاً، قبل ما نبدأ — قصدك في النسختين الفرعَين الاثنين، أو ايش بالضبط؟"

### OPN-2026-05-18-koko-pos (priority: high)
**Question:** Does KO-KO use any POS system? If yes, which?  
**How to investigate:** Ask owner during the same call as above. Affects which integration tier to plan.

### OPN-2026-05-18-rzrz-db-topology (priority: high)
**Question:** At the RzRz restaurant (brother's), is the SQL database hosted on the central server (192.250.231.22) or local-only on the cashier PC?  
**How to investigate:** Brother can answer. Look at `.exe.config` connection string on the cashier PC. Determines Tier 1a (direct DB) vs Tier 1b (Bridge App).

### OPN-2026-05-18-counterid-for-online (priority: high)
**Question:** What value of `CounterID` should online orders use in `InsertInvoice`? The procedure requires it but POS counters are physical terminals. Need to either:
(a) Create a virtual "online counter" in RzRz settings  
(b) Reuse counter #1 with a different flag  
(c) Check if `CounterID=0` is acceptable  
**How to investigate:** Try each option on RzRz restaurant DB (with brother's permission), watch what shows up in POS UI.

### OPN-2026-05-18-createdby-for-online (priority: high)
**Question:** Same as above but for `CreatedBy`. This is a user ID. We need either a special "MenuLink Bot" user or reuse owner's user ID. Affects audit trail.

### OPN-2026-05-18-menu-sync-direction (priority: medium)
**Question:** For RzRz customers, should MenuLink read menu FROM RzRz (single source of truth) or maintain its own menu and rely on item ID mapping? Foodics integration plan was: read from Foodics. RzRz allows the same since we control both ends. **Tentative decision:** Read from RzRz `Items` table on initial onboarding, then sync nightly.

### OPN-2026-05-18-bridge-app-tech (priority: medium)
**Question:** When we build the Bridge App for the RzRz testbed, should it be a Windows Service or a Tray App? Service = invisible, robust. Tray App = visible, owner can see status. **Likely answer:** Tray App (better UX for non-technical staff, brother can see if it's running).

### OPN-2026-05-18-bridge-app-as-product (priority: low, but strategic)
**Question:** After the Bridge App works for the testbed, can we sell it to other RzRz customers via Punnelifosys? Would they partner with us?  
**How to investigate:** After 30 days of clean operation at the testbed, reach out to Punnelifosys with a partnership pitch.

---

## 📜 Reflection Log (Chronological)

### 2026-05-18 · Foundation Plan Executed (Obsidian + Supabase + Analytics Schema)
- **What worked:**
  - The plan workflow (explore → ask → plan → execute) caught real ambiguity early (apps/web vs backend, wikilink conversion scope).
  - Supabase CLI strategy was the right call — schema written once, no migration step planned for cloud cutover.
  - Graphify on this small corpus produced 19 communities that map cleanly to the project's actual mental model (Frontend stack, Backend stack, RzRz integration, KO-KO customer, Pricing landscape, etc.). The community names match how a human would explain the project.
  - Determinist seed (`setseed(0.42)`) means `db reset` will produce the same data every time — useful for reproducible debugging.
- **What hit friction:**
  - `npx supabase start` on first run pulled ~14 Docker images in parallel and froze Docker Desktop on Windows. Daemon became unresponsive (>60s timeouts on `docker version`). The user will need to restart Docker Desktop and re-run `supabase start`; pulls will resume from cached layers.
  - PowerShell's cp1252 default broke the graphify benchmark step (Unicode box-drawing chars). Set `PYTHONIOENCODING=utf-8` to fix.
  - PowerShell escaping inside `python -c "..."` strings forced rewriting one-liners to avoid nested quotes.
- **What surprised me:**
  - The semantic extraction subagent identified `Open: Two Instances Interpretation` as a real node in the graph and linked it to the KO-KO customer cluster — meaning the **unresolved business question is now visually surfaced as a hub** in Obsidian. The graph effectively makes blockers impossible to forget.
  - Graphify clustered `menulink-integration Skill` together with `RzRz Restaurant (Testbed)` and `Brother as Operations Manager` — correctly identifying the skill as a knowledge-hub for the testbed customer specifically, not for KO-KO.
  - The Docker freeze turned out to be a *better* situation than success: it forced the cloud-pivot via Management API, which means we deployed to Supabase Cloud directly on the first day with no migration step needed later. The schema is live in Singapore right now.
- **Captured learnings:**
  - [[lrn-2026-05-18-supabase-cli-same-software]] (success pattern)
  - [[lrn-2026-05-18-apps-web-monorepo-layout]] (user-correction-driven)
  - [[lrn-2026-05-18-rls-tenant-via-jwt-claim]] (design pattern)
  - [[lrn-2026-05-18-rfm-bucket-thresholds]] (initial heuristic, needs tuning later)
  - [[lrn-2026-05-18-snapshot-order-items]] (design pattern)
  - [[lrn-2026-05-18-graphify-icons-noise]] (tool quirk)
  - [[lrn-2026-05-18-supabase-start-saturates-docker]] (friction documented)
- **Resolved:** [[opn-local-dev-strategy]] → Supabase CLI.

### 2026-05-18 · Customer Taxonomy Correction
- User clarified: KO-KO is a **paying customer** (first one!), not the brother's restaurant
- Brother is operations manager at a **different** restaurant which is the RzRz testbed
- Created separate customer files: `koko-chicky-licky.md` (paying) and `rzrz-restaurant.md` (testbed)
- Major lesson: **never conflate two pieces of customer info just because they were mentioned in the same context**
- Updated learnings with new customer segmentation
- KO-KO has a HUGE open question: what does "نسختين" mean? Blocks onboarding.

### 2026-05-18 · RzRz Discovery Session
- Connected to user's PC, explored `D:\Samer\RZRZ-CODE`
- Confirmed: .NET Framework 4.7.2, EF + SQL Server, Windows Forms, ZATCA-ready
- Found `InsertInvoice` stored procedure → integration path is clear
- Discovered DB credentials in plain text in `.exe.config` ⚠️ flagged as future security task
- Initially confused: which restaurant has this? Now clarified → it's the RzRz testbed (brother's), not KO-KO

### 2026-05-18 · Skill Created
- Built `menulink-integration` skill with:
  - SKILL.md, learnings.md, 5 references, customer template
  - Pre-seeded with everything learned so far
- This is the first iteration — will improve as customers reveal more quirks

---

## 📝 How To Update This File

When you have a new learning to capture, follow these rules:

1. **Pick the right section** (worked / failed / customer / open question / log)
2. **Generate an ID:** `LRN-YYYY-MM-DD-<3-word-slug>` (or `OPN-` for open questions)
3. **Assign confidence:** 
   - `high` = directly observed multiple times, or a user correction
   - `medium` = inferred from one observation, plausible
   - `low` = hypothesis worth testing
4. **Keep it short:** 2-4 lines max. Long explanations go in references/.
5. **Add triggers:** keywords that should make this learning surface later.
6. **Always add a log entry** under "Reflection Log" with the date.

When the file gets too long (~50 entries), consolidate: merge similar entries, archive resolved open questions to a `learnings-archive.md`, keep only active patterns here.
