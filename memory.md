# MenuLink · Project Memory

> **Read this first** when picking up the project in a new session.
> Last saved: **2026-05-19** at the end of the v7 launch + GPS-fix session.
> Status line: **production. KO-KO live. v7 customer PWA + tenant admin + platform ops all shipped.**

---

## 30-Second TL;DR

MenuLink is a multi-tenant Arabic SaaS for Saudi restaurants. Three surfaces live, all on Vercel + Supabase:

- **Customer PWA** at `/m/koko` (and any tenant slug) — KO-KO's customers order food, message goes to WhatsApp, order persists to Supabase.
- **Tenant Admin** at `/admin/*` — restaurant owners edit menu, see orders in realtime, manage customers.
- **Platform Ops** at `/ops/*` — you (the platform operator) manage all tenants, onboard new ones, log payments.

The original v6 static HTML PWA at `menulink-eight.vercel.app` now 302-redirects to the new v7 Next.js page so all old links + QR codes still work.

---

## 🌐 Live URLs

| URL | Serves | Status |
|---|---|---|
| `https://menulink-eight.vercel.app/` | 302 → v7 (legacy compatibility) | ✅ live |
| `https://menulink-eight.vercel.app/koko-menu-v6.html` | 302 → v7 (legacy deep-link) | ✅ live |
| `https://menulink-admin-five.vercel.app/` | Marketing landing (Arabic hero + pricing + WhatsApp CTA) | ✅ live |
| `https://menulink-admin-five.vercel.app/m/koko` | **v7 customer PWA · canonical** | ✅ live |
| `https://menulink-admin-five.vercel.app/m/<slug>` | Multi-tenant — works for any onboarded restaurant | ✅ live |
| `https://menulink-admin-five.vercel.app/m/koko/manifest.webmanifest` | Per-tenant PWA manifest | ✅ live |
| `https://menulink-admin-five.vercel.app/admin/login` | Tenant owner sign-in | ✅ live |
| `https://menulink-admin-five.vercel.app/admin` | Owner dashboard (orders feed Realtime) | ✅ live |
| `https://menulink-admin-five.vercel.app/admin/menu` | Menu CRUD + image uploads | ✅ live |
| `https://menulink-admin-five.vercel.app/admin/info` | Operational info form (operator data only — NO design) | ✅ live |
| `https://menulink-admin-five.vercel.app/admin/orders` | Live orders feed (Supabase Realtime) | ✅ live |
| `https://menulink-admin-five.vercel.app/admin/customers` | RFM segments table | ✅ live |
| `https://menulink-admin-five.vercel.app/ops/login` | Platform admin sign-in | ✅ live |
| `https://menulink-admin-five.vercel.app/ops` | All tenants list | ✅ live |
| `https://menulink-admin-five.vercel.app/ops/tenants/[id]` | Drill-in: subscription, owners, payments, **design (logo+cover+colors)** | ✅ live |
| `https://menulink-admin-five.vercel.app/ops/tenants/new` | Onboarding wizard (creates restaurant + auth user + subscription) | ✅ live |
| `https://menulink-admin-five.vercel.app/ops/payments` | Log received payment → activates subscription | ✅ live |

---

## 🔐 Credentials & Tokens

### Test accounts (rotate before real production)
- **KO-KO owner:** `koko-owner@menulink.test` / `KokoMenuLink2026!`
- **Platform ops:** `id.menulink@gmail.com` / `OpsMenuLink2026!`

### Tokens used during build sessions (all in earlier chat history)
These all need rotating before final production. Locations:
- Vercel personal access token → https://vercel.com/account/tokens
- Supabase project access token → https://supabase.com/dashboard/account/tokens
- Supabase service_role key (both legacy JWT and `sb_secret_*` formats) → https://supabase.com/dashboard/project/dhmjrrsynfvomlzhggvu/settings/api-keys

The `sb_publishable_*` anon key is intentionally public and committed in `apps/web/.env.local` — safe to keep.

---

## 🗄️ Database

- **Provider:** Supabase Cloud
- **Project:** "Menu Link Project"
- **Project ref:** `dhmjrrsynfvomlzhggvu`
- **Region:** Southeast Asia (Singapore) — `ap-southeast-1`
- **Owner email:** `id.menulink@gmail.com`
- **Dashboard:** https://supabase.com/dashboard/project/dhmjrrsynfvomlzhggvu

### Schema (7 migrations applied)

