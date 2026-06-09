# Proof — BG-0 Background WhatsApp Invoice Baseline

> Phase BG-0 (baseline revalidation + branch + docs). Date 2026-06-08. Clone-only, read-only evidence +
> documentation. No runtime/binary/DB/cloud/Meta/production change.

## Clone identity (hard-stop check PASSED)
- `hostname` = **DESKTOP-KUT35C6** (documented disposable clone).
- `SELECT DB_NAME(), @@SERVERNAME;` (sa, read-only) → **`client` / `DESKTOP-KUT35C6`** (2026-06-08 15:50).
- `@@SERVERNAME` (integrated auth) = `DESKTOP-KUT35C6`. `client` present in `sys.databases`. ⇒ proceed.

## Git state
- Repo `D:/menulink`. Base branch `rzrz-signature-steam` @ `dfb3dc50ad8bc90d0f78cbc35390969be54e972c`.
- New branch created: **`feat/background-whatsapp-invoice`** (off base HEAD).
- Working tree before commit: ~299 untracked / 10 modified (pre-existing `.graph` cache + skills + WIP,
  unrelated). Only BG-0 docs are staged/committed.

## Binary hashes (live SHA-256 — match manifest)
| Artifact | SHA-256 | Expected |
|---|---|---|
| Patched Branch EXE (`ZKDebug`) | `3B6B5C472D377897C98D42CAE83C2ABACC8A8511D5B935917E33449F3786C09E` | manifest_after ✅ |
| Helper DLL (`ZKDebug`) | `E6B7C5315BA86B69507EE76868CC56E6AE87A644C6003560823DCD34EFF6779B` | manifest_after ✅ |
| Original EXE (backup) | `FF1A3CB5C9C2D0F1A31BF0A635637F7646A4F034FE3E7446395E9979458ED0CD` | manifest_before ✅ |
| Server EXE | `A963699DD7D85EA51B74DD1338B2444E84F99F5C01237424FDCBBC236707A174` | unchanged (2025-03-24) ✅ |
- Flag `…\ZKDebug\PunnelifosysResApp.exe.config:32` → `EnableDigitalInvoiceSend = "1"`.
- `manifest_before.txt` + `manifest_after.txt` present.

## Fresh test results
- `…\DigitalInvoiceHelper\bin\Tests.exe` → **passed=56 failed=0** (exit 0).
- `…\bin\PngTests.exe` → **pass=14 fail=0** (exit 0); QR decoded (Phase-1 TLV: RZRZ Bukhari / VAT
  311750526500003 / 40.00 / 5.22); multi-page 1page=1977px, 2page=8587px; PNG ~118 KB.

## Source / behavior re-confirmed (fresh reads)
- Helper `DigitalInvoice.cs`: PNG `ImageFormat.Png` (185); multi-page `GetPreviewPageInfo` (208); clipboard
  `Clipboard.SetDataObject(...,true)` (482); `whatsapp://send` (517) + `Process.Start(UseShellExecute=true)`
  (524); `SendModeHook(...)` (636) with **`if (zatcaPhase==2) return false;`** (645).
- Patch `Patcher.cs`: field **`_paymentPersisted`** only (44); reset false in `frmPayment_Load` (62); entry
  guard `Brfalse` (99); set true after `InsertPaymentDetails` (109); 1D send block before `Guid.Empty` (174).
  `_payInProgress` / `_saleFinalized` / `_paymentCommitted` = absent.
