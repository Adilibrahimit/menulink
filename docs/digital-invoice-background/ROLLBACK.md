# Rollback & Backup

## Backup to capture before any change (BG-6 / BG-8)
Branch app folder · Helper DLL · Bridge binaries · sanitized Bridge config · SQLite backup · Worker source
+ deployed version · D1 migration version · SHA-256 manifests · feature-flag values · service-install config.

## Known-good baseline (verified 2026-06-08)
- Patched Branch EXE `3B6B5C47…3786C09E` · Helper `E6B7C531…EFF6779B` · **original** EXE
  `FF1A3CB5…458ED0CD` (in `…\_backup_pre-digital-invoice_20260607_232753\`, full app copy + manifests) ·
  Server EXE `A963699D…6707A174` (must remain unchanged).

## Rollback ladder (least → most invasive)
1. **Config rollback (fastest):** set `DigitalInvoiceSendTransport=ManualDesktop` (reverts to today's
   manual flow) or `EnableDigitalInvoiceSend=0` (disables digital send). No binary change.
2. **Bridge rollback:** stop the Windows Service → restore previous Bridge binaries + a compatible SQLite
   backup → start → verify health. (Local jobs persist in SQLite.)
3. **Helper rollback:** close POS → restore previous `PunnelifosysResApp.DigitalInvoice.dll` → verify
   SHA-256 → start POS → run a clone **Pay & Print** smoke. (DLL-only; no re-patch.)
4. **Full Branch rollback:** close all Branch processes → restore the full backup folder over `ZKDebug\`
   → verify hashes → **confirm Server EXE untouched** → smoke: login / payment / kitchen / paper / ZATCA.
5. **Cloud rollback:** deploy the previous Worker version; preserve D1 history + mappings; disable new
   registrations if needed. Local sending may continue while status sync is delayed.

## Rules
- Payment success never depends on WhatsApp — rollback never risks payment data.
- No DB change is required to roll back behavior (flags + binaries only).
- Re-verify SHA-256 after any restore; re-run `Tests.exe` / `PngTests.exe` for the Helper.
- Rehearse the full ladder on the clone before the pilot (BG-8 gate).