| Migration | What it does |
|---|---|
| `0001_init.sql` | Core: restaurants, customers, orders, order_items, customer_tags, push_subscriptions. RLS on every table. |
| `0002_analytics_views.sql` | 6 views: `v_customer_rfm`, `v_customer_ltv`, `v_dormant_customers`, `v_top_items_per_customer`, `v_top_items_per_restaurant`, `v_revenue_daily` |
| `0003_submit_order_rpc.sql` | RLS rewrite (owner policies scoped to `authenticated`, not `public`) + `submit_order(jsonb)` SECURITY DEFINER RPC. Anon writes go through the RPC, never direct table inserts. |
| `0004_multi_tenant_menu.sql` | menu_categories, menu_items, menu_item_variants, restaurant_owners. Expands restaurants with address/hours/colors/is_published. `get_public_menu(slug)` RPC. |
| `0005_subscriptions_ops.sql` | subscriptions, payments, platform_admins + JWT-claim triggers that write `role` + `restaurant_id` into `raw_app_meta_data`. Payment-insert trigger advances subscription to active. Subscription-overdue trigger auto-unpublishes restaurant. |
| `0006_ops_helpers.sql` | `get_tenant_owners(uuid)` RPC so ops can see owner emails without direct `auth.users` access. |
| `0007_menu_images_storage.sql` | Public `menu-images` Storage bucket (5 MB cap, jpeg/png/webp). RLS: anon read, owner CRUD scoped to `<restaurant_id>/` path prefix, ops bypass. |

All migrations live in `apps/web/supabase/migrations/`. Apply locally via `npx supabase db reset` or push to cloud via `supabase db push` (we used the Management API directly in this build).

### Seed
- 1 restaurant: KO-KO Chicky Licky (slug `koko`)
- 20 fake customers across all 5 RFM segments
- ~80 fake orders across last 90 days
- 7 categories, 32 menu items, 46 price variants (real KO-KO menu)
- 1 subscription row: yearly, status `pending_payment` (no real payment logged yet)

### KO-KO restaurant_id
`11111111-1111-1111-1111-111111111111` — hardcoded in seed, referenced by v6 PWA, used in test scripts.

---

## 🏗️ Infrastructure

### Vercel — 2 Projects in the `idmenulink-4869s-projects` team

| Project | Vercel ID | URL | Root dir | What it does |
|---|---|---|---|---|
| `menulink` | `prj_najAY5WlZjllgCEdopbPuP2KS1yv` | `menulink-eight.vercel.app` | `.` | Static. `vercel.json` 302-redirects `/` and `/koko-menu-v6.html` to the admin project. All v6 assets still served for legacy PWA installs. |
| `menulink-admin` | `prj_dkkwLFzNq20g0mlpi14OOVVCACnL` | `menulink-admin-five.vercel.app` | `apps/web` | Next.js 14.2.35. Serves marketing + customer PWA `/m/[slug]` + tenant admin `/admin` + platform ops `/ops`. |

Both deploy from `github.com/Adilibrahimit/menulink`, branch `main`. Auto-deploy on push.

