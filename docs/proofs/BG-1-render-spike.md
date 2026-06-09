# Proof — BG-1 Headless Render-Parity Spike

> Date 2026-06-09. Clone-only, read-only DB access (GetItemsForPrintInvoice, rolled-back). The POS and
> deployed Helper were NOT modified. Build: `dotnet build` 0 errors (.NET 10.0.103).

## What was built (bridge-app, co-hosted, not deployed)
`bridge-app/src/MenuLink.BridgeApp/DigitalInvoice/`:
- `InvoiceModels.cs` — `CompanyProfile` (config-sourced header: name/address/logo/VAT% — NOT in the invoice
  DB), `InvoiceRenderModel`, `InvoiceLineItem`, `RenderLanguage{English,Arabic,Bilingual}`.
- `InvoiceDataLoader.cs` — loads the model by `InvoiceID` via `dbo.GetItemsForPrintInvoice(@InvoiceID,@Language)`
  (same sproc the POS print path uses); reads the `QR` column for Phase-2 reuse.
- `ZatcaQr.cs` — Phase-1 deterministic TLV (tags 1–5) + QRCoder PNG; **reuses persisted Phase-2 QR verbatim
  (never re-signs)**.
- `InvoicePdfRenderer.cs` — QuestPDF (SkiaSharp+HarfBuzz → Arabic shaping/bidi); thermal-width continuous
  receipt; AR/EN/bilingual; QuestPDF pagination (multi-page); PNG fallback via `GenerateImages`.
- `RenderSpikeCommand.cs` + Program.cs CLI: `dotnet run -- render-invoice <InvoiceID> [ar|en|bi] [outDir]`
  (early-exit; does not start the service).

## Result (clone invoice BillNo 33931 / `9C89D502…`)
All three languages rendered PDF + PNG successfully:
- Totals correct: NetExclVat **34.78**, VAT **5.22**, TotalInclVat **40.00**, Cash 40.00.
- ZATCA Phase-1 TLV decoded clean: `tag1=RZRZ Bukhari · tag2=311750526500003 · tag3=2026-06-09T06:41:00Z ·
  tag4=40.00 · tag5=5.22`.
- Files: `INV-33931-{Arabic|English|Bilingual}-….pdf` (42–58 KB) + `.png` (37–42 KB) in `%TEMP%\bg1-render\`.

## Verdict: BG-1 FEASIBLE — proceed, with calibration items
A headless service can reconstruct the invoice (data, totals, numbers, AR/EN/bilingual, multi-page) and a
valid ZATCA QR from committed DB data + config. **Residual calibration before BG-6 cutover:**
1. **QR byte-parity:** `CompanyProfile.NameEn` and the timestamp format must be configured to exactly match
   the POS `ActiveSession.CompanyName` + its TLV timestamp (the POS seller string was 14 bytes vs the spike
   default 12). Functionally valid now; byte-identical needs config alignment.
2. **Visual parity:** a human must eyeball the generated PDF/PNG for Arabic shaping + thermal layout vs a
   real POS receipt (acceptance check — cannot be auto-asserted headless).
3. **Multi-page:** verified-by-design (QuestPDF paginates); exercised with 1 item — re-test with a long
   invoice before cutover.
4. **Phase-2 reuse:** coded (`PersistedQr`); not exercised (clone is ZATCA Phase-1, QR column empty). Re-test
   on a Phase-2 invoice.
