# AI Reading Order — route by task type

> First file any agent should open. Pick the row that matches the task, read those sources **in order**, then act.
> Live state always wins: [`/memory.md`](../../memory.md) is the de-facto "read first" for current URLs, credentials-pointers, and what shipped.

## Always (any task)
1. [`/README.md`](../../README.md) — front door + URLs
2. [`/memory.md`](../../memory.md) — live state, decisions, gotchas (read first)
3. [`/CLAUDE.md`](../../CLAUDE.md) — project rules + "where to find what"
4. [`decision-map.md`](./decision-map.md) — settled decisions + Core↔POS boundary + do-not-touch

## General MenuLink **Core** task (menu, admin, ops, PWA, addons, schema)
- [`/PRICING.md`](../../PRICING.md) (canonical 59/499) · [`/DESIGN.md`](../../DESIGN.md)
- [`../strategy/ROADMAP.md`](../strategy/ROADMAP.md)
- [`../architecture/system-design.html`](../architecture/system-design.html) · [`../architecture/auth-rls-bridge-trace.md`](../architecture/auth-rls-bridge-trace.md)
- Runtime: `apps/web/` — `lib/addons.ts` (feature gating), `app/m/[slug]/` `app/admin/` `app/ops/`, `supabase/migrations/` (immutable, ordered)

## **POS / RzRz / Punnelifosys / digital-invoice** task (the OPTIONAL layer)
- [`../pos/`](../pos/) hub:
  - `digital-invoice-background/ARCHITECTURE.md` → `STATUS.md` → `GO_LIVE_RUNBOOK.md` → `ROLLBACK.md`
  - `digital-invoice-background/FOR-SAMER-*` (vendor-facing specs)
  - `whatsapp-cloud-api-onboarding.md` · `whatsapp-invoice-send-design.md`
  - `ai_memory/RZRZ_*` (POS knowledge store)
- `bridge-app/README.md` (.NET Bridge) · `services/whatsapp-invoice-gateway/` (Cloudflare Worker + D1)
- Seam migrations: `apps/web/supabase/migrations/0009_*` (pos_outbox trigger) + `0072_*` (digital_invoice_send_queue)
- Skill: [`/.claude/skills/menulink-integration/learnings.md`](../../.claude/skills/menulink-integration/learnings.md) — **read before any customer/POS work**
- Deep POS app knowledge: the `.claude/skills/punnelifosys-*` skills (gitignored / local-only — carry dev creds, do not commit)

## **Customer-specific** task (a named restaurant)
- `docs/clients-menu/<client>/` — menus, photos, posters, mappings
- [`/.claude/skills/menulink-integration/customers/<client>.md`](../../.claude/skills/menulink-integration/customers/) — canonical dossier (KO-KO, RzRz, Mazaj Almosafer, …)

## **Code navigation** / "where is X implemented"
- [`/.graph/GRAPH_REPORT.md`](../../.graph/GRAPH_REPORT.md) — graphify knowledge-graph report (communities, key files)

## Design / print / motion task
- [`../design-print-studio/00_README.md`](../design-print-studio/00_README.md) (DS-1..DS-8 spec)
- [`../proofs/`](../proofs/) — DS-* / BG-* / feature proof logs (point-in-time evidence)

## Pricing rule
`PRICING.md` is canonical (**59/month, 499/year**). Any other figures in older docs (e.g. 99/199/399 in ROADMAP) are **historical** — do not treat as current.