### Env vars on `menulink-admin`
- `NEXT_PUBLIC_SUPABASE_URL` — `https://dhmjrrsynfvomlzhggvu.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `sb_publishable_480WpOtVHhAcDjApm6abBg_0feNGfsJ` (safe, public by design)
- `SUPABASE_SERVICE_ROLE_KEY` — encrypted, legacy JWT (used by the ops onboarding wizard server action)

---

## 📁 Repository Layout

```
D:\menulink\
├── memory.md                              ← THIS FILE
├── README.md                              ← Top-level overview
├── CLAUDE.md                              ← Auto-loaded by Claude Code
├── HANDOFF.md                             ← Strategic context (original brief)
├── DESIGN.md                              ← Design system spec (Stitch-ready)
├── PRICING.md                             ← Pricing details
├── vercel.json                            ← Redirects for the legacy project
├── .gitignore                             ← Top-level
│
├── apps/
│   └── web/                               ← Next.js 14 — admin project's root
│       ├── package.json                   ← Next 14.2.35 + Supabase SSR + Leaflet
│       ├── next.config.js
│       ├── tsconfig.json
│       ├── middleware.ts                  ← Refreshes auth cookie + injects x-pathname header
│       ├── .env.local                     ← gitignored, has Supabase Cloud URLs
│       ├── lib/
│       │   ├── supabase-server.ts         ← Cookie-based SSR client
│       │   ├── supabase-browser.ts        ← Browser client (Realtime + interactive)
│       │   ├── supabase-admin.ts          ← service_role, server-only (ops wizard)
│       │   ├── auth.ts                    ← requireOwner / requireOps guards
│       │   ├── types.ts                   ← DB row shapes
│       │   └── koko-images.ts             ← SLUG_TO_IMG map (URL paths, not base64)
│       ├── app/
│       │   ├── layout.tsx                 ← Google Fonts (Tajawal, Cairo, Anybody, Plus Jakarta)
│       │   ├── page.tsx                   ← Marketing landing
│       │   ├── m/
│       │   │   └── [slug]/                ← Customer PWA v7
│       │   │       ├── page.tsx           ← Server component, RPC fetch
│       │   │       ├── menu-experience.tsx ← Client wrapper, cart state, drawer
│       │   │       ├── menu-item.tsx      ← 2-col image-on-top card
│       │   │       ├── category-tabs.tsx  ← Sticky scroll-spy pill nav
│       │   │       ├── location-picker.tsx ← Leaflet GPS with permission UI
│       │   │       ├── pwa-bootstrap.tsx  ← SW registration + install prompt
│       │   │       ├── manifest.webmanifest/route.ts ← Per-tenant manifest
│       │   │       ├── not-found.tsx
│       │   │       ├── loading.tsx        ← Skeleton
│       │   │       └── types.ts
│       │   ├── admin/                     ← Tenant owner dashboard
│       │   │   ├── layout.tsx             ← Auth check + nav shell + subscription banner
│       │   │   ├── login/
│       │   │   ├── logout/
│       │   │   ├── page.tsx               ← Dashboard (stat cards + RFM + recent orders)
│       │   │   ├── info/                  ← Operational info (NO design fields)
│       │   │   ├── menu/                  ← Menu CRUD with image upload
│       │   │   ├── orders/                ← Realtime feed
│       │   │   ├── customers/             ← RFM table
│       │   │   └── subscription-banner.tsx
│       │   └── ops/                       ← Platform admin
│       │       ├── layout.tsx             ← Dark theme + nav shell
│       │       ├── login/                 ← Separate from /admin/login
│       │       ├── logout/
│       │       ├── page.tsx               ← All tenants list
│       │       ├── tenants/
│       │       │   ├── [id]/
│       │       │   │   ├── page.tsx       ← Drill-in: subscription, owners, payments
│       │       │   │   ├── design-form.tsx ← Logo + cover + colors (ops only)
│       │       │   │   └── tenant-actions.tsx
│       │       │   └── new/               ← Onboarding wizard (3-card single page)
│       │       │       ├── actions.ts     ← Server action: creates restaurant + auth user + subscription
│       │       │       └── new-tenant-form.tsx
│       │       └── payments/              ← Log a received payment
│       ├── public/
│       │   ├── sw.js                      ← Service worker (network-first HTML, cache-first assets)
│       │   └── menu/koko/                 ← Real KO-KO food photos (30 jpegs, ~589 KB total)
│       └── supabase/
│           ├── config.toml
│           ├── seed.sql                   ← Analytics seed (20 fake customers, 80 orders)
│           ├── seed_koko_menu_backfill.sql ← KO-KO menu from v6 HTML
│           └── migrations/
│               ├── 0001_init.sql
│               ├── 0002_analytics_views.sql
│               ├── 0003_submit_order_rpc.sql
│               ├── 0004_multi_tenant_menu.sql
│               ├── 0005_subscriptions_ops.sql
│               ├── 0006_ops_helpers.sql
│               └── 0007_menu_images_storage.sql
│
├── current-state/
│   └── pwa-starter/                       ← Legacy v6 static PWA (still in repo, now redirects)
│       ├── koko-menu-v6.html              ← 1500+ LOC, single-file HTML PWA. Still has the wired Supabase submit_order.
│       ├── manifest.json
│       ├── service-worker.js              ← v1.3.0 (network-first HTML after our fix)
│       ├── icon-*.png                     ← 11 PWA icons
│       └── README-DEPLOY.md
│
├── design-docs/
│   ├── ROADMAP.md
│   ├── system-design.html
│   ├── pos-integration.html
│   ├── pos-universal-integration.html
│   └── tenant-config-example.js
│
├── version-history/                       ← v1-v5 archived HTML for reference
│
├── .scripts/
│   └── extract-koko-images.py             ← One-shot: decoded v6 base64 → real JPEGs
│
├── .obsidian/                             ← Empty marker — makes the project an Obsidian vault
├── .graph/                                ← graphify knowledge-graph output (run via /graphify)
└── .claude/
    └── skills/
        └── menulink-integration/
            ├── SKILL.md                   ← Auto-loaded
            ├── learnings.md               ← Read every session, append every session
            ├── customers/
            │   ├── koko-chicky-licky.md
            │   └── rzrz-restaurant.md
            └── references/
                ├── rzrz-deep-dive.md
                ├── onboarding-playbook.md
                ├── sql-patterns.md
                ├── debugging-playbook.md
                └── adapter-pattern.md
