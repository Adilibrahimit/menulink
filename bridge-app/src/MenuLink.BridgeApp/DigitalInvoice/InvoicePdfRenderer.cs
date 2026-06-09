using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// Headless invoice renderer (BG-1). QuestPDF → SkiaSharp+HarfBuzz handles Arabic shaping/bidi.
/// Thermal-width continuous receipt; AR / EN / bilingual; multi-page via QuestPDF pagination;
/// ZATCA QR (Phase-1 regenerated TLV or persisted Phase-2). PNG fallback via GenerateImages.
/// </summary>
public sealed class InvoicePdfRenderer
{
    private static int _licensed;
    private static void EnsureLicense()
    {
        if (System.Threading.Interlocked.Exchange(ref _licensed, 1) == 0)
            QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] RenderPdf(InvoiceRenderModel m)
    {
        EnsureLicense();
        return BuildDoc(m).GeneratePdf();
    }

    /// <summary>PNG fallback — first page rasterised at thermal-printer DPI.</summary>
    public byte[] RenderPng(InvoiceRenderModel m, int dpi = 203)
    {
        EnsureLicense();
        foreach (var img in BuildDoc(m).GenerateImages(new ImageGenerationSettings { ImageFormat = ImageFormat.Png, RasterDpi = dpi }))
            return img; // first page
        return Array.Empty<byte>();
    }

