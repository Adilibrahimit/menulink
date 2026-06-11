# Go-Live Runbook — BG-8 Pilot & BG-9 Scale (+ external gates)

> The code for BG-0…BG-6 is built + self-test-proven. Going live needs three external things only YOU can
> provide: a **Meta WhatsApp Cloud API token + approved template**, a **Cloudflare account (Worker + D1)**,
> and a **real till + number** for the pilot. This runbook is the ordered checklist.

## A. One-time external setup (the gates)
1. **Cloudflare gateway** (`services/whatsapp-invoice-gateway/`):
   - `npm install`; `wrangler d1 create whatsapp_invoice_gateway` → copy `database_id` into `wrangler.jsonc`.
   - `npm run migrate:remote` (applies `migrations/0001_init.sql`).
   - `wrangler secret put META_APP_SECRET` ; `wrangler secret put WEBHOOK_VERIFY_TOKEN`.
   - `wrangler deploy` → note the Worker URL.
   - *Status 2026-06-11: D1 created + migrated; secrets set (META_APP_SECRET = placeholder); deploy pending
     one-time workers.dev subdomain registration (interactive).*
2. **Meta** (see `docs/whatsapp-cloud-api-onboarding.md`): WABA + phone number; **business verification**;
   permanent token (System User); approve utility template `invoice_ready` (document header); decide
   existing-number-Coexistence vs dedicated number. → **DECIDED 2026-06-11: Coexistence** (embedded signup;
   client keeps own number; WhatsApp Business app ≥2.24.17, number ≥7d active; SA supported).
3. **D1 seed** (per tenant/branch):
   - `tenants(tenant_id, restaurant_name, allow_paid_template, window_salt)` — generate a random `window_salt`.
   - `phone_numbers(phone_number_id → tenant_id)`.
   - `installations(installation_id, tenant_id, public_key)` — the Bridge prints its SPKI on first run
     (`EcdsaRequestSigner.LoadOrCreate`); paste it here.
   - Configure Meta webhook → `<workerUrl>/webhook`, verify token = `WEBHOOK_VERIFY_TOKEN`, subscribe `messages`.
4. **Bridge token**: on the till, store the Meta token in DPAPI (`DpapiTokenStore.Store(installationId, token)`).

## B. BG-8 — Controlled pilot (one till)
1. **Backup + manifest** of `…\Branch-RES\ZKDebug\` (SHA-256) — rollback-ready (`ROLLBACK.md`).
2. Deploy the **helper DLL** (built per the existing runbook: csc + PEVerify 0-new + JitCheck fail=0). **No
   EXE re-patch** (SendModeHook unchanged). Add app-config `DigitalInvoiceSendTransport=BackgroundBridge`.
3. Bridge `appsettings`: `DigitalInvoice:Enabled=true`, GatewayUrl, InstallationId, TenantId, PhoneNumberId,
   WindowSalt, Company (name/address/logo/VAT%), AllowPaidTemplate per the cost decision.
4. **Clone first:** run the BG-7 matrix end-to-end. `SELECT DB_NAME(),@@SERVERNAME;` before any DB write.
5. Pilot on ONE real till, ONE cashier, **low volume**: verify a real customer receives the invoice; watch
   the SQLite outbox + gateway D1 status; rehearse the **reconcile rollback** (pause→checkpoint→switch).
6. **Monitor 48h**: send success rate, BlockedByPolicy count, failures, status lifecycle, no double-charge.
   Expand only after sign-off.

## C. BG-9 — Multi-tenant scale
- One **local SQLite queue + installation identity** per restaurant/branch; one Meta credential + circuit
  breaker per tenant; route by `phone_number_id`; per-tenant rate limits.
- **Capacity** (target 20 restaurants · 4,000 sends/day · ~12k status events · ~19.2k sync req/day): start on
  Cloudflare **Free** for pilot; **move to Workers Paid before 20-restaurant production**; alert at 70% of
  Worker requests + D1 rows/size. **No Cloudflare Queues.**
- **Retention** runs via the Worker cron (webhook_events 14–30d, message_status 90d, windows after inactivity);
  verify it never deletes active mappings / unresolved failures / cursor-needed statuses.
- Per-tenant **onboarding** = repeat §A.3 + §B; **incident runbook** = `ROLLBACK.md` + circuit-breaker + status
  diagnostics.

## Cost note (hybrid policy)
Free when the customer messaged within 24h (service message); otherwise a paid utility template only if
`allow_paid_template=true`, else `BlockedByPolicy` (durable, surfaced) — never a silent paid send.