```

---

## ✅ What's Done (by domain)

### Database & RPCs
- 7 migrations applied to Singapore Supabase
- 6 analytics views populated with seed data, observed live in `/admin/customers`
- `submit_order(jsonb)` security-definer RPC (anon-callable from PWA, atomic upsert+insert)
- `get_public_menu(slug)` RPC (anon-callable, returns full menu JSON)
- `get_tenant_owners(uuid)` RPC (platform_admin-only, joins auth.users)
- JWT-claim triggers that auto-set `role` + `restaurant_id` in `raw_app_meta_data`
- Storage bucket `menu-images` with RLS scoped by `restaurant_id` folder prefix
- Supabase Realtime publication includes `orders` (the /admin/orders feed subscribes)

### Customer Experience
- v6 PWA stays in repo, now 302-redirects everywhere via `vercel.json`
- v7 at `/m/[slug]` (Next.js, server-rendered initial paint)
- 2-col image-on-top card grid (3 on tablet, 4 on desktop) matching Stitch "Vibrant Poultry" mockup
- Per-tenant brand colors via runtime CSS variables (`--brand`, `--bg`, `--ink`)
- Cover image hero with darker gradient + bold restaurant name overlaid
- Sticky bottom cart bar with count badge + total + arrow
- Cart drawer with order-type radio, customer form, **Leaflet GPS picker** (explicit button + permission-denied recovery + multi-stage invalidateSize for drawer animation)
- WhatsApp deep-link with Google Maps coordinates included
- PWA install prompt (20s engagement gate, 7-day dismiss cooldown)
- Per-tenant dynamic `manifest.webmanifest` (name, theme color, scope, icon from `logo_url`)
- Custom `not-found.tsx` for invalid/unpublished slugs
- Loading skeleton during initial RSC fetch
- Service worker (network-first HTML, cache-first static assets, never intercepts WhatsApp / Supabase / map tiles)
- Phone normalization (Saudi `+9665XXXXXXXX` from any input format including Arabic-Indic digits)
- Fail-open order persistence — WhatsApp opens even if Supabase is unreachable

### Tenant Admin
- Email+password auth via `@supabase/ssr` cookies
- Subscription banner on every admin page (yellow pending / red overdue / red cancelled)
- `/admin/info` — operational fields only (name read-only, tagline + WhatsApp + email + city + address + social handles + publish toggle). **No design fields visible to tenant.**
- `/admin/menu` — categories + items + variants CRUD. Image upload per item (camera-icon thumbnail). 5 MB cap, jpeg/png/webp.
- `/admin/orders` — last 100 orders, Realtime subscription for INSERT and UPDATE filtered by restaurant_id. Status dropdown updates write back.
- `/admin/customers` — `v_customer_rfm` + `v_customer_ltv` joined. Phone numbers click to WhatsApp.
- `/admin` — dashboard with today's orders count + revenue + RFM segment counts + last 5 orders

### Platform Ops
- Separate auth flow at `/ops/login` (dark theme)
- `/ops` — all tenants table with subscription status pills
- `/ops/tenants/[id]` — drill-in with restaurant info, owners (via `get_tenant_owners` RPC), recent payments, quick actions (publish toggle, cancel subscription). **Design panel here only — name/slug/logo/cover/colors.**
- `/ops/tenants/new` — onboarding wizard (single page, 3 card sections). Server action creates restaurant + auth user + restaurant_owners link + subscription, returns generated password.
- `/ops/payments` — form to log payment. Insert triggers payment-trigger which advances subscription to `active` and extends `current_period_end` by plan duration.

### Marketing
- `/` landing page with Arabic hero, 6 features grid, monthly/yearly pricing cards, WhatsApp CTA

### DevOps
- 2 Vercel projects auto-deploying from `main`
- Service-role key in Vercel encrypted env vars
- Supabase Storage with proper RLS for owner-scoped + ops-bypass uploads
- `apps/web/.env.local` template for local dev

---

## 🎨 Design System Decisions (Locked In)

These were debated and resolved during the build. Don't relitigate without strong reason.

1. **Design belongs to ops, not tenants.** Restaurant owners operate (menu items, hours, WhatsApp number). The platform team (you) sets logos, cover images, brand colors. Owners see colors as read-only chips in `/admin/info` with "للتعديل تواصل مع MenuLink". The actual color/logo editors live in `/ops/tenants/[id]`.
2. **Stitch typography stack:** Tajawal 700–900 for Arabic display, Cairo 400–700 for Arabic body, Plus Jakarta Sans for Latin body, Anybody for Latin display. All loaded via Google Fonts in root layout. `Inter` is banned per DESIGN.md.
3. **2-column image-on-top cards** for the customer PWA (not v6's image-on-side compact list). Confirmed against the Stitch mockup the user provided.
4. **Per-tenant brand colors override Stitch's `#ac0015`.** Default fallback `#ac0015` if a tenant doesn't have one set; KO-KO uses `#D32027`. Background defaults to Stitch's `#fff8f6` if not overridden.
5. **Inverted ops CTAs.** Tenant admin uses brand-red filled buttons. Ops uses white-on-dark inverted buttons. Visually communicates "you are in the platform layer, not the tenant layer."
6. **No "Subscribe / Buy" buttons anywhere.** Payments are manual collection (mada/bank transfer/cash) until ~10 tenants justify a payment gateway. Ops logs payments via `/ops/payments`.
7. **Anon writes go through SECURITY DEFINER RPCs only.** Direct table inserts from `anon` were blocked by RLS conflicts in 0001. After 0003, anon has zero direct table access; everything routes through `submit_order` or `get_public_menu`.