- Idempotency: the **script** shows `InsertPaymentDetails` UPSERT — `if not exists (select InvoiceID from
  PaymentDetails where InvoiceID=@InvoiceID) … insert … else update PaymentDetails …`
  (`…SCREPIT\2025\3\…\2.InsertPaymentDetails.sql:130/132/179`). Live sproc is `WITH ENCRYPTION` (definition
  NULL via `sys.sql_modules`). **This is script-level only; deployed runtime idempotency is NOT VERIFIED**
  (Codex correction #5) until the clone duplicate-payment runtime test runs.

## Files created (this phase)
- `docs/digital-invoice-background/CURRENT_STATE.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`,
  `TEST_PLAN.md`, `SECURITY.md`, `CLOUDFLARE_GATEWAY.md`, `ROLLBACK.md`.
- `docs/proofs/BG-0-background-whatsapp-baseline.md` (this file).

## Files inspected (not modified)
`DigitalInvoice.cs`, `Patcher.cs`, `…exe.config`, `manifest_before/after.txt`, deployed/backup/server
binaries, `…\2.InsertPaymentDetails.sql`, `bridge-app/*`, decompiled `frmPayment.cs` (prior audit).

## Commands run (read-only)
`Get-FileHash` (SHA-256) · `Get-ChildItem` · `sqlcmd` SELECT-only (clone identity + sproc existence) ·
`Tests.exe` / `PngTests.exe` (headless) · `git checkout -b` · `Grep`/`Glob`.

## Contradictions found / corrected
- Package said "define/inject the send hook" — **already injected** (`SendModeHook` in helper, patched
  call site). ⇒ Helper-only cutover, no EXE re-patch.
- Earlier my plan claimed the system "sends when all clouds are down" — **corrected**: send needs Meta +
  internet; only local durability survives offline.
- Cloud layer = **Cloudflare Worker + D1** (Supabase/Vercel/MenuLink/Queues excluded). `0072` superseded
  (not applied, not deleted).

## Unresolved unknowns (carried to BG-1)
Headless **logo** source (byte[] in ActiveSession; not in invoice DB) · `GetItemsForPrintInvoice` column
completeness for EN/bilingual · Arabic-shaping PDF lib (QuestPDF vs itext7) + licensing · Bridge renderer
parity vs GDI+ · Bridge location per till vs branch server (spool locality) · Phase-2 QR reuse validated
end-to-end · company name/address source for headless render.

## NOT VERIFIED this pass (no fresh evidence; not run)
Live UI smokes — Pay&Print / Pay&Send / Pay&Print+Send / duplicate-payment via the touch UI — and runtime
ZATCA-P2 fallback, missing-Helper, flag-disabled behavior. These require an interactive POS-operate session
that writes to the clone DB; deliberately not blind-automated in BG-0. They validate the **current manual**
flow (which BG-6 replaces) and are **not** prerequisites for BG-1 (headless render spike). Run them in an
operate session before the BG-6 cutover / BG-8 pilot.

## Hard-stop findings
None triggered. Clone identity confirmed; binaries intact; payment idempotent **at script level (runtime
test pending — correction #5)**; ZATCA Phase-2 reuse path exists. The render-parity hard stop belongs to
**BG-1** (not evaluated here by design).

## Duplicate-payment runtime test — PASSED (2026-06-09, user-assisted on clone)
Method: read-only XE trace `rzrz_trace` running; user performed ONE anonymous cash sale and **double-tapped
موافق** on `frmPayment`; verified via DB + trace; trace session dropped afterward.
- New sale **BillNo 33931** / InvoiceID `9C89D502-2B04-421D-92E6-F7D6AE4A34C7` → **exactly 1** `PaymentDetails`
  row (Invoice 33930→33931 = +1; PaymentDetails 34255→34256 = +1). No duplicate.
- Trace: `InsertPaymentDetails` fired **once** (`@CounterID=6,@PaidAmount=40.00`); `InsertInvoice` once. ⇒ the
  runtime **`_paymentPersisted` UI guard blocked the second tap** before any second DB call.
- **Residual (honest):** because the UI guard fired first, the sproc's own UPSERT backstop was not exercised
  *in isolation* this run; it remains script-level (`…2.InsertPaymentDetails.sql`, `IF NOT EXISTS…ELSE UPDATE`).
  The operational guarantee (a cashier double-tap cannot create a second payment) IS runtime-verified.

## Verdict
**BG-0 PASS — READY FOR BG-1** (upgraded from PARTIAL; Codex correction #5 closed by the runtime test above).
Baseline binaries/hashes re-verified; Helper/PNG tests 56/56·14/14 fresh; dedicated branch created;
architecture/safety/test/rollback/Cloudflare docs written **and corrected** for all five Codex findings
(ECDSA auth, reconcile-rollback + single-active-transport, `/window` lookup, webhook-before-register
reconciliation, idempotency now runtime-verified). Other live UI smokes (Pay&Send/+Send happy-path) remain
NOT VERIFIED but do not block BG-1 (headless render spike). **BG-1 not started.**
