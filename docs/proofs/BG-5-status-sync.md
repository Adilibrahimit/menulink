# Proof — BG-5 Bridge Status Sync + Gateway Client

> Date 2026-06-09. Build 0 errors; `bg5-selftest` ALL PASS (8/8) via fake HTTP handler.
> Live operation gated on the deployed gateway + a registered installation public key.

## Built (bridge-app/.../DigitalInvoice/Gateway/)
- `EcdsaRequestSigner.cs` — ECDSA P-256, private key via **DPAPI** (`LoadOrCreate`), SPKI public key for D1;
  signs the **widened canonical string** `METHOD\npath\ncanonicalQuery\ninstId\nts\nnonce\nsha256(body)`
  (Codex #2); raw **IEEE-P1363** signature (matches the Worker's WebCrypto verify). `CanonicalQuery` matches
  the Worker's sorted/url-encoded form.
- `GatewayClient.cs` — register / window / status-sync / heartbeat; every `/api/v1` call ECDSA-signed; sends
  the exact hashed body bytes so the Worker's `sha256(rawBody)` matches.
- `CloudflareWindowStateProvider.cs` (`IWindowStateProvider`) — short-TTL cache; **fail-closed** (error/unknown → null → transport treats as CLOSED).
- `StatusSyncService.cs` — cursor-based pull; applies remote status to the outbox **without re-sending**
  (`ApplyRemoteStatus`, no attempt bump); records `status_events`; persists cursor; heartbeat.
- `DigitalInvoiceSenderWorker.cs` (+ `DigitalInvoiceOptions`) — co-hosted BackgroundService composing
  spool→render→Meta→**register mapping on accept (Codex #4)**→status-sync; **self-disabling** unless
  `DigitalInvoice:Enabled=true` (live `pos_outbox` service unaffected).
- `SenderPipeline` extended with an `onAccepted` hook (gateway mapping register); `SqliteOutbox` extended
  with `FindJobIdByMeta` / `ApplyRemoteStatus` / `RecordStatusEvent` / service-state accessors.

## bg5-selftest — ALL PASS (8/8)
ECDSA sign→SPKI verify roundtrip (P1363) · tampered message rejected · **cross-endpoint replay rejected** ·
window open=true · **window cached (1 call for 2 lookups)** · gateway error → fail-closed · status-sync
applied Delivered to the local job · cursor advanced.

## Gate: PASS (code+logic) — integration gated
full status lifecycle handling, fail-closed window, ECDSA auth compatible with the BG-4 Worker, mapping
registration on accept. **Remaining external step:** point the worker at the deployed gateway URL, register
the installation's SPKI public key + a `tenants.window_salt` in D1, provision the Meta token (BG-3), set
`DigitalInvoice:Enabled=true`, and run the live overnight-resync / webhook-outage tests in BG-7.
