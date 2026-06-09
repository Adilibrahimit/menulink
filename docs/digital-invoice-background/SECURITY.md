# Security & Compliance

> Revised per the approved Codex review: Bridge↔Worker auth is **asymmetric (ECDSA)**, not HMAC from a
> stored secret hash.

## Secrets & keys
- **Meta access token:** per-installation, stored locally via **Windows DPAPI** (or Credential Manager).
  **Never** in Git, source, plaintext config, the POS EXE config, logs, or D1/Cloudflare.
- **Installation signing key (ECDSA P-256, Ed25519 if available):** the **private key** lives on the Bridge
  in **DPAPI**; only the **public key** is stored in D1 (`installations.public_key`, with `key_id`/`key_status`
  for rotation). No shared secret exists. *(A one-way hash of a secret cannot verify an HMAC, and a stored
  hash used as a key would be a bearer secret / a shared key would break tenant isolation — hence asymmetric.)*
- **Worker secrets** (Meta verify-token, app secret): Cloudflare secrets only — never source/`wrangler.jsonc`/D1.
- POS DB credentials: Bridge config only (prefer Integrated Security); never in cloud or logs.

## Authentication & integrity
- Meta webhook: verify the `GET` challenge token and validate the `POST` `X-Hub-Signature-256` against the
  app secret before processing.
- Bridge→Worker (`/api/v1/*`): **ECDSA signature** over `{installation_id, timestamp, nonce, body_hash}`,
  verified with the installation's public key. Reject expired timestamp, reused nonce, unknown/disabled
  installation, bad body_hash, bad signature, tenant mismatch.

## Tenant isolation
Route by `phone_number_id`; one installation = one tenant; per-tenant rate limit + Meta credential +
circuit breaker; separate local SQLite queue per restaurant; tenant-scoped D1 queries; no shared send
worker. One tenant's failure or load must not affect another.

## Customer data (PDPL-minded)
- Do **not** store full customer phone numbers in D1 — store `customer_wa_id_hash = SHA-256(tenant
  window_salt ‖ E164)` (+ `masked_display_number` for display). Full E.164 lives only transiently in the
  local job + the Meta call.
- No invoice PDF/PNG in the cloud — rendered + sent locally; only status metadata leaves the LAN.
- Redact errors in logs (`error_message_redacted`); no tokens/phones/keys in logs.

## Cost-policy safety
Never silently send a paid Utility Template and never silently discard an invoice. Window state comes from
the authenticated `GET /api/v1/window` + short-TTL cache; **fail-closed** when it cannot be verified
(out-of-window + paid disabled → `BlockedByCostPolicy`).

## POS / payment safety
Payment success never depends on WhatsApp/Bridge/cloud. Preserve `_paymentPersisted` duplicate guard and
ZATCA Phase-2 print-only / sign-once (reuse persisted QR; never re-sign). Spool persists before
`Sales.InvoiceID` reset. **Single-active-transport** invariant (manual XOR background) prevents double-send.
Server EXE never modified.

## Environment safety
Clone-only until the approved pilot gate. Run `SELECT DB_NAME(), @@SERVERNAME;` before any DB write.
No vendor-POS-DB schema change. Backups + SHA-256 manifest + PEVerify (0-new) + JIT (fail=0) before any
binary change.
