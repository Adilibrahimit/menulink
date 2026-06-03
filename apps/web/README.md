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
| `/m/koko` | KO-KO's menu (first paying customer) |
| `/m/rzrz-bukhari` | RzRz Bukhari (POS integration testbed) |
| `/m/[slug]/manifest.webmanifest` | Per-tenant PWA manifest (dynamic) |
| `/m/[slug]/account` | Google OAuth login + loyalty + order history |
| `/m/[slug]/rewards` | Loyalty rewards redemption |

Components: `page.tsx` (server, RPC fetch) → `menu-experience.tsx` (client wrapper, cart state, push toggle) → `menu-item.tsx` (2-col image-on-top card), `category-tabs.tsx`, `location-picker.tsx` (Leaflet GPS), `pwa-bootstrap.tsx` (SW + install prompt), `item-customizer-sheet.tsx` (modifiers/add-ons), `cart-drawer.tsx` (order submit + WhatsApp), `table-session-bar.tsx` (open tabs for dine-in), `push-toggle.tsx` (🔔/🔕 notification bell).

### Tenant Admin (`/admin/*`)
| Route | Purpose |
|---|---|
| `/admin/login` | Email + password sign-in (Supabase Auth) |
| `/admin` | Dashboard — stat cards + RFM segments + last 5 orders + Chart.js charts |
| `/admin/orders` | Live orders feed (Realtime) + expandable item details + doorbell alert |
| `/admin/menu` | Categories + items + variants CRUD + reorder ▲/▼ + modifiers + nutrition + images |
| `/admin/customers` | RFM table with segments + KPI cards + search + export |
| `/admin/tables` | Table management + per-table QR poster download |
| `/admin/qr` | Menu-wide QR poster with brand colors + logo |
| `/admin/broadcast` | Push notification composer + segment targeting + send history |
| `/admin/loyalty` | Loyalty program settings + rewards CRUD + redemptions queue + stats |
| `/admin/loyalty/customers` | Top 200 loyalty members + manual point adjustment |
| `/admin/info` | Operational info (tagline, WhatsApp, address, social, publish toggle) |

### Platform Ops (`/ops/*`)
| Route | Purpose |
|---|---|
| `/ops/login` | Platform admin sign-in (dark theme) |
| `/ops` | All tenants list with subscription status |
| `/ops/tenants/[id]` | Drill-in: subscription, owners, payments, design panel, addons |
| `/ops/tenants/new` | Onboarding wizard (creates restaurant + auth user + subscription) |
| `/ops/payments` | Log a received payment → triggers subscription activation |

## Accounts

| Account | Email | Password | Notes |
|---|---|---|---|
| KO-KO owner | `id.koko.owner@gmail.com` | `Koko2026!` | PRODUCTION — first paying customer |
| RzRz owner | `rzrzbukhari@gmail.com` | `RzRz2026Temp!` | Integration testbed |
| Platform ops | `id.menulink@gmail.com` | `OpsMenuLink2026!` | |

## Deployment

Live at `menulink-admin-five.vercel.app` (Vercel project `menulink-admin`, root dir `apps/web`).

Env vars on Vercel:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase Cloud Singapore
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, safe
- `SUPABASE_SERVICE_ROLE_KEY` — encrypted legacy JWT (server-only)
- `NEXT_PUBLIC_VAPID_KEY` — Web Push public key
- `VAPID_PRIVATE_KEY` — Web Push private key (encrypted)
- `VAPID_EMAIL` — `mailto:id.menulink@gmail.com`

Auto-deploys on every push to `main` from `github.com/Adilibrahimit/menulink`.

## Local dev

```bash
cd apps/web
npm install
npm run dev    # http://localhost:3000
```

`.env.local` is gitignored but pre-populated with cloud Supabase URLs + VAPID keys.

## Architecture

- **Auth:** `@supabase/ssr` cookie-based. `middleware.ts` refreshes the auth cookie and injects `x-pathname`.
- **RLS:** `owns_restaurant(uuid)` + `is_platform_admin()` SECURITY DEFINER helpers (0008+). All policies use `auth.uid()` lookups, NOT JWT claims.
- **Realtime:** `orders` + `table_sessions` + `loyalty_redemptions` in `supabase_realtime` publication.
- **Multi-tenant safety:** zero `service_role` on the client. Anon writes via `submit_order` RPC. Owner writes via RLS-scoped session client.
- **Images:** Supabase Storage bucket `menu-images`. Path: `<restaurant_id>/<item_id>-<rand>.<ext>`.
- **Customer PWA brand colors:** inline CSS variables from `get_public_menu(slug)`.
- **Push notifications:** Web Push API + `web-push` library. Bell toggle in header, VAPID-based, FCM delivery.
- **Table sessions:** Open tabs for dine-in — multi-round orders linked by `session_id`, 8hr auto-expire.

## Database

71 migrations in `apps/web/supabase/migrations/` (0001–0071). All applied to cloud.

Key tables (26 total): `restaurants`, `menu_categories`, `menu_items`, `menu_item_variants`, `customers`, `orders`, `order_items`, `subscriptions`, `payments`, `push_subscriptions`, `push_broadcasts`, `table_sessions`, `restaurant_tables`, `loyalty_settings`, `loyalty_rewards`, `loyalty_transactions`, `loyalty_redemptions`, `addon_catalog`, `subscription_addons`, `pos_outbox`, `pos_item_map`, `pos_settings`, `restaurant_owners`, `platform_admins`, `customer_addresses`, `customer_tags`.

Key RPCs: `submit_order`, `get_public_menu`, `open_table_session`, `get_table_session`, `request_table_checkout`, `link_customer_account`, `redeem_reward`, `mark_arrived`.

## What's NOT done yet

- **Push delivery issue** — subscription saves to DB, server sends to FCM (201 success), but notifications don't arrive on device. Likely service worker push handler issue. Needs debugging.
- **Payment gateway (Moyasar)** — currently manual collection via `/ops/payments`.
- **Samer's .NET workflow patch** — re-enable per-type InvoiceType mapping.
- **Custom domain routing** — `koko.menulink.app` needs wildcard DNS + Vercel config.
