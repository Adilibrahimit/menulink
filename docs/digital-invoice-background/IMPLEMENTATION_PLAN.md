# Implementation Plan — BG-0…BG-9

> One phase at a time, dedicated branch, separate commit per phase, **stop after each phase**, do not
> continue past a failed gate. Clone-only until BG-8 pilot.

- **BG-0 Baseline + branch + docs (THIS PHASE):** confirm clone (`SELECT DB_NAME(),@@SERVERNAME`);
  re-verify hashes; re-run Helper/PNG tests; re-confirm source + sproc; create
  `feat/background-whatsapp-invoice`; write these docs + the proof. **Do not apply 0072.** Evidence/docs only.
- **BG-1 Render spike (HARD STOP):** `InvoiceRenderModel` from `GetItemsForPrintInvoice` + per-installation
  config (logo/name/address); headless PDF AR/EN/bilingual + multi-page + Phase-1 TLV + reuse Phase-2 QR;
  diff vs clone receipts; measure time/memory. Do not modify POS/Helper. **Stop if parity unproven.**
- **BG-2 Spool + SQLite outbox:** versioned job (FW4.7.2-compatible) atomic write in Helper source (not
  deployed); extend Bridge with spool import + sweep + FileSystemWatcher (optimization) + SQLite/WAL +
  migrations + idempotency + retries + cleanup + health + fake transport + crash/reboot recovery tests.
  Gate: enqueue <300 ms, no SQLite in POS, restart recovery, duplicate import prevented.
- **BG-3 Direct Meta sender:** DPAPI per-installation config; Graph client (versioned); media upload;
  service-message path; **gated** Utility-Template path; error classification; backoff+jitter; per-tenant
  circuit breaker; store meta_message_id; cost-category log; Meta test resources first. Gate: no token
  exposure; accepted message id recorded; transient retry works; permanent failure stops; no duplicate send.
- **BG-4 Cloudflare Worker + D1 status gateway:** Worker project; D1 migrations; webhook GET verify; POST
  signature; **incoming customer-message processing + customer-service-window tracking**; route by
  `phone_number_id`; idempotent events; monotonic status; installation HMAC API (register/status-sync/
  heartbeat/health); Cron retention; tenant rate limits; deploy to test. Gate: verification passes;
  duplicates idempotent; out-of-order no regress; tenant isolation; fast Worker response.
- **BG-5 Bridge status sync (Cloudflare API):** register mapping; cursor sync 60s active / 5m idle; startup
  full sync; persist sent/delivered/read/failed; heartbeat; window-state fetch/cache. Gate: full lifecycle;
  overnight shutdown + morning resync; webhook outage does not block sending.
- **BG-6 Helper DLL-only cutover:** remove clipboard / `Process.Start` / Desktop URL / blocking MessageBox;
  add `DigitalInvoiceSendTransport=ManualDesktop|BackgroundBridge` (start ManualDesktop) + atomic enqueue +
  immediate return + non-blocking hard-failure notify. Gate: **no EXE diff**, Helper-only deploy, no
  WhatsApp Desktop, no clipboard, no blocking message, job persisted before invoice-id reset, POS returns immediately.
- **BG-7 Full clone E2E:** all modes/langs/pages/window-states/template/outages/restarts/duplicates/webhook
  ordering/token-failures/customer-not-on-WhatsApp/ZATCA-P2/rollback → `TEST_PLAN.md`.
- **BG-8 Controlled pilot:** fresh backup + hashes; approved Meta number + Utility Template; monitoring;
  rehearsed rollback; install disabled→verify health→enable one cashier→low volume→48h watch→expand on approval.
- **BG-9 Scale:** per-restaurant queue + installation identity; webhook routing by `phone_number_id`;
  per-tenant rate limits + credential circuit breaker; Cloudflare Worker & D1 capacity/retention/alerting;
  Workers Paid decision before 20-restaurant prod; onboarding + incident runbooks.
