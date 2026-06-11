# Background WhatsApp Invoice — Build Status

> Updated 2026-06-09. Branch `feat/background-whatsapp-invoice` (not pushed). Plan:
> `~/.claude/plans/mellow-fluttering-bird.md`. Architecture/security/test/rollback docs in this folder.

## Phase status (BG-0 … BG-9)
| Phase | What | State | Commit | Verification |
|---|---|---|---|---|
| BG-0 | Baseline revalidation + branch + docs | ✅ PASS | c107848 | clone id, hashes, 56/56+14/14, dup-payment runtime PASS (BillNo 33931, 1 row) |
| BG-1 | Headless renderer (QuestPDF AR/EN/bi + ZATCA QR + PNG) | ✅ PASS | aebc7d7 | rendered 33931 all langs; TLV decoded |
| BG-2 | Spool + SQLite outbox (WAL, idempotency, retries, pause/checkpoint) | ✅ PASS | 7eece5d | bg2-selftest ALL PASS; enqueue 12.4ms |
| BG-3 | Meta sender (DPAPI, Graph, cost policy, circuit breaker) | ✅ code+test | f8bb9c9 | bg3-selftest 9/9 (fake handler) · live send token-gated |
| BG-4 | Cloudflare Worker + D1 gateway | ✅ code+test | 47e02e6, **a9db748 (security fixes)** | vitest 4/4; deploy gated |
| BG-5 | Bridge status-sync + ECDSA client + fail-closed window + sender worker | ✅ code+test | c934d6c | bg5-selftest 8/8; integration gated |
| BG-6 | Helper DLL-only cutover (spool write, default ManualDesktop) | ✅ verified | 543fa01 | compiles FW4.7.2; deployed hashes UNCHANGED; Helper→Bridge import=1 |
| BG-7 | Full clone E2E matrix | 📋 runbook ready | (this commit) | `docs/proofs/BG-7-e2e-plan.md` — LIVE rows gated |
| BG-8 | Controlled pilot | 📋 runbook | (this commit) | `GO_LIVE_RUNBOOK.md` §B — needs real till |
| BG-9 | Multi-tenant scale | 📋 runbook | (this commit) | `GO_LIVE_RUNBOOK.md` §C — Workers Paid before 20 |

## Five Codex findings — all remediated
1. **ECDSA auth (not HMAC-from-hash):** D1 `installations.public_key`; Worker `verifyEcdsaP256`; Bridge
   `EcdsaRequestSigner` (P1363) — roundtrip proven (BG-5). 
2. **Reconcile rollback + single-active-transport:** `SqliteOutbox.Pause/CheckpointAndFreeze` (BG-2),
   `ROLLBACK.md`, helper transport XOR (BG-6).
3. **Customer-window lookup + fail-closed:** Worker `/api/v1/window` + `customer_service_windows` (BG-4),
   `CloudflareWindowStateProvider` cache fail-closed (BG-5).
4. **Webhook-before-register reconcile + monotonic status:** nullable mapping, `registerMapping` reconcile,
   `reduceStatus` (BG-4); `onAccepted` register hook (BG-5).
5. **Idempotency runtime-verified:** clone dup-payment runtime test PASS (BG-0); + cross-tenant takeover
   fixed (a9db748).

## Remaining external gates (see GO_LIVE_RUNBOOK.md)
- Meta — **Coexistence decided 2026-06-11** (client keeps own number; SA supported; needs WhatsApp Business
  app ≥2.24.17 + number active ≥7d on it). One-time MenuLink Tech-Provider setup: business verification
  (2–5 business days) → app review (video evidence) → permanent System-User token + `invoice_ready` template.
  Pilot can run with the Meta app in dev mode (tester role) before app review completes.
- Cloudflare — ✅ 2026-06-11 (acct `id.menulink@gmail.com`): D1 `a6a0f92a-386a-4693-b560-b01f32a0728d` (EEUR)
  created + `0001_init` migrated; Worker uploaded; secrets set (WEBHOOK_VERIFY_TOKEN real → gitignored
  `.dev.vars`; META_APP_SECRET placeholder, rotate when Meta app exists). LEFT: register workers.dev
  subdomain (interactive) → re-deploy → seed tenant/installation rows.
- A real till + number for the BG-8 pilot (clone-tested first).

## Self-test commands (all green, no external deps)
`dotnet run -- bg2-selftest` · `bg3-selftest` · `bg5-selftest` · `render-invoice <id> ar|en|bi` ·
`import-spool <spoolRoot>` ; gateway: `npm test` (vitest 4/4).
