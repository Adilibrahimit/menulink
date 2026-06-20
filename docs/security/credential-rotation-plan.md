# Credential Rotation Plan

> **Labels only — no secret values appear in this file (by design).**
> Rotation is a **manual, out-of-repo** task (dashboards / servers). Redacting tracked docs and
> gitignoring secret files does **not** invalidate already-shared or in-history secrets — only
> rotation does. Work top-down by blast radius.

## Status legend
`☐ pending` · `☑ done (date)`

## P0 — highest blast radius
| ☐ | Label | Where it lives now | Rotate via | Notes |
|---|-------|--------------------|------------|-------|
| ☐ | `<SUPABASE_SERVICE_ROLE>` | `apps/web/.env.local` (gitignored) | Supabase dashboard → Project → API → roll `service_role` | Full RLS bypass. Update `.env.local` + Vercel env after roll. |
| ☐ | `<META_WHATSAPP_TOKEN>` | DPAPI on dev box; copy was in quarantined `docs/pormpts/*` (now in `secrets-quarantine/`) | Meta App dashboard → System User → revoke + mint new permanent token | Re-store via Bridge `store-token`. |
| ☐ | `<OWNER_TEST_PASSWORD>` (KO-KO / ops / RzRz) | Supabase Auth users; documented in tracked docs (redacted going forward) | Supabase Auth → reset each user password; ask owners to set their own | KO-KO owner, platform ops, RzRz owner. |

## P1
| ☐ | Label | Where it lives now | Rotate via | Notes |
|---|-------|--------------------|------------|-------|
| ☐ | `<WEBHOOK_VERIFY_TOKEN>` | `services/whatsapp-invoice-gateway/.dev.vars` (gitignored) | regenerate → `wrangler secret put WEBHOOK_VERIFY_TOKEN` → update Meta webhook config | Cloudflare Worker WhatsApp webhook. |
| ☐ | `<VAPID_PRIVATE_KEY>` | `apps/web/.env.local` (gitignored) | regenerate web-push VAPID keypair; update env + client public key | Push notifications only. |
| ☐ | `<LOCAL_SQL_PASSWORD>` for `<LOCAL_SQL_USER>` (`sa`) | POS box / clone (`appsettings.Local.json`, gitignored; local-only `punnelifosys-*` scripts) | SQL Server `ALTER LOGIN sa WITH PASSWORD=...` | Dev/clone box; coordinate with POS owner. |
| ☐ | `<REMOTE_SQL_PASSWORD>` for `<REMOTE_SQL_USER>` | remote linked-server account | hosting provider / SQL admin → reset | Remote `accreef` linked server. |

## Not a secret (no rotation)
- Supabase **anon / publishable** key (`NEXT_PUBLIC_…`) — public by design.
- Cloudflare D1 `database_id`, Vercel project/team IDs — non-secret identifiers.

## Local-only scripts (intentionally retain real dev creds)
`.claude/skills/punnelifosys-pos-operate/scripts/{start_trace.sql,read_trace.py}` and the
`punnelifosys-pos*` skill trees are **gitignored** (Phase 1.5) and intentionally local — their
literal `sa` credential must stay for the scripts to run. Do **not** redact them; they are never
committed. Rotating `<LOCAL_SQL_PASSWORD>` requires updating these local files by hand.

## History scrub (separate, gated)
Tracked docs + `.graph` + past commits still contain pre-rotation secret values in **git history**.
A history rewrite (`BFG` / `git filter-repo`) should be done **only after a full backup and explicit
owner approval** — it rewrites SHAs and breaks every existing clone/PR. Rotation is the primary fix;
history scrub is optional hardening.

## Still-pending redactions (working tree, not yet placeholdered)
`memory.md` — ☑ redacted in Phase 3b (12 owner/ops/test passwords → `<OWNER_TEST_PASSWORD>`; POS
state split to `docs/pos/POS-STATE.md`, already placeholdered).

Dirty-skill-file pass (done — WIP preserved, secrets placeholdered in the same commit):
- `.claude/skills/menulink-integration/learnings.md` — ☑ redacted (`<LOCAL_SQL_PASSWORD>` /
  `<LOCAL_SQL_USER>` / `<POS_PIN>`); the new LRN-entry WIP was committed alongside.
- `.claude/skills/menulink-integration/references/rzrz-deep-dive.md` — ☑ redacted
  (`<REMOTE_SQL_USER>` / `<REMOTE_SQL_PASSWORD>`); DB names `samer910_rzrz/accreef` kept (not creds).
- `.claude/skills/menulink-integration/SKILL.md` — still has uncommitted WIP but **no scanner-flagged
  credential** (nothing to redact).

> **Tracked scanner surface = 0** after this pass (`node scripts/secret-scan.mjs` → `✅`).

Protected-README pass (done):
- `apps/web/README.md` — ☑ redacted (3 owner/ops/test passwords → `<OWNER_TEST_PASSWORD>`).
- `bridge-app/README.md` — ☑ verified clean: no literal secret (only an `sb_secret_...` format
  placeholder + an Integrated-Security connection string — neither is a value).
