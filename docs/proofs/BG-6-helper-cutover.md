# Proof — BG-6 Helper DLL-only Cutover

> Date 2026-06-09. Clone only. The POS **EXE was NOT re-patched** and **nothing was deployed** — the
> deployed `…\ZKDebug\` binaries are byte-identical to before (helper `E6B7C531…`, exe `3B6B5C47…`).

## Change (source only, at `C:\RZRZ-CODE\Branch-RES\DigitalInvoiceHelper\DigitalInvoice.cs`)
`SendModeHook` gains a **single-active-transport** branch right after the ZATCA Phase-2 check:
- `GetSendTransport()` reads app-config `DigitalInvoiceSendTransport`, **default `ManualDesktop`**
  (⇒ current manual flow is byte-for-byte unchanged when the key is absent/legacy).
- `BackgroundBridge` ⇒ `WriteSpoolJob(...)` writes an atomic JSON spool job (tmp→rename) to
  `%ProgramData%\PunnelifosysDigitalInvoice\spool\incoming\` and **returns immediately** — no clipboard,
  no `Process.Start`, no `whatsapp://`, no blocking MessageBox on the cashier thread.
- `WriteSpoolJob` + `J` (JSON escape) are new; FW 4.7.2-safe (no NuGet), never throw (failures → recovery log).
- Signature of `SendModeHook` is **unchanged** ⇒ the existing dnlib IL patch still calls it as-is — **no EXE
  re-patch** (the hook already carries invoiceId/billNo/phone/lang/mode).

## Verification
1. **Compiles on FW 4.7.2:** `csc … /out:%TEMP%\bg6-helper\…DigitalInvoice.dll` → exit 0 (temp output; deployed DLL untouched).
2. **Deployed unchanged:** live SHA-256 of `…\ZKDebug\PunnelifosysResApp.DigitalInvoice.dll` = `E6B7C531…779B`,
   `…\PunnelifosysResApp.exe` = `3B6B5C47…C09E` — identical to baseline (no deploy).
3. **Helper→Bridge contract, end-to-end:** a harness compiled against the new DLL called `WriteSpoolJob` →
   emitted a real job; the Bridge `import-spool` parsed+imported it: `imported=1 duplicates=0 quarantined=0`,
   fields `invoiceId=982260c9… bill=33931 phone=966500000001 lang=ar mode=SendOnly`. The Helper JSON exactly
   matches the Bridge `SendJob` contract.

## Gate: PASS — no EXE diff, Helper-only, spool persists before InvoiceID reset (hook position unchanged),
POS returns immediately on BackgroundBridge, no WhatsApp Desktop/clipboard/MessageBox. Default ManualDesktop.
**Remaining for live cutover (BG-7/pilot):** on the clone, set app-config `DigitalInvoiceSendTransport=BackgroundBridge`
+ build/deploy the helper DLL (with backup + manifest + PEVerify/JitCheck per the existing runbook), with the
Bridge sender enabled and pointed at the deployed gateway + a provisioned Meta token. The helper source lives
at `C:\RZRZ-CODE\…` (outside this repo); the exact edit is recorded above.
