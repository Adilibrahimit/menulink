# Cloudflare Status Gateway — Spec

> Shared, independent status gateway for multiple restaurant WhatsApp numbers. **Not** MenuLink.
> It does **not** send invoices, store PDF/PNG, or hold Meta send tokens. Status only.
> Revised per the approved Codex adversarial review (auth → ECDSA; `/window` lookup; orphan reconcile).

## Components
Cloudflare Worker · Cloudflare D1 · Meta webhook endpoint · installation API · protected diagnostics.
Project (future): `services/whatsapp-invoice-gateway/`
```text
src/index.ts
src/routes/{meta-webhook,message-register,window,status-sync,heartbeat,health}.ts
src/services/{signature-validator,tenant-router,status-reducer,auth-validator,retention-cleaner}.ts
src/repositories/{tenants,installations,phone-numbers,message-mappings,webhook-events,message-status,windows}.ts
migrations/  wrangler.jsonc  package.json  tsconfig.json  tests/
```

## Routes
- `GET /webhook` — Meta verification challenge; verify-token from Worker **secret**; no tenant data returned.
- `POST /webhook` — read raw body → validate Meta signature → parse **status events AND incoming customer
  messages** → extract `phone_number_id` → resolve tenant → **idempotent D1 write keyed by `meta_message_id`
  (mapping may be NULL)** → update monotonic status / refresh `customer_service_windows` on inbound → 200 fast.
  Never call a restaurant device during the webhook.
- `POST /api/v1/messages/register` — {tenant_id, installation_id, local_job_id, invoice_id_hash,
  meta_message_id, phone_number_id}. **Idempotent AND atomically reconciles** any pre-existing
  unmatched `webhook_events`/`message_status` for that `meta_message_id` into installation scope
  (status-reducer applies monotonic rank). *(Optional two-phase: pre-register `local_job_id`, then PATCH
  `meta_message_id` on Meta accept.)*
- `GET /api/v1/window?cwh=<customer_wa_id_hash>` — tenant-scoped customer-service-window state →
  `{open, window_expires_at, last_customer_message_at, as_of}`. Used by the Bridge to choose free vs paid.
- `GET /api/v1/status-sync?cursor=<cursor>` — tenant-scoped incremental **status + window deltas**.
- `POST /api/v1/heartbeat` — installation health + last-seen.
- `GET /api/v1/health` — minimal public health only.
All `/api/v1/*` require a valid **ECDSA installation signature** (see Authentication).

## D1 schema
- **tenants**(tenant_id, restaurant_name, status, allow_paid_template, **window_salt**, created_at, updated_at)
- **phone_numbers**(phone_number_id, tenant_id, masked_display_number, status, created_at, updated_at)
- **installations**(installation_id, tenant_id, branch_id, **public_key, key_id, key_status**, status,
  last_seen_at, created_at, updated_at) — *(public key, NOT a shared secret hash)*
- **message_mappings**(id, tenant_id, **installation_id (nullable)**, local_job_id, invoice_id_hash,
  meta_message_id, phone_number_id, created_at) — unique(tenant_id, local_job_id); unique(meta_message_id)
- **webhook_events**(event_id, tenant_id, phone_number_id, meta_message_id, event_type, event_timestamp,
  payload_hash, error_code, received_at, expires_at) — **persists even when unmapped**; no full payloads
- **message_status**(meta_message_id, tenant_id, **installation_id (nullable)**, current_status, status_rank,
  error_code, error_message_redacted, updated_at, sent_at, delivered_at, read_at, failed_at) — **keyed by
  `meta_message_id`; survives before a mapping exists** (reconciled at register)
- **customer_service_windows**(tenant_id, phone_number_id, customer_wa_id_hash, last_customer_message_at,
  window_expires_at, updated_at) — `customer_wa_id_hash = SHA-256(tenants.window_salt ‖ E164)`

Indexes: phone_numbers(phone_number_id) · message_mappings(meta_message_id) ·
message_mappings(tenant_id, installation_id, created_at) · webhook_events(payload_hash) ·
webhook_events(meta_message_id, event_timestamp) · message_status(tenant_id, updated_at) ·
installations(tenant_id, installation_id) · customer_service_windows(tenant_id, customer_wa_id_hash).

## Authentication (Bridge → Worker) — ECDSA, not HMAC
Each installation has an **ECDSA P-256 keypair** (Ed25519 if available on the deployed runtime). The Bridge
holds the **private key in Windows DPAPI**; D1 stores only the **public key** (`installations.public_key`,
with `key_id`/`key_status` for rotation). Each `/api/v1/*` request carries `{installation_id, timestamp,
nonce, body_hash, signature}`; the Worker verifies `signature` over `{installation_id|timestamp|nonce|body_hash}`
with the stored public key. Reject: unknown/disabled installation, expired timestamp, reused nonce, bad
body_hash, bad signature, tenant mismatch. *(Rationale: a one-way secret hash cannot verify an HMAC, and the
hash-as-key would be a bearer secret / a shared key would break isolation — so asymmetric signing is used.)*
Worker secrets (Meta verify-token, app secret) live in Cloudflare secrets only.

## Idempotency & monotonic status
Unique payload-hash / event identity; unique meta_message_id; idempotent register (+ orphan reconcile) and
webhook writes; monotonic ranks `AcceptedByMeta=10 < Sent=20 < Delivered=30 < Read=40`, `Failed` terminal;
reject downgrades. A delayed/missing webhook never triggers a resend.

## Capacity (target)
20 restaurants · 4,000 sends/day · ~12,000 status events/day · ~19,200 status-sync requests/day
(20 installations × 60/hr × 16h). Free for dev/pilot. Before 20-restaurant prod: capacity test; monitor
Worker daily requests, D1 rows read/written, D1 size; alert at 70%; decide Workers Paid. **No Queues.**

## Retention (Cron Trigger)
webhook_events 14–30d · message_status 90d · customer_service_windows after configured inactivity ·
heartbeat aggregated/brief · message_mappings per audit. Never delete active pending mappings, unresolved
failures, or statuses still required by a local Bridge cursor.

## Failure behavior
- **Worker/D1 down:** Meta sending may continue **only if the cost policy can be satisfied fail-closed**
  (window unverifiable → paid template if allowed, else `BlockedByCostPolicy`); local stays `AcceptedByMeta`;
  status sync delayed; no resend triggered merely because status is missing.
- **Webhook POST fails:** fail safely (Meta retries); local sending independent.
- Tenant isolation: per-tenant queries/rate-limits; one tenant cannot exhaust another.
