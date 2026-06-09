# Proof — BG-2 Spool + Bridge SQLite Outbox

> Date 2026-06-09. Self-contained (temp dirs, no POS/DB/network). Build 0 errors.
> Run: `dotnet run -- bg2-selftest`.

## Built (bridge-app/.../DigitalInvoice/)
- `SendJob.cs` — versioned spool job contract (JSON; same shape the Helper will write in BG-6); `IdentityKey` for idempotency.
- `SqliteOutbox.cs` — durable outbox: SQLite **WAL**, `busy_timeout`, single lock-guarded writer, `schema_migrations`,
  tables `send_jobs / send_attempts / status_events / service_state`; idempotent `TryEnqueue` (unique identity),
  `ClaimDue`, `MarkStatus`, retries; **`Pause/Resume` + `CheckpointAndFreeze`** (WAL-checkpoint + return in-flight
  set) for the Codex #2 reconcile-rollback.
- `SpoolImporter.cs` — atomic `WriteAtomic` (tmp→fsync→rename), `Sweep` (import→processed / bad→quarantine / locked→skip-retry).
- `ITransport.cs` — `IInvoiceTransport` + `FakeTransport` (deterministic; BG-3 adds the real Meta transport).
- `SenderPipeline.cs` — claim→send→mark with exponential backoff+jitter, max-attempts→FailedPermanent, honors pause.
- `Bg2SelfTestCommand.cs` + `bg2-selftest` CLI.

## Self-test result — ALL PASS
- imported 4 valid jobs; **duplicate file idempotent** (not re-imported); malformed file **quarantined**.
- **reboot recovery:** dispose+reopen on same DB → 4 pending survived.
- fake transport: **3 AcceptedByMeta (meta id assigned), 1 FailedPermanent** (phone `000…` = not on WhatsApp).
- **pause/checkpoint:** `CheckpointAndFreeze` paused the sender + froze **3 in-flight** jobs for reconcile;
  paused pipeline processed 0.
- **enqueue+import = 12.4 ms/job** (gate <300ms).

## Gate: PASS
enqueue <300ms ✓ · no SQLite in the POS process (SQLite lives only in the Bridge) ✓ · restart recovery ✓ ·
duplicate import prevented ✓ · pause/checkpoint reconcile hook present ✓.
Note: the real `DigitalInvoiceSenderWorker` (BackgroundService) registration is gated behind config and wired
in BG-5; BG-2 exercises the mechanics via the self-test so the live `pos_outbox` service is unaffected.
