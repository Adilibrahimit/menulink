using Microsoft.Extensions.Configuration;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// BG-1 render-parity spike CLI:
///   dotnet run -- render-invoice &lt;InvoiceID&gt; [ar|en|bi] [outDir]
/// Loads the invoice from the POS DB (Pos:ConnectionString), renders PDF + PNG headless,
/// and prints a verification summary (totals + ZATCA QR payload). Does NOT start the service
/// and does NOT touch the POS or deployed Helper.
/// </summary>
public static class RenderSpikeCommand
{
    public static int Run(string[] args, IConfiguration config)
    {
        try
        {
            if (args.Length < 2) { Console.Error.WriteLine("usage: render-invoice <InvoiceID> [ar|en|bi] [outDir]"); return 2; }
            var invoiceId = Guid.Parse(args[1]);
            var lang = (args.Length >= 3 ? args[2].ToLowerInvariant() : "ar") switch
            {
                "en" => RenderLanguage.English,
                "bi" => RenderLanguage.Bilingual,
                _ => RenderLanguage.Arabic
            };
            string outDir = args.Length >= 4 ? args[3] : Path.Combine(Path.GetTempPath(), "bg1-render");
            Directory.CreateDirectory(outDir);

            string conn = config["Pos:ConnectionString"]
                ?? throw new InvalidOperationException("Pos:ConnectionString missing in config");

            // Company header (not in the invoice DB) — from config DigitalInvoice:Company, else clone defaults.
            var company = new CompanyProfile
            {
                NameEn = config["DigitalInvoice:Company:NameEn"] ?? "RZRZ Bukhari",
                NameAr = config["DigitalInvoice:Company:NameAr"] ?? "رزرز بخاري",
                AddressEn = config["DigitalInvoice:Company:AddressEn"] ?? "",
                AddressAr = config["DigitalInvoice:Company:AddressAr"] ?? "",
                VatNumber = config["DigitalInvoice:Company:VatNumber"] ?? "311750526500003",
                Phone = config["DigitalInvoice:Company:Phone"] ?? "",
                LogoPath = config["DigitalInvoice:Company:LogoPath"],
                VatPercent = decimal.TryParse(config["DigitalInvoice:Company:VatPercent"], out var vp) ? vp : 15m,
                ThermalWidthMm = int.TryParse(config["DigitalInvoice:Company:ThermalWidthMm"], out var w) ? w : 80,
            };

            var model = new InvoiceDataLoader(conn).Load(invoiceId, lang, company);
            var renderer = new InvoicePdfRenderer();
            byte[] pdf = renderer.RenderPdf(model);
            byte[] png = renderer.RenderPng(model);

            string stamp = model.CreatedDate == DateTime.MinValue ? "" : model.CreatedDate.ToString("yyyyMMddHHmmss");
            string baseName = $"INV-{model.BillNo}-{lang}-{stamp}";
            string pdfPath = Path.Combine(outDir, baseName + ".pdf");
            string pngPath = Path.Combine(outDir, baseName + ".png");
            File.WriteAllBytes(pdfPath, pdf);
            File.WriteAllBytes(pngPath, png);

            string qr = ZatcaQr.BuildPayload(model);
            bool phase2 = !string.IsNullOrWhiteSpace(model.PersistedQr);

            Console.WriteLine("=== BG-1 render-parity spike ===");
            Console.WriteLine($"InvoiceNo={model.InvoiceNo}  BillNo={model.BillNo}  lang={lang}  items={model.Items.Count}");
            Console.WriteLine($"NetExclVat={model.NetExclVat:F2}  VAT={model.VatAmount:F2}  TotalInclVat={model.TotalInclVat:F2}  Cash={model.Cash:F2} Card={model.Card:F2}");
            Console.WriteLine($"ZATCA QR source={(phase2 ? "PERSISTED Phase-2 (reused, not re-signed)" : "Phase-1 TLV (regenerated)")}");
            Console.WriteLine($"ZATCA QR base64={qr}");
            Console.WriteLine($"PDF  -> {pdfPath}  ({pdf.Length} bytes)");
            Console.WriteLine($"PNG  -> {pngPath}  ({png.Length} bytes)");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("render-invoice FAILED: " + ex);
            return 1;
        }
    }
}
