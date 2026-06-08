# Target Architecture — Background WhatsApp Invoice

> Locked design. Independent of MenuLink. Cloud status layer = **Cloudflare Worker + D1**.

## Boundary & exclusions
System: Punnelifosys Branch POS · DigitalInvoice Helper DLL · existing Bridge Windows Service ·
Bridge-owned SQLite · direct Meta Cloud API · shared Cloudflare Worker · Cloudflare D1.

**Must NOT use:** Supabase (DB / Edge Functions / Realtime), Vercel, MenuLink runtime, Cloudflare
Queues, WhatsApp Desktop, clipboard, browser launch, customer QR step, a second Windows Service,
Server-EXE modification, or any vendor-POS-DB queue. The pre-existing `pos_outbox` MenuLink order-sync
already co-hosted in the Bridge is a **separate** system, untouched, and not part of this design.

## End-to-end flow
```text
Cashier enters mobile + Pay&Send / Pay&Print+Send
  → POS completes payment + core finalization
  → Helper writes ONE atomic JSON spool job, returns immediately (no network/PDF/WhatsApp on UI thread)

Existing Bridge Windows Service (co-hosted BackgroundService)
  → imports spool → SQLite outbox (durable)
  → loads committed invoice by invoiceId; renders PDF (PNG fallback)
  → selects transport (window/cost policy); sends DIRECT to Meta Cloud API
  → stores meta_message_id; registers mapping with the Cloudflare gateway

Meta → webhooks → Cloudflare Worker → (route by phone_number_id) → D1 (idempotent, monotonic)
Bridge → cursor-based status sync from the Worker → updates local outbox
```
**Send requires Meta + internet.** If clouds/Meta are down: payment still completes, the job stays
durable locally, and the Bridge retries later. (It does **not** send while offline.)

## POS job contract (atomic spool)
Path `C:\ProgramData\PunnelifosysDigitalInvoice\spool\incoming\` — write `{job}.json.tmp` → flush →
rename `{job}.json`. **No SQLite in the POS process.** No Meta token, no invoice image in the job.
```json
{ "schemaVersion":1, "jobId":"uuid", "idempotencyKey":"branch:invoice:SEND_DIGITAL_INVOICE",
  "invoiceId":"uuid", "billNo":"…", "branchId":"…", "cashierId":"…",
  "customerPhoneE164":"9665XXXXXXXX", "language":"ar", "completionMode":"SendOnly",
  "digitalInvoiceRequested":true, "optInSource":"POS_VERBAL_REQUEST", "requestedAtUtc":"ISO-8601" }
```
`invoiceId/billNo/total/company/lang/mobile/mode/zatcaPhase` are already passed to the existing
`SendModeHook`; `cashierId/counterId` are readable from `ActiveSession`; `branchId` is Bridge config.
⇒ **Helper-DLL-only cutover, no EXE re-patch.** Spool MUST be written **before** `Sales.InvoiceID` reset.

## Bridge-owned SQLite
`C:\ProgramData\PunnelifosysDigitalInvoice\data\invoice-sender.db` — WAL, busy-timeout, single writer,
short txns, unique idempotency key, migration table, backups, bounded retention. Tables: `send_jobs`,
`send_attempts`, `status_events`, `service_state`, `schema_migrations`. PDF/PNG stored **outside** SQLite.
Job states: `Pending, LoadingInvoice, Rendering, ReadyToSend, UploadingMedia, Sending, AcceptedByMeta,
Sent, Delivered, Read, RetryScheduled, FailedPermanent, BlockedByPolicy, Cancelled`.

## Background rendering (parity = BG-1 hard stop)
Bridge loads committed data (`GetItemsForPrintInvoice(@InvoiceID,@Language)`) + per-installation config
(company name/address/**logo** — these are NOT in the invoice DB) → renders PDF independent of WinForms.
Required parity: Arabic / English / bilingual, VAT, totals, invoice+bill numbers, multi-page, ZATCA QR
readability, thermal + A4. **ZATCA:** regenerate Phase-1 TLV deterministically; **reuse persisted
Phase-2 QR (`ZatcaReportingDetails.QRCode`) — never re-sign.** Do not cut over until parity is proven.

## Transport / cost policy (hybrid)
`SERVICE_MESSAGE_IN_WINDOW` (24h window verified open) | `UTILITY_TEMPLATE_OUTSIDE_WINDOW`
(`allow_paid_template=true`) | `BLOCKED_BY_COST_POLICY` (paid disabled). Window state via Cloudflare
gateway query or synced local cache. **Fail-closed:** cloud down + paid enabled → template; free-only +
unverifiable window → `BlockedByCostPolicy`. Never guess the window open; never silently pay/discard.

## Status ranks (monotonic)
`AcceptedByMeta=10 < Sent=20 < Delivered=30 < Read=40`; `Failed`=terminal with evidence. No regression
(`Read→Delivered`, `Delivered→Sent` rejected). A delayed/missing webhook never triggers another send.

## Failure isolation
Per-restaurant local queue · per-tenant Meta credential + circuit breaker + rate limit · routing by
`phone_number_id` · installation-scoped auth · idempotency per invoice · independent retry. The Worker is
**status infrastructure, not the send path** — no central send bottleneck.
