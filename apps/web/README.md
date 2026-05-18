# MenuLink · Admin (apps/web)

Multi-tenant restaurant admin dashboard. Restaurant owners sign in at `/admin/login` and manage menu, info, orders, and customers for their own tenant. RLS scopes everything by `restaurant_id` from the JWT.

## Routes (built in S3-S5)

| Route | Purpose |
|---|---|
| `/admin/login` | Email + password sign-in (Supabase Auth) |
| `/admin` | Dashboard — stat cards + RFM segments + last 5 orders |
| `/admin/orders` | Live orders feed (Supabase Realtime), status updates |
| `/admin/menu` | Categories + items + variant prices CRUD |
| `/admin/customers` | RFM table with segments + WhatsApp links |
| `/admin/info` | Restaurant info form (name, address, hours, brand colors, publish toggle) |

## Test owner

A test account is already linked to KO-KO:

- **Email:** `koko-owner@menulink.test`
- **Password:** `KokoMenuLink2026!`

Rotate the password before production by signing in and changing it, or delete and re-create the user.

## Deploy to Vercel (second project)

The existing `menulink-eight.vercel.app` project deploys the static PWA from `current-state/pwa-starter/`. The admin lives in a **separate** Vercel project that builds Next.js from `apps/web/`.

1. In the Vercel dashboard: **Add New Project** → import the same `Adilibrahimit/menulink` repo.
2. Vercel detects multiple projects — pick the second one. Settings:
   - **Project name:** `menulink-admin` (becomes `menulink-admin.vercel.app`)
   - **Framework Preset:** Next.js (auto-detect)
   - **Root Directory:** `apps/web`
   - **Build/Install/Output:** leave defaults
3. **Environment Variables** (add to Production + Preview + Development):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://dhmjrrsynfvomlzhggvu.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_480WpOtVHhAcDjApm6abBg_0feNGfsJ`
4. Deploy. After ~1 min, sign in at `https://menulink-admin.vercel.app/admin/login`.

## Local dev

```bash
cd apps/web
npm install
npm run dev    # http://localhost:3000/admin/login
```

`.env.local` is gitignored but already populated with the local-Supabase defaults. For working against cloud, edit `.env.local` to point at the cloud URL + anon key (same as the Vercel env vars above).

## Architecture

- **Auth**: `@supabase/ssr` cookie-based auth. `middleware.ts` refreshes the cookie on every request to `/admin/*` and `/ops/*`.
- **RLS**: Owner JWT carries `role='restaurant_owner'` + `restaurant_id`. All queries auto-scope.
- **Realtime**: `orders` table is in `supabase_realtime` publication; the orders page subscribes to INSERT/UPDATE filtered by restaurant_id.
- **Multi-tenant safe**: zero `service_role` usage on the client. All writes go through the user's authenticated session with RLS enforcement.

## What's NOT here yet (deferred)

- `/ops/*` — platform admin (S6)
- Self-service tenant signup
- Image upload (Supabase Storage)
- Payment gateway integration (Moyasar/HyperPay)
- OneSignal push notifications
- Per-tenant custom domain routing
