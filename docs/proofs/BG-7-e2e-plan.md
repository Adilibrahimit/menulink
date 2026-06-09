# BG-7 — Full Clone End-to-End Test Plan & Runbook

> Status: **READY TO EXECUTE once the external gates are met** (gateway deployed, Meta token provisioned).
> Much of the logic is already proven by the phase self-tests (referenced per row). The rows marked
> **LIVE** require the deployed Cloudflare gateway + a real Meta token/template; they cannot be run headless.

## Preconditions (the external gates)
1. Cloudflare: `wrangler d1 create whatsapp_invoice_gateway` → put `database_id` in `wrangler.jsonc`;
   `wrangler d1 migrations apply … --remote`; `wrangler secret put META_APP_SECRET` + `WEBHOOK_VERIFY_TOKEN`;
   `wrangler deploy`. Point Meta webhook → the Worker `/webhook`, subscribe `messages`.
2. Meta: WABA + phone number; provision token into DPAPI on the till (`DpapiTokenStore.Store`); approve one
   utility template (`invoice_ready`) with a document header; (Coexistence or dedicated number).
3. D1 seed: `tenants` (with `window_salt`, `allow_paid_template`), `phone_numbers` (phone_number_id→tenant),
   `installations` (the Bridge's SPKI public key from `EcdsaRequestSigner`).
4. Clone POS: app-config `DigitalInvoiceSendTransport=BackgroundBridge`; Bridge `DigitalInvoice:Enabled=true`
   + config (GatewayUrl, InstallationId, TenantId, PhoneNumberId, WindowSalt, Company).  **Clone only.**
   Run `SELECT DB_NAME(),@@SERVERNAME;` first.

## Test matrix
| # | Scenario | How | Pre-covered by |
|---|---|---|---|
| 1 | Payment safety: 1 row per click, rapid double-tap | POS double-tap pay | BG-0 runtime PASS (BillNo 33931) |
| 2 | POS responsiveness: enqueue, no window/clipboard/MessageBox, next order instant | observe + spool file appears | BG-2 enqueue 12.4ms; BG-6 cutover |
| 3 | Render parity AR/EN/bilingual + multi-page + QR scans | `render-invoice` + visual + scanner | BG-1 (AR/EN/bi + TLV decode) — **visual LIVE** |
| 4 | ZATCA Phase-2 reuse (no re-sign) | a Phase-2 invoice | BG-1 code; **LIVE on a P2 invoice** |
| 5 | Window OPEN → free service message | customer messages first → pay&send | **LIVE** (BG-3 logic) |
| 6 | Window CLOSED + paid → utility template | no inbound; allow_paid=true | **LIVE** (BG-3 logic) |
| 7 | CLOSED + free-only → BlockedByPolicy | allow_paid=false | BG-3 self-test; **LIVE confirm** |
| 8 | Webhook verify + signature reject | Meta GET/POST + bad sig | BG-4 vitest |
| 9 | Duplicate webhook idempotent; out-of-order no regress | replay/reorder events | BG-4 vitest (reducer) + **LIVE** |
| 10 | Event-before-register reconcile | status before register | BG-4 reconcile code; **LIVE** |
| 11 | ECDSA auth: good accepted, replay/wrong-key/expired rejected | signed calls | BG-4 + BG-5 self-tests |
| 12 | Cross-tenant register refused (403) | tenant B registers tenant A's msg | BG-4 fix (a9db748) — **LIVE confirm** |
| 13 | Cloudflare outage → fail-closed (no unsafe free send); Meta outage → job retained | kill gateway / block Meta | BG-5 fail-closed; BG-2 durability |
| 14 | Delayed webhook never re-sends | hold then deliver status | BG-2 idempotency + BG-4 monotonic |
| 15 | Restart recovery: kill Bridge mid-flight | stop/start service | BG-2 reboot recovery PASS |
| 16 | Rollback w/ reconcile, no double-send; single active transport | ROLLBACK.md ladder | BG-2 checkpoint/pause; **rehearse LIVE** |
| 17 | Status lifecycle sent→delivered→read in /admin? (N/A — no MenuLink) → local outbox + gateway D1 | status-sync | BG-5 self-test + **LIVE** |
| 18 | Customer-not-on-WhatsApp → permanent fail, surfaced | invalid number | BG-3 self-test (131026) + **LIVE** |

## Acceptance (BG-7 done when)
All rows pass on the clone; payment integrity intact; no WhatsApp Desktop/clipboard; ZATCA P1/P2 correct;
rollback rehearsed with no double-send; no secret exposed; capacity smoke OK.

## Current status
Logic rows (1,2,7,8,9,11,14,15) are PASS via self-tests. Rows marked **LIVE** are blocked only on the two
external gates (Cloudflare account + Meta token) — not on code. Execute this matrix during the pilot setup.
