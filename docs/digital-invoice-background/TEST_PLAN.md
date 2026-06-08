# Test Plan

> Global rule: `SELECT DB_NAME(), @@SERVERNAME;` before every DB write; result must be the disposable
> clone. Mark anything not run as **NOT VERIFIED**. No production tests until the approved pilot.

## Payment safety
One payment per click · no duplicate on rapid double-click · no duplicate on repeated Enter · send/Bridge/
Meta/webhook failure does NOT rerun payment · kitchen/paper/point/table/numbering/ZATCA unchanged ·
`_paymentPersisted` guard intact · spool persisted before `Sales.InvoiceID` reset.

## POS responsiveness
enqueue <300 ms · added POS delay <500 ms · no network/PDF/PNG on UI thread · no WhatsApp Desktop · no
browser · no clipboard · no blocking success MessageBox · next order starts immediately.

## Local durability
atomic temp→final rename · partial-file quarantine · duplicate-file idempotency · Bridge stopped during
payment · Bridge restart import · Windows reboot recovery · SQLite WAL integrity · migration recovery ·
disk-full handling · cleanup/retention · no PDF in SQLite · no vendor-POS-DB schema change.

## Rendering parity (BG-1 gate)
Arabic · English · bilingual · 1-page · multi-page · long invoice · thermal · A4 · PNG fallback · no
cropping · VAT/totals correct · invoice+bill numbers correct · ZATCA QR scans · Phase-1 TLV reproduced ·
**Phase-2 persisted QR reused (sign-once preserved, never re-signed)** · logo/name/address from config.

## Meta
service-window message · Utility Template outside window · PDF upload · PNG fallback · accepted
meta_message_id · invalid phone · customer-not-on-WhatsApp · template rejection · token revoked · number
disabled · timeout · rate limit · retry w/ jitter · permanent-failure classification · no duplicate after retry.

## Cloudflare gateway
verification challenge · valid Meta signature · invalid signature rejected · incoming message opens the
correct customer window · two restaurants sharing a customer stay isolated · unknown `phone_number_id`
quarantined · duplicate event idempotent · out-of-order monotonicity · invalid HMAC rejected · replayed
nonce rejected · cursor sync · heartbeat · D1-unavailable behavior · redacted logs · Cron retention keeps active records.

## Cost policy
expired window → Utility Template (when `allow_paid_template=true`) · unknown window → no free-form ·
`allow_paid_template=false` → `BlockedByCostPolicy` · Cloudflare outage does not block direct Meta send ·
Meta outage retains local retry job · delayed webhook does not duplicate a send · never silent paid send.

## Capacity
20 restaurants · 4,000 sends/day · 12,000 status events/day · 20 installations polling 1/min × 16h.
Tests: normal average · 10× burst · noisy tenant · expired token · webhook retry burst · morning resync
burst. Acceptance: one tenant cannot exhaust another · no POS impact · Worker/D1 within plan · alerts <70%.

## Rollback (rehearse before pilot)
config rollback (`DigitalInvoiceSendTransport=ManualDesktop` or `EnableDigitalInvoiceSend=0`) · Bridge
rollback · Helper rollback · full Branch rollback (restore backup, verify hashes, Server EXE untouched) ·
Cloud rollback (previous Worker version, preserve D1) — see `ROLLBACK.md`.

## BG-0 fresh results (this phase)
- Helper `Tests.exe` = **56/56** (exit 0). PNG `PngTests.exe` = **14/14** (exit 0); QR decodes; multi-page OK.
- Clone identity confirmed; hashes match manifest; flag `=1`; `InsertPaymentDetails` UPSERT-on-InvoiceID confirmed.
- **NOT VERIFIED (not run):** live UI smokes (Pay&Print / Pay&Send / Pay&Print+Send / duplicate-payment via
  touch UI), runtime ZATCA-P2 fallback, missing-Helper + flag-disabled runtime behavior.