---

## 🐛 Gotchas Accumulated This Build (read learnings.md for full versions)

1. **Supabase first-pull saturates Docker Desktop.** Going forward, prefer cloud Supabase via the Management API for migrations + Vercel for runtime. Avoid `supabase start` unless absolutely needed.
2. **Anon RLS with `cmd=ALL to public` conflicts with separate INSERT policies.** Always scope owner policies to `to authenticated` explicitly. Never use `to public` for cmd=ALL.
3. **Service worker cache-first for HTML is a deploy trap.** Network-first for HTML, cache-first for assets. Bump `VERSION` constant for cache invalidation.
4. **Stitch sometimes proposes Inter / generic serifs / `#000000`.** DESIGN.md §7 bans these explicitly. Override Stitch's choices when they violate.
5. **iOS Safari geolocation needs a user gesture.** Auto-request on mount silently fails. Always have an explicit button.
6. **Leaflet inside a sliding drawer needs multi-stage `invalidateSize()`** (60ms, 280ms, 600ms, 1200ms) + a ResizeObserver fallback.
7. **The new `sb_secret_*` Supabase key is rejected by GoTrue admin endpoints from browser-ish contexts** (including PowerShell `Invoke-RestMethod`). Use the legacy service_role JWT for Auth Admin API calls.
8. **Vercel's `vercel.json` rejects unknown root keys** like `_comment`. Don't add comments in vercel.json — use git commit messages.
9. **MCP Supabase / Vercel servers are bound to whichever account the MCP was set up with**, NOT the account the user references in chat. Bypass via the REST API + their access token.
10. **Supabase JWT claims from `raw_app_meta_data` are nested under `app_metadata`, NOT top-level.** `auth.jwt() ->> 'restaurant_id'` always returns NULL — that broke every authenticated RLS check from 0001 until **0008** fixed it by switching to `auth.uid()` + `restaurant_owners` / `platform_admins` lookups via `public.owns_restaurant(uuid)` and `public.is_platform_admin()` SECURITY DEFINER helpers. **Never write RLS that reads JWT-nested claims as top-level.**
11. **Postgres views default to `security_invoker=false`, which bypasses RLS on underlying tables.** `v_revenue_daily` was leaking cross-tenant data until 0008-era dashboard fix added explicit `.eq("restaurant_id", me.restaurant_id)`. Always scope view queries explicitly, OR add `security_invoker=true` to the view.

---

## 🚀 How To Resume Work (Cold Start)

