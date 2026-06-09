# Proof — BG-3 Direct Meta Cloud API Sender

> Date 2026-06-09. Code-complete + self-tested with a FAKE Graph HTTP handler (no real token, no network).
> Live sending is **gated on a real Meta token + WABA** (external onboarding). Build 0 errors.
> Run: `dotnet run -- bg3-selftest`.

## Built (bridge-app/.../DigitalInvoice/Meta/)
- `DpapiTokenStore.cs` — per-installation Meta token at rest via **Windows DPAPI (CurrentUser)**; implements
  `ITokenProvider`. Token never in config/source/logs/git/D1 (SECURITY.md).
- `MetaCloudClient.cs` — Graph client (injectable HttpClient): `UploadMediaAsync` (multipart),
  `SendDocumentAsync` (service message), `SendTemplateAsync` (utility template w/ document header); parses
  Meta error JSON.
- `MetaError.cs` — transient vs permanent classification (HTTP + Meta codes: 4/130429/131048/131056/132000
  transient; 100/190/131026/132001/… permanent).
- `CircuitBreaker.cs` — per-tenant Closed/Open/HalfOpen (threshold + cooldown; injectable clock).
- `SendConfig.cs` — `TenantSendConfig` (PhoneNumberId, AllowPaidTemplate, template name/lang), `ITokenProvider`,
  `IWindowStateProvider` (+ `StubWindowStateProvider`).
- `MetaCloudTransport.cs` (`IInvoiceTransport`) — cost-policy selection + `Cwh` SHA-256(salt‖E164); fail-closed.
- `SendResult.BlockedByPolicy` + `SenderPipeline` handles `BlockedByPolicy` (no retry).

## Self-test result — ALL PASS (9/9)
DPAPI roundtrip · window OPEN→service msg accepted · window CLOSED+paid→template accepted ·
CLOSED+free-only→**BlockedByPolicy** · unknown window→fail-closed blocked · 429→transient ·
400/131026 not-on-WhatsApp→permanent · missing token→transient (awaiting provisioning) ·
circuit breaker opens after 3 consecutive failures.

## Gate: PASS (code) — external dependency remains
no token exposure (DPAPI) ✓ · accepted message-id recorded ✓ · transient retry vs permanent stop ✓ ·
no duplicate send (outbox idempotency + claim) ✓ · cost policy never silently pays / never silently discards ✓.
**Remaining external step:** provision a real Meta token (WABA + Embedded Signup / BSP) into the DPAPI store
and an approved Utility Template, then run a live send. Until then this is verified only against the fake handler.
The real `IWindowStateProvider` (Cloudflare-backed) is wired in BG-5.
