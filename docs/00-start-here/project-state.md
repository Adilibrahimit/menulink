# Project State — snapshot router

> This is a stable, high-level snapshot. The **live, detailed** state (current URLs, what shipped last, gotchas, next steps) lives in [`/memory.md`](../../memory.md) — always defer to it.

## What MenuLink is
Arabic-first SaaS for Saudi restaurants: digital menus + WhatsApp ordering + customer analytics + tenant admin. Pricing **59 SAR/month** or **499 SAR/year** (canonical: [`/PRICING.md`](../../PRICING.md)).

## Two layers
- **Core (mandatory, ships standalone)** — `apps/web/` (Next.js 14) + Supabase migrations. Surfaces: marketing landing, customer PWA (`/m/[slug]`), tenant admin (`/admin`), platform ops (`/ops`). Hosted on Vercel + Supabase. **Core works with POS disabled.**
- **Optional POS layer** — `bridge-app/` (.NET Bridge) + `services/whatsapp-invoice-gateway/` (Cloudflare Worker + D1) + the admin POS surface. Integrates with Punnelifosys ResApp (RzRz) over a transactional-outbox/queue seam. Drop it and Core still ships. Docs: [`../pos/`](../pos/).

## The seam (only Core↔POS contact)
- `migrations/0009_*` — `enqueue_pos_outbox()` AFTER INSERT trigger (self-disables when POS off)
- `migrations/0072_*` — `digital_invoice_send_queue` + service_role RPCs the Bridge polls
- `apps/web/app/api/bridge/heartbeat` + `/invoice-status` — inbound Bridge calls

## Customers (dossiers in `.claude/skills/menulink-integration/customers/` + `docs/clients/`)
KO-KO Chicky Licky (first paying), RzRz (POS test/integration partner), Mazaj Almosafer (menu-only), and others — see `/memory.md` for the current roster and status.

## Active workstream
Background WhatsApp digital-invoice → see [`../pos/digital-invoice-background/STATUS.md`](../pos/digital-invoice-background/STATUS.md).

## Repo cleanup status (this effort)
Phased knowledge-architecture cleanup on branch `chore/repo-cleanup-phase-1`. See `/memory.md` and commit history for the current phase. Secrets staged for handling live under the gitignored `secrets-quarantine/` (never committed); credential **rotation** is a separate manual task — see [`../security/credential-rotation-plan.md`](../security/credential-rotation-plan.md) once created.