```powershell
# Open the project
cd D:\menulink

# Read these files in order:
# 1. memory.md (this file) — current state
# 2. CLAUDE.md — auto-loaded for AI sessions
# 3. HANDOFF.md — original strategic brief (mostly historical)
# 4. .claude/skills/menulink-integration/learnings.md — gotchas
# 5. DESIGN.md — design system rules

# Local dev (admin + customer PWA)
cd apps/web
npm install                   # if first time
npm run dev                   # http://localhost:3000

# Sign in as test owner: koko-owner@menulink.test / KokoMenuLink2026!
# Sign in as test ops:   id.menulink@gmail.com / OpsMenuLink2026!

# Apply a new SQL migration to cloud (no Docker required)
# Use the same Management API pattern we used: PowerShell + Invoke-RestMethod
# Endpoint: POST https://api.supabase.com/v1/projects/dhmjrrsynfvomlzhggvu/database/query
# Auth: Bearer <Supabase personal access token, get from supabase.com/dashboard/account/tokens>

# Deploy a code change
git add <files>
git commit -m "..."
git push                      # Vercel auto-deploys both projects
```

---

## 🛤️ What's Next — Three Honest Paths

In rough order of strategic value:

### A. POS Integration · RzRz Bridge App  *(the moat)*
Brother's restaurant is the testbed. Build a .NET tray app that connects MenuLink orders → RzRz `InsertInvoice` stored procedure → kitchen printer queue. After 30-day production trial, sell as 99 SAR/month bundle add-on.
**Sessions:** 4–6 · **Risk:** medium-high (.NET, real POS, brother's production)
**Where to start:** `.claude/skills/menulink-integration/references/rzrz-deep-dive.md` + the customer file at `customers/rzrz-restaurant.md`

### B. Push + Marketing Stack
OneSignal push notifications. Broadcast a coupon to "At-Risk" or "Lost" RFM segments from `/admin/customers`. Auto-push when an order's status changes to "ready". This is what justifies the 59 SAR/month — tenants see real ROI.
**Sessions:** 3 · **Risk:** low-medium

### C. Payment Gateway — Moyasar
Moyasar hosted checkout for the first 499 SAR payment. Webhook flips `subscriptions.status` to active. Auto-charge on renewal. Receipt PDFs. Minimal ZATCA compliance.
**Sessions:** 2–3 · **Risk:** medium (financial flows, real money, mada certification)

---

## ✋ Outstanding Loose Ends

These won't block anything but are worth knowing about:

- The Vercel "GitHub user not found" warning is still showing because git commits are authored by `idxmac@gmail.com` which isn't verified on either the `Adilibrahimit` GitHub or the `id.menulink@gmail.com` Vercel account. Fix: `git config --global user.email "Adilibrahimit@users.noreply.github.com"` then push one new commit. Cosmetic — deploys aren't blocked.
- KO-KO subscription is `pending_payment` in the DB. To activate: sign in as ops → `/ops/payments` → log a 499 SAR payment for KO-KO. Trigger sets `current_period_end` to a year out + status to `active`.
- The 2 waiting tenants the user mentioned earlier haven't been onboarded yet. Use `/ops/tenants/new` when ready.
- The `restaurants.contact_email` for KO-KO is still null (we left it empty per user's instruction "right now make it empty"). Real owner email goes here when known.
- All tokens used during the build (Vercel, Supabase access, Supabase service_role) are in chat history and should be rotated.

---

## 🔑 Key Facts You'll Forget

- KO-KO's restaurant ID: `11111111-1111-1111-1111-111111111111`
- KO-KO's slug: `koko` (was `koko-chicky-licky` before we shortened it during S1)
- Supabase project ref: `dhmjrrsynfvomlzhggvu`
- Vercel team ID: `team_8bF10A0Kkzk8OHxKQSx4YGCt`
- GitHub repo: `github.com/Adilibrahimit/menulink`
- Storage bucket: `menu-images` · path: `<restaurant_id>/<item_id>-<rand>.<ext>` for menu items, `<restaurant_id>/_brand/<logo|cover>-<rand>.<ext>` for brand assets
- The customer PWA is mobile-first; the admin and ops dashboards are tablet+ friendly but workable on mobile
- All Arabic body text uses Cairo, all Arabic display uses Tajawal 800-900
- Customer prices are rendered in Arabic-Indic numerals (٢٤ ر.س). Admin tables use Latin numerals for column alignment.
