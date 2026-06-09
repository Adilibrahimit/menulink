# Rollback & Backup

> Revised per the approved Codex review: rollback must **reconcile**, not just flip a flag, and a
> **single active transport** invariant prevents double-send.

## Single-active-transport invariant (must hold at all times)
Exactly one send path is ever active:
- `DigitalInvoiceSendTransport=ManualDesktop` ⇒ the Bridge background sender is **paused/drained/disabled**.
- `DigitalInvoiceSendTransport=BackgroundBridge` ⇒ the Helper manual send is **gated off** (enqueue only).
Switching transports is the **reconcile procedure** below — never a bare flag flip, or queued/in-flight
invoices could send on both paths (double-send) or be lost.

## Backup to capture before any change (BG-6 / BG-8)
Branch app folder · Helper DLL · Bridge binaries · sanitized Bridge config · **SQLite backup + the cursor
and in-flight set at snapshot time** · Worker source + deployed version · D1 migration version · SHA-256
manifests · feature-flag values · service-install config.

## Known-good baseline (verified 2026-06-08)
- Patched Branch EXE `3B6B5C47…3786C09E` · Helper `E6B7C531…EFF6779B` · **original** EXE
  `FF1A3CB5…458ED0CD` (in `…\_backup_pre-digital-invoice_20260607_232753\`, full app copy + manifests) ·
  Server EXE `A963699D…6707A174` (must remain unchanged).

## Reconcile procedure (required before switching transport or restoring the Bridge)
1. **Pause** the Bridge sender — stop claiming new jobs; let in-flight Meta calls finish or time out.
2. **WAL-checkpoint + freeze** the SQLite outbox; record the status cursor and the in-flight job set.
3. **Reconcile in-flight by `meta_message_id`** against the gateway/Meta: any job already
   **≥ `AcceptedByMeta` MUST NOT be re-sent** (mark Sent/terminal); only truly un-accepted jobs may re-queue.
4. **Then** switch the transport flag. Resume the chosen path only after reconciliation completes.

## Rollback ladder (least → most invasive) — all run the reconcile procedure first
1. **Config rollback (fastest):** reconcile → set `DigitalInvoiceSendTransport=ManualDesktop` (reverts to the
   manual flow) or `EnableDigitalInvoiceSend=0` (disables digital send). No binary change.
2. **Bridge rollback:** reconcile → stop the service → restore previous Bridge binaries. **Do NOT restore a
   stale SQLite snapshot blindly** — only restore with an **idempotency-keyed merge** (unique `local_job_id` /
   `meta_message_id`) so newer jobs aren't lost and accepted jobs aren't replayed → start → verify health.
3. **Helper rollback:** close POS → restore previous `PunnelifosysResApp.DigitalInvoice.dll` → verify SHA-256
   → start POS → clone **Pay & Print** smoke. (DLL-only; no re-patch.) Ensure the Bridge sender is drained first.
4. **Full Branch rollback:** close all Branch processes → restore the full backup over `ZKDebug\` → verify
   hashes → **confirm Server EXE untouched** → smoke: login / payment / kitchen / paper / ZATCA.
5. **Cloud rollback:** deploy the previous Worker version; preserve D1 history + mappings; disable new
   registrations if needed. Local sending may continue (fail-closed cost policy) while status sync is delayed.

## Rules
- Payment success never depends on WhatsApp — rollback never risks payment data.
- No DB change is required to roll back behavior (flags + binaries + reconcile only).
- **Never** restore a stale queue snapshot without an explicit idempotency-keyed merge/reconciliation.
- Re-verify SHA-256 after any restore; re-run `Tests.exe` / `PngTests.exe` for the Helper.
- Rehearse the full ladder (incl. reconcile + no-double-send) on the clone before the pilot (BG-8 gate).
