# Decision Map — settled choices, boundaries, do-not-touch

> Read before proposing architectural changes. These are decided; don't re-litigate.

## Settled tech decisions
- **Frontend:** Next.js 14 + Tailwind + shadcn/ui. **Backend:** Supabase (no custom server). **Hosting:** Vercel.
- **Auth:** OTP via SMS (Supabase Auth + Unifonic). **Push:** OneSignal. **Maps:** Leaflet + OpenStreetMap.
- **Pricing:** 59 SAR/month or 499 SAR/year — `PRICING.md` is the single source of truth.
- **Feature gating:** the addon framework (`apps/web/lib/addons.ts`) makes POS and other features optional (`pos_bridge`, delivery zones, notification center).

## Core ↔ POS boundary (keep it clean)
- **Core never imports/calls POS code; POS never imports Core code.** Dependency direction is `POS → Core` over HTTP RPCs.
- POS integration is a **transactional outbox/queue**: `migrations/0009` (trigger, self-disables when POS off) + `migrations/0072` (send queue + service_role RPCs) + the two `app/api/bridge/*` routes.
- Naming trap: `rzrz` in `rzrz-signature-menu.tsx` / `print-design.ts` is a **menu design theme**, NOT the POS. Do not classify it as POS.

## Do-not-touch / invariants
- `apps/web/supabase/migrations/` — **immutable, ordered** (POS interleaved: 0009/0010/0012/0043/0053/0055/0072). Never rename/reorder/move/edit except a genuine runtime bugfix.
- `apps/web/` is the Vercel deploy root → never move it or any `app/**` route dir.
- `bridge-app/` (.sln/.csproj) + `services/whatsapp-invoice-gateway/` (wrangler/D1) — relative paths; don't move.
- `vercel.json` (redirects), `CLAUDE.md` (root, exact name), `memory.md` (root filename; contents may be split/scrubbed).
- `graphify-out` junction + `.graphify_python` — leave intact.

## Where secrets live (and don't)
- Real runtime secrets stay in **gitignored** files only: `apps/web/.env.local`, `services/whatsapp-invoice-gateway/.dev.vars`, `bridge-app/src/MenuLink.BridgeApp/appsettings.Local.json`. Never commit them.
- `secrets-quarantine/` (gitignored) is a staging area for moved-out secret/junk files — never committed, retain until rotation is done.
- Known dev creds documented in skill prose are placeholdered/redacted in tracked docs; the runnable `punnelifosys-*` operate scripts are gitignored (local-only) because redaction would break them.
- Credential **rotation** is a manual, out-of-repo task: [`../security/credential-rotation-plan.md`](../security/credential-rotation-plan.md).

## Product rules (decided)
- menu-only mode = OPS-only (owner can't self-enable). Delivery zones + notification center = paid addons.
- Don't build a feature before 3 real customers ask. Prefer managed services over custom infra. Arabic-first, RTL-first, mobile-first.
