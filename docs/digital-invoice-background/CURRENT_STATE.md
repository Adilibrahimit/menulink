# Current State — Digital Invoice (verified baseline)

> BG-0 evidence. Audit date 2026-06-08. Clone-only. Fresh evidence (not old PASS claims).
> Cross-ref proof: `docs/proofs/BG-0-background-whatsapp-baseline.md`.

## Clone identity (verified)
- `hostname` = **DESKTOP-KUT35C6** (the documented disposable clone).
- `SELECT DB_NAME(), @@SERVERNAME` → **`client` / `DESKTOP-KUT35C6`** (sa, read-only).
- This is **not** production. Real tills have their own `client` DBs.

## Binaries (live SHA-256 == manifest_after / manifest_before)
| Artifact | Path | SHA-256 |
|---|---|---|
| Patched Branch EXE | `C:\RZRZ-CODE\Branch-RES\ZKDebug\PunnelifosysResApp.exe` | `3B6B5C47…3786C09E` |
| Helper DLL | `…\ZKDebug\PunnelifosysResApp.DigitalInvoice.dll` | `E6B7C531…EFF6779B` |
| Original (backup) EXE | `…\_backup_pre-digital-invoice_20260607_232753\PunnelifosysResApp.exe` | `FF1A3CB5…458ED0CD` |
| Server EXE (untouched) | `C:\RZRZ-CODE\SERVER\Debug\PunnelifosysResAppServer.exe` | `A963699D…6707A174` (dated 2025-03-24) |
- Flag (`…\ZKDebug\PunnelifosysResApp.exe.config:32`): `EnableDigitalInvoiceSend = "1"`.
- Backup `manifest_before.txt` + `manifest_after.txt` present and consistent with live hashes.

## Current behavior (verified from source)
Helper `C:\RZRZ-CODE\Branch-RES\DigitalInvoiceHelper\DigitalInvoice.cs`:
- `SaveInvoicePng` → PNG (`ImageFormat.Png`, line 185); **multi-page** via `GetPreviewPageInfo` (208).
- `NormalizeSaudiWhatsApp` → `9665XXXXXXXX`.
- `CopyImageToClipboard` → STA + retries, `Clipboard.SetDataObject(…, true)` (482).
- `OpenWhatsApp` → `whatsapp://send` (517) → `wa.me` → `api.whatsapp.com`, via `Process.Start(UseShellExecute=true)` (524).
- Blocking instruction `MessageBox` after launch.
- `SendModeHook(PrintPageEventHandler, ComboBox, int zatcaPhase, int lang, string mobileRaw, string companyName, string invoiceNo, string total, Guid invoiceId)` (636); **`if (zatcaPhase == 2) return false;` print-only fallback (645)**.
- Completion-mode logging → `dbo.DigitalInvoiceLog` (no success/fail status column) + `dbo.vw_DigitalInvoiceModeCounts`.

Patch `Patcher.cs` (Branch `frmPayment` only; Server EXE untouched):
- Adds **only** `_paymentPersisted` (44).
- Reset `=false` in `frmPayment_Load` (62); **entry guard** `if (_paymentPersisted) return` (`Brfalse`, 99); **set `=true` immediately after `InsertPaymentDetails`** (109); 1D send block injected **before `Sales.InvoiceID = Guid.Empty`** (174). `_payInProgress` / `_saleFinalized` / `_paymentCommitted` = **not implemented**.

Payment idempotency: the script shows **UPSERT on InvoiceID** — `if not exists (select InvoiceID from PaymentDetails where InvoiceID=@InvoiceID) insert … else update PaymentDetails … ` (script `…SCREPIT\2025\3\…\2.InsertPaymentDetails.sql:130/132/179`). **This is script-level evidence only.** The **live** sproc is `WITH ENCRYPTION` (definition not readable via `sys.sql_modules`) and the runtime duplicate-payment test has not been run, so deployed idempotency is **NOT VERIFIED** (per Codex review correction #5) — pending the BG-0 clone duplicate-payment runtime test.

Post-persist order (decompiled `frmPayment.btnSave_Click`): `InsertPaymentDetails` → `InsertPointDetails` (dead: PointOfSalePercent=0) → kitchen print (always) → customer receipt (skipped iff SendOnly) → `SyncToGoogleApi` (conditional) → **send hook** → `Sales.InvoiceID=Guid.Empty` (~4178) → table updates / Close / navigation.

ZATCA: Phase-1 QR = deterministic TLV; Phase-2 QR/`InvoiceXML`/`InvoiceHash` persisted in `ZatcaReportingDetails` (reuse, never re-sign).

## Fresh test results (2026-06-08, headless)
- `Tests.exe` → **passed=56 failed=0** (exit 0).
- `PngTests.exe` → **pass=14 fail=0** (exit 0); QR decoded (Phase-1 TLV: RZRZ Bukhari / VAT 311750526500003 / total 40.00 / VAT 5.22); multi-page 1page=1977px, 2page=8587px; ~118 KB.

## NOT VERIFIED this pass (no fresh evidence — not run)
- Live UI smokes: Pay&Print, Pay&Send, Pay&Print+Send, duplicate-payment via the touch UI (require an interactive POS-operate session that writes payments to the clone DB; deliberately not blind-automated in BG-0).
- ZATCA Phase-2 print-only behavior end-to-end on the running app (code path verified; runtime not exercised).
- "Missing Helper" and "flag-disabled" runtime behaviors (verified by code, not executed).

## Not implemented (planned)
Background send, Bridge SQLite outbox, headless renderer, direct Meta Cloud API, Cloudflare Worker + D1, webhook, status sync, customer-service-window tracking, English/bilingual digital send, send-outcome status. (`0072_digital_invoice_send_queue.sql` exists, untracked, unapplied — **superseded**, not part of this architecture.)
