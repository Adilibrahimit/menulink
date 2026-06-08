# Cloudflare Status Gateway — Spec

> Shared, independent status gateway for multiple restaurant WhatsApp numbers. **Not** MenuLink.
> It does **not** send invoices, store PDF/PNG, or hold Meta send tokens. Status only.

## Components
Cloudflare Worker · Cloudflare D1 · Meta webhook endpoint · installation API · protected diagnostics.
Project (future): `services/whatsapp-invoice-gateway/`
```text
src/index.ts
src/routes/{meta-webhook,message-register,status-sync,heartbeat,health}.ts
src/services/{signature-validator,tenant-router,status-reducer,auth-validator,retention-cleaner}.ts
src/repositories/{tenants,installations,phone-numbers,message-mappings,webhook-events,message-status}.ts
migrations/  wrangler.jsonc  package.json  tsconfig.json  tests/
```

## Routes
- `GET /webhook` — Meta verification challenge; verify-token from Worker **secret**; no tenant data returned.
- `POST /webhook` — read raw body → validate Meta signature → parse **status events AND incoming customer
  messages** → extract `phone_number_id` → resolve tenant → idempotent D1 write → update monotonic status /
  refresh `customer_service_windows` → return 200 fast. Never call a restaurant device during the webhook.
- `POST /api/v1/messages/register` — {tenant_id, installation_id, local_job_id, invoice_id_hash,
  meta_message_id, phone_number_id} (idempotent).
- `GET /api/v1/status-sync?cursor=<cursor>` — tenant-scoped incremental status.
- `POST /api/v1/heartbeat` — installation health + last-seen.
- `GET /api/v1/health` — minimal public health only.

## D1 schema
- **tenants**(tenant_id, restaurant_name, status, allow_paid_template, created_at, updated_at)
- **phone_numbers**(phone_number_id, tenant_id, masked_display_number, status, created_at, updated_at)
- **installations**(installation_id, tenant_id, branch_id, secret_hash, status, last_seen_at, created_at, updated_at)
- **message_mappings**(id, tenant_id, installation_id, local_job_id, invoice_id_hash, meta_message_id,
  phone_number_id, created_at) — unique(tenant_id, local_job_id); unique(meta_message_id)
- **webhook_events**(event_id, tenant_id, phone_number_id, meta_message_id, event_type, event_timestamp,
  payload_hash, error_code, received_at, expires_at) — no full payloads by default
- **message_status**(meta_message_id, tenant_id, installation_id, current_status, status_rank, error_code,
  error_message_redacted, updated_at, sent_at, delivered_at, read_at, failed_at)
- **customer_service_windows**(tenant_id, phone_number_id, customer_wa_id_hash, last_customer_message_at,
  window_expires_at, updated_at) — hash the wa_id; the webhook updates this on inbound customer messages

Indexes: phone_numbers(phone_number_id) · message_mappings(meta_message_id) ·
message_mappings(tenant_id, installation_id, created_at) · webhook_events(payload_hash) ·
webhook_events(meta_message_id, event_timestamp) · message_status(tenant_id, updated_at) ·
installations(tenant_id, installation_id).

## Authentication (Bridge → Worker)
Fields: installation_id, timestamp, nonce, body_hash, HMAC signature. Reject unknown/disabled
installation, expired timestamp, reused nonce, bad body_hash, bad signature, tenant mismatch. Store only
**hashed** installation secrets. Worker secrets live in Cloudflare secrets (never source/wrangler/D1).

## Idempotency & monotonic status
Unique payload-hash / event identity; unique meta_message_id mapping; idempotent register + webhook
writes; monotonic ranks (10/20/30/40, Failed terminal); reject downgrades.

## Capacity (target)
20 restaurants · 4,000 sends/day · ~12,000 status events/day · ~19,200 status-sync requests/day
(20 installations × 60/hr × 16h). Free for dev/pilot. Before 20-restaurant prod: capacity test; monitor
Worker daily requests, D1 rows read/written, D1 size; alert at 70%; decide Workers Paid. **No Queues.**

## Retention (Cron Trigger)
webhook_events 14–30d · message_status 90d · customer_service_windows after configured inactivity ·
heartbeat aggregated/brief · message_mappings per audit. Never delete active pending mappings, unresolved
failures, or statuses still required by a local Bridge cursor.

## Failure behavior
- **Worker/D1 down:** Meta sending continues; local stays `AcceptedByMeta`; status sync delayed; no resend
  triggered merely because status is missing.
- **Webhook POST fails:** fail safely (Meta retries); local sending independent.
- Tenant isolation: per-tenant queries/rate-limits; one tenant cannot exhaust another.
