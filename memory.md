# MenuLink · Project Memory

> **Read this first** when picking up the project in a new session.
> Last saved: **2026-05-23** — Bridge App v2.7 live, RzRz menu fully imported (56 variants + photos), admin Tier-2 Excel + persistent order alerts shipped.
> Status line: **production SaaS, 5 tenants. RzRz Bukhari fully live (POS bridge + menu + photos + owner login). Admin orders page has Web-Audio doorbell + today filter + Excel export. Customers page has color-coded RFM KPI cards + search/sort + Excel export. Next: car-curbside order_type + loyalty service + Samer's .NET workflow patch.**

---

## 30-Second TL;DR

MenuLink is a multi-tenant Arabic SaaS for Saudi restaurants. Three surfaces live, all on Vercel + Supabase. **Four tenants** onboarded as of 2026-05-19 — KO-KO + three others (all three paid, KO-KO subscription still pending).

- **Customer PWA** at `/m/<slug>` (KO-KO is `/m/koko`) — customers order food, message goes to WhatsApp, order persists to Supabase.
- **Tenant Admin** at `/admin/*` — restaurant owners edit menu, see realtime orders, manage customers, **upload their own logo + cover**, watch a 14-day revenue / orders chart on the dashboard.
- **Platform Ops** at `/ops/*` — you (the platform operator) manage all tenants, onboard new ones, log payments. Logo/cover are also editable here as an override.

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

### Schema (8 migrations applied)

| Migration | What it does |
|---|---|
| `0001_init.sql` | Core: restaurants, customers, orders, order_items, customer_tags, push_subscriptions. RLS on every table. |
| `0002_analytics_views.sql` | 6 views: `v_customer_rfm`, `v_customer_ltv`, `v_dormant_customers`, `v_top_items_per_customer`, `v_top_items_per_restaurant`, `v_revenue_daily` |
| `0003_submit_order_rpc.sql` | RLS rewrite (owner policies scoped to `authenticated`, not `public`) + `submit_order(jsonb)` SECURITY DEFINER RPC. Anon writes go through the RPC, never direct table inserts. |
| `0004_multi_tenant_menu.sql` | menu_categories, menu_items, menu_item_variants, restaurant_owners. Expands restaurants with address/hours/colors/is_published. `get_public_menu(slug)` RPC. |
| `0005_subscriptions_ops.sql` | subscriptions, payments, platform_admins + JWT-claim triggers that write `role` + `restaurant_id` into `raw_app_meta_data`. Payment-insert trigger advances subscription to active. Subscription-overdue trigger auto-unpublishes restaurant. |
| `0006_ops_helpers.sql` | `get_tenant_owners(uuid)` RPC so ops can see owner emails without direct `auth.users` access. |
| `0007_menu_images_storage.sql` | Public `menu-images` Storage bucket (5 MB cap, jpeg/png/webp). RLS scoped to `<restaurant_id>/` path. |
| `0008_fix_rls_and_columns.sql` | **Replaces every JWT-claim-based policy** (broken since 0001 — Supabase nests `app_metadata` claims) with `auth.uid()` + lookup-table policies via `public.owns_restaurant(uuid)` and `public.is_platform_admin()` SECURITY DEFINER helpers. Adds `platform_admin` ops policies on every table (the missing INSERT on `restaurants` was blocking the onboarding wizard). Adds `menu_categories.name_en`, `menu_items.name_en`, `menu_items.description_en`. Rewrites storage RLS with the same auth.uid lookup pattern. |

All migrations live in `apps/web/supabase/migrations/`. Apply locally via `npx supabase db reset` or push to cloud via `supabase db push` (we used the Management API directly in this build).