    private static IDocument BuildDoc(InvoiceRenderModel m)
    {
        bool ar = m.Language != RenderLanguage.English;
        bool bi = m.Language == RenderLanguage.Bilingual;
        string qrPayload = ZatcaQr.BuildPayload(m);
        byte[] qrPng = ZatcaQr.RenderPng(qrPayload, 6);
        float widthPt = m.Company.ThermalWidthMm * 72f / 25.4f;
        var ci = CultureInfo.InvariantCulture;
        string Money(decimal v) => v.ToString("N2", ci);
        string cur = ar ? m.Company.CurrencyAr : m.Company.CurrencyEn;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.ContinuousSize(widthPt);
                page.MarginHorizontal(6);
                page.MarginVertical(8);
                page.DefaultTextStyle(t => t.FontFamily("Tahoma").FontSize(8.5f).LineHeight(1.15f));

                page.Content().Element(e =>
                {
                    var root = ar ? e.ContentFromRightToLeft() : e.ContentFromLeftToRight();
                    root.Column(col =>
                    {
                        col.Spacing(2);

                        // header
                        if (!string.IsNullOrWhiteSpace(m.Company.LogoPath) && File.Exists(m.Company.LogoPath))
                            col.Item().AlignCenter().MaxWidth(120).Image(m.Company.LogoPath!);
                        col.Item().AlignCenter().Text(ar ? m.Company.NameAr : m.Company.NameEn).Bold().FontSize(12);
                        if (bi && m.Company.NameEn.Length > 0)
                            col.Item().AlignCenter().Text(m.Company.NameEn).FontSize(9);
                        string addr = ar ? m.Company.AddressAr : m.Company.AddressEn;
                        if (addr.Length > 0) col.Item().AlignCenter().Text(addr).FontSize(8);
                        if (m.Company.VatNumber.Length > 0)
                            col.Item().AlignCenter().Text((ar ? "الرقم الضريبي: " : "VAT No: ") + m.Company.VatNumber).FontSize(8);
                        col.Item().AlignCenter().Text(ar ? "فاتورة ضريبية مبسطة" : "Simplified Tax Invoice").SemiBold().FontSize(9.5f);
                        col.Item().LineHorizontal(0.5f);

                        // meta
                        void Meta(string a, string en, string val) =>
                            col.Item().Row(r => { r.RelativeItem().Text(ar ? a : en).FontSize(8);
                                                  r.AutoItem().Text(val).SemiBold().FontSize(8); });
                        Meta("رقم الفاتورة", "Invoice No", m.BillNo.ToString());
                        Meta("التاريخ", "Date", m.InvoiceDateText.Length > 0 ? m.InvoiceDateText : m.CreatedDate.ToString("dd MMM yyyy HH:mm", ci));
                        Meta("الكاشير", "Cashier", m.UserName);
                        if (!string.IsNullOrWhiteSpace(m.OnlineBillNo)) Meta("رقم الطلب", "Order No", m.OnlineBillNo!);
                        col.Item().LineHorizontal(0.5f);

                        // items
                        col.Item().Table(t =>
                        {
                            t.ColumnsDefinition(c => { c.RelativeColumn(3); c.RelativeColumn(1); c.RelativeColumn(1.3f); c.RelativeColumn(1.3f); });
                            t.Header(h =>
                            {
                                h.Cell().Text(ar ? "الصنف" : "Item").SemiBold().FontSize(8);
                                h.Cell().AlignCenter().Text(ar ? "كمية" : "Qty").SemiBold().FontSize(8);
                                h.Cell().AlignRight().Text(ar ? "السعر" : "Price").SemiBold().FontSize(8);
                                h.Cell().AlignRight().Text(ar ? "المبلغ" : "Amount").SemiBold().FontSize(8);
                            });
                            foreach (var it in m.Items)
                            {
                                string name = bi
                                    ? $"{(it.NameAr.Length > 0 ? it.NameAr : it.NameEn)}\n{it.NameEn}"
                                    : (ar ? (it.NameAr.Length > 0 ? it.NameAr : it.NameEn) : (it.NameEn.Length > 0 ? it.NameEn : it.NameAr));
                                t.Cell().Text(name).FontSize(8);
                                t.Cell().AlignCenter().Text(it.Quantity.ToString("0.##", ci)).FontSize(8);
                                t.Cell().AlignRight().Text(Money(it.Rate)).FontSize(8);
                                t.Cell().AlignRight().Text(Money(it.Amount)).FontSize(8);
                                string? note = bi ? (it.NotesAr ?? it.NotesEn) : (ar ? it.NotesAr : it.NotesEn);
                                if (!string.IsNullOrWhiteSpace(note))
                                    t.Cell().ColumnSpan(4).PaddingLeft(6).Text("• " + note).Italic().FontSize(7);
                            }
                        });
                        col.Item().LineHorizontal(0.5f);

                        // totals
                        void Tot(string a, string en, decimal v, bool bold = false)
                            => col.Item().Row(r =>
                            {
                                var l = r.RelativeItem().Text(ar ? a : en).FontSize(bold ? 10 : 8);
                                if (bold) l.Bold();
                                var rt = r.AutoItem().Text($"{Money(v)} {cur}").FontSize(bold ? 10 : 8);
                                if (bold) rt.Bold();
                            });
                        Tot("الإجمالي قبل الضريبة", "Total (excl. VAT)", m.NetExclVat);
                        if (m.DiscountAmount > 0) Tot("الخصم", "Discount", m.DiscountAmount);
                        Tot($"ضريبة القيمة المضافة ({m.Company.VatPercent:0}%)", $"VAT ({m.Company.VatPercent:0}%)", m.VatAmount);
                        if (m.TobaccoVatAmount > 0) Tot("ضريبة التبغ", "Tobacco VAT", m.TobaccoVatAmount);
                        Tot("الإجمالي", "Total", m.TotalInclVat, bold: true);
                        if (m.Cash > 0) Tot("نقدي", "Cash", m.Cash);
                        if (m.Card > 0) Tot("شبكة", "Card", m.Card);
                        col.Item().LineHorizontal(0.5f);

                        // ZATCA QR + thanks
                        col.Item().AlignCenter().PaddingTop(4).MaxWidth(110).Image(qrPng);
                        col.Item().AlignCenter().PaddingTop(4).Text(ar ? m.Company.ThanksAr : m.Company.ThanksEn).FontSize(8.5f);
                        if (bi) col.Item().AlignCenter().Text(m.Company.ThanksEn).FontSize(8);
                    });
                });
            });
        });
    }
}
