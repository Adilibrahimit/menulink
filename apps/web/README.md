# MenuLink · apps/web

Next.js 14 app that serves the entire runtime for MenuLink — four surfaces from one codebase:

| Route prefix | What | Audience |
|---|---|---|
| `/` | Marketing landing | Public — anyone considering MenuLink |
| `/m/[slug]` | Customer PWA (multi-tenant, per-tenant brand) | End customers ordering food |
| `/admin/*` | Tenant owner dashboard | Restaurant owners |
| `/ops/*` | Platform admin | You (the platform operator) |

🆕 **Read [`../../memory.md`](../../memory.md) for the full state, deployed URLs, and credentials.**

## Routes

### Customer PWA (`/m/[slug]`)
| Route | Purpose |
|---|---|
| `/m/koko` | KO-KO's menu (or any tenant slug) |
| `/m/[slug]/manifest.webmanifest` | Per-tenant PWA manifest (dynamic) |

Components: `page.tsx` (server, RPC fetch) → `menu-experience.tsx` (client wrapper, cart state) → `menu-item.tsx` (2-col image-on-top card), `category-tabs.tsx`, `location-picker.tsx` (Leaflet GPS), `pwa-bootstrap.tsx` (SW + install prompt).

### Tenant Admin (`/admin/*`)
| Route | Purpose |
|---|---|
| `/admin/login` | Email + password sign-in (Supabase Auth) |
| `/admin` | Dashboard — stat cards + RFM segment counts + last 5 orders |
| `/admin/orders` | Live orders feed (Supabase Realtime), status dropdowns |
| `/admin/menu` | Categories + items + variant prices + per-item image upload |
| `/admin/customers` | RFM table with segments + WhatsApp deep links |
| `/admin/info` | **Operational** info (name read-only, tagline, WhatsApp, address, social, publish). No design fields. |

### Platform Ops (`/ops/*`)
| Route | Purpose |
|---|---|
| `/ops/login` | Platform admin sign-in (dark theme, separate from /admin) |
| `/ops` | All tenants list with subscription status |
| `/ops/tenants/[id]` | Drill-in: subscription, owners, payments, **design panel** (logo/cover/colors here) |
| `/ops/tenants/new` | Onboarding wizard (creates restaurant + auth user + subscription) |
| `/ops/payments` | Log a received payment → triggers subscription activation |

## Test accounts

| Account | Email | Password |
|---|---|---|
| KO-KO owner | `koko-owner@menulink.test` | `KokoMenuLink2026!` |
| Platform ops | `id.menulink@gmail.com` | `OpsMenuLink2026!` |

Rotate before real production.

## Deployment

Already deployed at `menulink-admin-five.vercel.app` (Vercel project `menulink-admin`, root dir `apps/web`).

Env vars on Vercel:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://dhmjrrsynfvomlzhggvu.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_480WpOtVHhAcDjApm6abBg_0feNGfsJ` (public, safe)
- `SUPABASE_SERVICE_ROLE_KEY` = encrypted legacy JWT (server-only, for the new-tenant wizard)

Auto-deploys on every push to `main` from `github.com/Adilibrahimit/menulink`.

## Local dev

```bash
cd apps/web
npm install
npm run dev    # http://localhost:3000
```

`.env.local` is gitignored but pre-populated with the cloud Supabase URLs so local runs against production data. To run against a local Supabase, install Docker Desktop, then:

```bash
npx supabase start
npx supabase db reset
```

## Architecture

- **Auth:** `@supabase/ssr` cookie-based. `middleware.ts` refreshes the auth cookie on every request to `/admin/*` and `/ops/*` and injects `x-pathname` so server components can read the current path.
- **RLS:** Owner JWT carries `role='restaurant_owner'` + `restaurant_id`. Ops JWT carries `role='platform_admin'`. Triggers in 0005 keep `raw_app_meta_data` synced when `restaurant_owners` or `platform_admins` rows change.
- **Realtime:** `orders` table is in the `supabase_realtime` publication; `/admin/orders` subscribes to INSERT/UPDATE filtered by `restaurant_id`.
- **Multi-tenant safety:** zero `service_role` on the client. All anon writes go through `submit_order` SECURITY DEFINER RPC. All owner writes go through RLS-scoped session client. The service-role client (`lib/supabase-admin.ts`) is server-only, used inside the new-tenant wizard's server action.
- **Images:** Supabase Storage bucket `menu-images`. Owner uploads to `<restaurant_id>/<item_id>-<rand>.<ext>`. Ops uploads to `<restaurant_id>/_brand/<logo|cover>-<rand>.<ext>`.
- **Customer PWA brand colors:** server-rendered as inline CSS variables (`--brand`, `--bg`) from `get_public_menu(slug)` — no flash of wrong color.

## Database

7 migrations in `apps/web/supabase/migrations/`. All applied to cloud as of 2026-05-19.

| Migration | Summary |
|---|---|
| `0001_init.sql` | Core tables + RLS |
| `0002_analytics_views.sql` | 6 RFM/LTV/dormancy/top-items views |
| `0003_submit_order_rpc.sql` | SECURITY DEFINER RPC + RLS rewrite (owner→authenticated) |
| `0004_multi_tenant_menu.sql` | menu_categories/items/variants + restaurant_owners + `get_public_menu(slug)` |
| `0005_subscriptions_ops.sql` | subscriptions + payments + platform_admins + JWT-claim triggers + payment-activates-subscription trigger |
| `0006_ops_helpers.sql` | `get_tenant_owners(uuid)` for ops drill-in |
| `0007_menu_images_storage.sql` | `menu-images` bucket + RLS |

## What's NOT here yet (next sessions)

- **POS Integration** — RzRz Bridge App, Foodics OAuth. Folder reserved at `apps/bridge/` (doesn't exist yet).
- **OneSignal push** — broadcast to RFM segments from `/admin/customers`.
- **Moyasar payment gateway** — currently manual collection via `/ops/payments`.
- **Self-service tenant signup** — currently ops-only onboarding via `/ops/tenants/new`.
- **Custom domain routing** — `koko.menulink.app` would need wildcard DNS + Vercel domain config.