### Seed + production data
- **4 restaurants** onboarded — KO-KO (`koko`) + 3 others added on 2026-05-19 via `/ops/tenants/new`
- 20 fake customers across all 5 RFM segments (KO-KO only)
- ~80 fake orders across last 90 days (KO-KO only)
- 7 categories, 33 menu items (1 owner-added appetizer + 32 seed), 46+ price variants (real KO-KO menu)
- 4 subscription rows — 3 active (the new tenants have already paid), KO-KO still `pending_payment` (no payment logged yet)

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
│       │   │   ├── page.tsx               ← Dashboard (stat cards + RFM + recent orders + charts)
│       │   │   ├── dashboard-chart.tsx    ← Chart.js (Line revenue + Bar orders, 14-day)
│       │   │   ├── info/                  ← Operational info + owner logo + cover upload
│       │   │   ├── menu/                  ← Menu CRUD with image upload
│       │   │   │   ├── menu-editor.tsx    ← Wraps modals; per-category & per-item controls
│       │   │   │   ├── add-item-modal.tsx ← Simple form: Category > AR name > Price > Photo
│       │   │   │   └── add-category-modal.tsx
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
│               ├── 0007_menu_images_storage.sql
│               └── 0008_fix_rls_and_columns.sql
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
- 8 migrations applied to Singapore Supabase
- 6 analytics views populated with seed data, observed live in `/admin/customers`
- `submit_order(jsonb)` security-definer RPC (anon-callable from PWA, atomic upsert+insert)
- `get_public_menu(slug)` RPC (anon-callable, returns full menu JSON)
- `get_tenant_owners(uuid)` RPC (platform_admin-only, joins auth.users)
- **`is_platform_admin()` + `owns_restaurant(uuid)` + `owns_restaurant_text(text)`** SECURITY DEFINER helpers — every RLS policy uses these now (since 0008)
- JWT-claim triggers that auto-set `role` + `restaurant_id` in `raw_app_meta_data` (kept for `requireOwner`/`requireOps` in Next.js — RLS no longer reads them)
- Storage bucket `menu-images` with RLS scoped by `restaurant_id` folder prefix via `owns_restaurant_text`
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
- `/admin/info` — operational fields (name read-only, tagline + WhatsApp + email + city + address + social handles + publish toggle) **plus owner-managed logo + cover image uploads** (added 2026-05-19). Colors stay ops-only with a "تواصل مع MenuLink" note.
- `/admin/menu` — categories + items + variants CRUD. **Simplified add-item modal** (Category → Arabic name → Price → Photo, with English name + description tucked behind "Show advanced"). `name_en` / `description_en` columns persist for future bilingual rendering. 5 MB cap, jpeg/png/webp.
- `/admin/orders` — last 100 orders, Realtime subscription for INSERT and UPDATE filtered by restaurant_id. Status dropdown updates write back.
- `/admin/customers` — `v_customer_rfm` + `v_customer_ltv` joined. Phone numbers click to WhatsApp.
- `/admin` — dashboard with today's orders count + revenue + RFM segment counts + last 5 orders + **Chart.js charts** (14-day revenue line + 14-day orders bar) — `react-chartjs-2 ^5.2.0` + `chart.js ^4.4.4`.

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

1. **Design ownership is split (updated 2026-05-19).** Tenants own their **logo** and **cover image** — they upload from `/admin/info` (a restaurant's identity shouldn't be gated by ops availability). Ops still owns **brand colors**, **slug**, **name**, layout, typography. Owners see colors as read-only chips in `/admin/info` with "للتعديل تواصل مع MenuLink". Ops can override logo/cover from `/ops/tenants/[id]` when needed.
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

## 🔌 RzRz POS Integration — Phase 1 Results (2026-05-20)

**Restaurant:** RZRZ BUKHARI / رزرز بخاري · Company: Itaqn w Jowdah (إتقان وجودة) · 2 branches (Alazizah, Almalaz).

**Strategic context:** the user is Samer Cefalu's BUSINESS PARTNER in the POS software venture (Punnelifosys ResApp / RzRz POS). Schema changes + proc modifications are on the table. Co-branded "RzRz POS + MenuLink" rollout to all Punnelifosys customers is the endgame, achievable in months not years.

**Almalaz branch infra:**
- Server: `DESKTOP-8Q7DQKA` (LAN `PUNNELIFOSYS`), LAN IP `192.168.1.113`
- SQL Server 2022 Express, **DB name `client`** (not `samer910_Cefalu` — that was a stale config). Integrated Security + sa both available.
- Accounting DB: `samer910_accreef` (local + synced to central `192.250.231.22`)
- Kitchen printers (LAN): KETCHIN `192.168.1.177` (master), BBQ `192.168.1.175`, DESERT `192.168.1.179`, KABULE `192.168.1.181`. **Note typo in DB: printer name is `KETCHIN` not `KITCHEN`** — Windows printer must use the typo.

