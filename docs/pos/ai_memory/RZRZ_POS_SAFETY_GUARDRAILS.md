# RzRz POS Safety Guardrails

> Read this FIRST in every session that touches POS integration.
> These rules are non-negotiable. Violations risk production data loss.

## Tenant Protection

### KO-KO (PRODUCTION — UNTOUCHABLE)
- **restaurant_id:** `11111111-1111-1111-1111-111111111111`
- **slug:** `koko`
- **Status:** Live paying customer with real orders
- **Rule:** Do NOT modify `/m/koko`, KO-KO tenant data, KO-KO images, KO-KO admin behavior, or KO-KO production flow unless the user explicitly requests it

### Live RzRz (NEAR-PRODUCTION — DO NOT EXPERIMENT)
- **restaurant_id:** `ef60381c-50db-4379-a9b7-97f5902aa54b`
- **slug:** `rzrz-bukhari`
- **Status:** Near-production, real restaurant with real customers
- **Rule:** Do NOT use `/m/rzrz-bukhari` for testing new features. Do NOT change live RzRz order flow, menu, sync settings, or customer experience

### RzRz Test Clone (SAFE LAB — confirmed 2026-05-26)
- **restaurant_id:** `c13aa2bf-df82-4c30-810d-f9ea833ed3cc`
- **slug:** `rzrz-bukhari-test`
- **Status:** Live and functional (LAB-1 PASS, 2026-05-26)
- **WhatsApp:** 966504744517 (dummy, different from live RzRz)
- **POS sync:** Enabled (user decision)
- **display_only_mode:** true (F5 testing)
- **Rule:** Use this for ALL POS testing, order flow experiments, feature development

## Credential Rules

### NEVER store in the repo:
- SQL Server passwords (local `<LOCAL_SQL_USER>` credentials, remote `<REMOTE_SQL_USER>` credentials)
- Supabase Personal Access Tokens (sbp_*)
- Supabase service_role keys
- Any production database credentials

### NEVER print in terminal output:
- Database passwords
- Auth tokens
- Customer personal data (phone numbers, addresses)

### Session-only usage:
- SQL credentials may be used in PowerShell commands during a session
- They must not be committed to any file, memory, or documentation

## POS SQL Server Rules

### Local test DB `(localdb)\ProjectModels` → `RZRZCLIENT`:
- ✅ Safe to READ (SELECT queries)
- ❌ Do NOT WRITE (INSERT/UPDATE/DELETE) unless explicitly approved by the user
- ❌ Do NOT modify stored procedures
- ❌ Do NOT drop tables or alter schema

### Production Almalaz server `DESKTOP-8Q7DQKA` / `192.168.1.113`:
- ❌ NEVER connect from any code
- ❌ NEVER write
- ❌ NEVER read (use local copy instead)

### Central server `192.250.231.22`:
- ❌ NEVER connect
- ❌ NEVER reference in code

## MenuLink Cloud Rules

### POS Sync Monitoring Dashboard:
- ✅ Read from pos_outbox, pos_sync_events, pos_settings, pos_item_map, pos_table_map
- ❌ Do NOT connect to local SQL Server from the web app
- ✅ Heartbeat table now exists (`bridge_heartbeats`, migration 0055)
- ✅ Dashboard shows Bridge App status: online/offline/never connected
- ❌ Do NOT allow item mapping writes in v1 (read-only)
- ❌ Do NOT expose customer phone/address in payload viewer — redact

### Migrations:
- ✅ Safe to create new tables, columns, functions
- ❌ Do NOT delete or modify existing production data
- ❌ Do NOT commit destructive rollback SQL
- ✅ Document rollback as a manual/reviewed plan only

## Arabic Text Rules

- Terminal/Antigravity may display Arabic RTL reversed
- This is a **display issue**, not a code bug
- **ALWAYS read the actual source file** before changing any Arabic string
- Only fix Arabic if the actual file content is reversed or incorrect
- All new user-facing Arabic/English labels must use `apps/web/lib/i18n/` (ar.ts / en.ts)

## Bridge App Rules

- Bridge App is the ONLY integration layer (no API keys from Samer)
- Do NOT modify Bridge App code without explicit approval
- Do NOT hardcode SQL connection strings in Bridge App (use config)
- Do NOT bypass hold mode (IsHold=1) — cashier must review before finalizing

## Testing Rules

- Do NOT run Playwright against production without explicit approval
- Test on local dev server (`localhost:3000`) first
- If production testing is approved, use the test tenant (`rzrz-bukhari-test`) only
- Verify `/m/koko` and `/m/rzrz-bukhari` are unchanged after every migration

## Forbidden Actions (Summary)

| Action | Why |
|--------|-----|
| Write to production POS SQL | Could corrupt live restaurant data |
| Store credentials in repo | Security breach |
| Modify KO-KO tenant | Production paying customer |
| Experiment on live RzRz page | Near-production, real customers |
| Connect cloud app to local SQL | Architecture violation, security risk |
| ~~Use "heartbeat" label~~ | ~~Now exists — migration 0055~~ |
| Allow item mapping writes in v1 | Wrong mapping = wrong kitchen prints |
| Commit destructive rollback SQL | Risk of accidental execution |
| Fix Arabic based on terminal output | Terminal display may reverse RTL |
| Run Playwright on production | Requires explicit approval each time |
