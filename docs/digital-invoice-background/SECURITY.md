# Security & Compliance

## Secrets
- **Meta access token:** per-installation, stored locally via **Windows DPAPI** (or Credential Manager).
  **Never** in Git, source, plaintext config, the POS EXE config, logs, or D1/Cloudflare.
- **Worker secrets** (Meta verify-token, app secret, HMAC keys): Cloudflare secrets only — not in
  source, `wrangler.jsonc`, or D1.
- **Installation secrets:** only the **hash** is stored in D1; the secret itself lives on the Bridge.
- POS DB credentials: Bridge config only (prefer Integrated Security); never in cloud or logs.

## Authentication & integrity
- Meta webhook: verify the `GET` challenge token and validate the `POST` `X-Hub-Signature-256` against the
  app secret before processing.
- Bridge→Worker: HMAC over {installation_id, timestamp, nonce, body_hash}; reject expired timestamp,
  reused nonce, unknown/disabled installation, bad signature, tenant mismatch.

## Tenant isolation
Route by `phone_number_id`; one installation = one tenant; per-tenant rate limit + Meta credential +
circuit breaker; separate local SQLite queue per restaurant; tenant-scoped D1 queries; no shared send
worker. One tenant's failure or load must not affect another.

## Customer data (PDPL-minded)
- Do **not** store full customer phone numbers in D1 — store `customer_wa_id_hash` (and `masked_display_number`
  for display). Full E.164 lives only transiently in the local job + the Meta call.
- No invoice PDF/PNG in the cloud — rendered + sent locally; only status metadata leaves the LAN.
- Redact errors in logs (`error_message_redacted`); no tokens/phones/secrets in logs.

## Cost-policy safety
Never silently send a paid Utility Template and never silently discard an invoice. Out-of-window with paid
disabled → `BlockedByCostPolicy` (durable, surfaced). Fail-closed when the window cannot be verified.

## POS / payment safety
Payment success never depends on WhatsApp/Bridge/cloud. Preserve `_paymentPersisted` duplicate guard and
ZATCA Phase-2 print-only / sign-once (reuse persisted QR; never re-sign). Spool persists before
`Sales.InvoiceID` reset. Server EXE never modified.

## Environment safety
Clone-only until the approved pilot gate. Run `SELECT DB_NAME(), @@SERVERNAME;` before any DB write.
No vendor-POS-DB schema change. Backups + SHA-256 manifest + PEVerify (0-new) + JIT (fail=0) before any
binary change.