**What was proven (full chain):**
1. Inserted MenuLink as `OnlineCustomerID = 999, CommissionPercent = 0.00`
2. The new MenuLink row shows up in the cashier UI's Online customer picker alongside HungerStation/Jahez/Keeta
3. Cashier can manually create + pay a MenuLink order — works end to end with kitchen print
4. Direct `EXEC InsertInvoice` from SQL produces identical DB state — same `InvoiceType=11`, same `OnlineCommission=0.00`, same `InvoiceDetails` rows, same `KitichenOrderForPrint` rows
5. Held → Finalize transition works via re-EXEC with same InvoiceID + IsHold=0
6. Kitchen printers fire correctly when the Windows printer name is `KETCHIN` (the typo)
7. Print routing is fully data-driven via `ItemPrinters(ItemID, Printer, InvoiceTypeID)` — the Bridge App doesn't need to implement print routing, just write `InvoiceDetails` + `KitichenOrderForPrint`

**Verified XML structure for InsertInvoice** (see `.claude/skills/menulink-integration/references/sql-patterns.md` for full reference): single self-closing `<Invoice ... />` for header, multiple sibling `<Items ... />` elements (NO outer wrapper) for line items.

**Phase 2 (Bridge App) — in progress:**
- `pos_outbox` + `pos_item_map` tables in Supabase (migration 0009, TBD)
- .NET 10 Windows Service running on the cashier (primary) and server (monitor)
- Realtime subscription primary + polling fallback
- Multi-branch deployment via per-branch `appsettings.json`

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
- **KO-KO subscription is still `pending_payment` in the DB.** The 3 tenants onboarded on 2026-05-19 have all paid (subscriptions active). To activate KO-KO: sign in as ops → `/ops/payments` → log a 499 SAR payment for KO-KO. Trigger sets `current_period_end` to a year out + status to `active`.
- The `restaurants.contact_email` for KO-KO is still null (we left it empty per user's instruction "right now make it empty"). Real owner email goes here when known.
- All tokens used during the build (Vercel, Supabase access, Supabase service_role, and the temporary Supabase PAT used to apply 0008 on 2026-05-19) are in chat history and should be rotated. The PAT used for 0008 was already flagged for rotation when applied — confirm it's revoked at https://supabase.com/dashboard/account/tokens.
- `react-chartjs-2` semver moved to ^5.3.1 and `chart.js` to ^4.5.1 after `npm install` (initial package.json wrote ^5.2.0 / ^4.4.4 — npm chose newer compatible versions). Lockfile committed; nothing to do.

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

---

## 📍 What changed on 2026-05-23 (since the last memory.md save)

### Migrations applied
- `0010_pos_outbox_deferred_trigger.sql` — committed to git (was already applied to Supabase from the prior session; now in the migration history)
- `0012_pos_invoice_type_map.sql` — `pos_settings.invoice_type_map jsonb` column, extended `build_pos_outbox_payload` to snapshot per-order POS settings into the outbox payload
- `0013_variant_key_extended.sql` — adds `full / half / quarter / small / medium / large / kilo / half_kilo` to `menu_item_variants.variant_key` CHECK constraint (was just `single / piece / meal`)

### Bridge App shipped
- v2.3 — HoldMode default true (orders land as held drafts, staff review + pay manually)
- v2.4 — InvoiceNotes_A shortened to fit thermal-printer width (one line, no overflow)
- v2.5 — reads InvoiceType / OnlineCustomerId / CounterId / SectionId from `payload.pos` snapshot (per-tenant)
- v2.6 — Arabic order_type label in InvoiceNotes English field (later proven to be stripped by cashier UI)
- v2.7 — order_type label moved to InvoiceNotes_A as a prefix (durable through cashier UI edits)
- **Live config on RzRz Bukhari:** `online_customer_id=0`, `invoice_type=1` (Dine-In as neutral default — the per-type map is parked at `{}` because changing types in the cashier UI triggers a workflow popup-loop. The bridge infrastructure for per-type icons is in place; flip the map back on once Samer modifies the .NET cashier UI to skip the workflow for bridge-originated invoices.

### RzRz Bukhari menu fully imported
- **8 categories** (Grilled, Charcoal, Madghoot, Kabsa, BBQ Kebab, Rice, Mezze, Sweets)
- **36 menu items** + **56 variants** + **56 pos_item_map** rows
- **32 food photos** uploaded to Supabase Storage at `menu-images/ef60381c-…/menu/<filename>`
- All pos_ids verified against live RzRz `Items` table dump (the user-prepped JSON had ~30 wrong pos_ids; cross-referenced by Arabic name)

### RzRz Bukhari owner can now log in
- Email: `rzrzbukhari@gmail.com`
- Password: `RzRz2026Temp!` (must change after first login)
- URL: `https://menulink-admin-five.vercel.app/admin/login`
- Password was set via `UPDATE auth.users SET encrypted_password = crypt('…', gen_salt('bf'))` directly through the Supabase Management API SQL endpoint (the bcrypt escape hatch)

### KO-KO photo audit
- 12 menu photos replaced (sources: Pexels + Unsplash, both CC0) — old v6 base64 dump had filenames that didn't match content (drumstick photo labeled "tender_spicy", Caesar wrap labeled "twister_maple", herbs labeled "sauce_cheese", etc.)
- 2 new dedicated sauce files added (sauce_garlic, sauce_hummus)
- KO-KO brand untouched: color `#D32027`, logo, cover, all menu data unchanged

### Customer PWA polish
- Sticky category bar made VISIBLY sticky — was already `sticky top-0` but the background was the same color as the page, so it looked like it wasn't sticking. Now uses solid bg + soft shadow. Applies to all tenants (`/m/<any-slug>`).

### Admin dashboard upgrades
- `/admin/orders` — Web Audio doorbell (loops every 1.8s, click "Stop bell" to silence), today-only filter (default ON, Asia/Riyadh), tab title shows `(N) 🔔` when unseen orders queue, Excel export button
- `/admin/customers` — top-line KPI cards (total customers / total revenue / avg per customer), 5 color-coded segment KPIs (⭐ Champions / 💚 Loyal / 🆕 New / ⚠ At-Risk / 🚨 Lost), search bar (name OR phone digits), 7-option sort dropdown, segment filter, Excel export button

### Tier-2 Excel exports
- Added `exceljs` dependency (TypeScript equivalent of Python+openpyxl)
- Shared `apps/web/lib/excel-tier2.ts` — palette + KPI card pattern + branded header + data-bar helpers
- `GET /api/admin/export/orders?from=YYYY-MM-DD&to=YYYY-MM-DD` — Dashboard (12 KPIs) + Detail (full orders with `=SUM/=COUNTIF/=AVG` formulas + data bars) + Summary (by-type / by-status pivots)
- `GET /api/admin/export/customers` — Dashboard (segment KPIs) + Detail (RFM + LTV table with color-coded segment cells + data bars on LTV) + Segments sheet (distribution + suggested action per segment)
- Forest-green Tier-2 palette, Aptos Narrow font, RTL Arabic sheet view, SAR currency formats, formula-first (zero hardcoded computed values)

### Pinned for next session
- **Car-curbside order_type** — schema migration 0013 plan documented in skill memory (task #2). Add `'car'` to `orders.order_type` CHECK + `car_plate` / `car_color` / `car_arrived_at` columns. Customer PWA gets 4th order-type option with license-plate + color fields. Restaurant gets a Realtime "I'm here" notification when customer arrives.
- **Loyalty service** — full architecture brief from this session: per-tenant addon framework (`addon_catalog` + `subscription_addons` with price overrides + trial period), `loyalty_settings` + `loyalty_rewards` per tenant, hybrid tier basis (orders OR spend, whichever is higher), color-coded customer PWA badges, optional Google login that links to the existing phone-keyed customer record. Marked as ~14 hours of work across 3-4 sessions.
- **Samer .NET workflow patch** — the only thing blocking re-enable of per-type InvoiceType. When Samer modifies the cashier UI to skip the driver/customer dispatch workflow on bridge-originated invoices, flip `pos_settings.invoice_type_map` back to `{"delivery":3,"dine_in":1,"pickup":0,"car":10}` and the printer icons differentiate by order type automatically.
