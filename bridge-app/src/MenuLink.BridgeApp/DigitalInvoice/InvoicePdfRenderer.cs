using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// Headless invoice renderer (BG-1). QuestPDF → SkiaSharp+HarfBuzz handles Arabic shaping/bidi.
/// Thermal-width continuous receipt that reproduces the POS-printed simplified-tax-invoice layout
/// (logo → header → order-type icon + number → items + مجموع → الخصم/الإجمالي/المقبوض/المتبقي →
/// صافي/ضريبة/الدفع → time + printed-by → thanks → ZATCA QR). AR / EN / bilingual; PNG fallback.
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

    // ---- order-type icon (currently only the TakeAway bag is bundled) ----
    private static byte[]? _bagIcon; private static bool _bagTried;
    private static byte[]? OrderTypeIcon(int t)
    {
        if (t != 0) return null;
        if (!_bagTried)
        {
            _bagTried = true;
            try
            {
                string p = Path.Combine(AppContext.BaseDirectory, "DigitalInvoice", "assets", "order_takeaway.png");
                if (File.Exists(p)) _bagIcon = File.ReadAllBytes(p);
            }
            catch { /* icon optional */ }
        }
        return _bagIcon;
    }
    private static string OrderTypeAr(int t) => t switch { 0 => "سفري", 1 => "محلي", 3 => "توصيل", 4 => "هاتف", 6 => "صالة", 10 => "سيارة", 11 => "موقع الكتروني", _ => "" };
    private static string OrderTypeEn(int t) => t switch { 0 => "Take Away", 1 => "Dine In", 3 => "Delivery", 4 => "Telephone", 6 => "Hall", 10 => "Car", 11 => "Online", _ => "" };

    private static IDocument BuildDoc(InvoiceRenderModel m)
    {
        bool ar = m.Language != RenderLanguage.English;
        bool bi = m.Language == RenderLanguage.Bilingual;
        string qrPayload = ZatcaQr.BuildPayload(m);
        byte[] qrPng = ZatcaQr.RenderPng(qrPayload, 6);
        float widthPt = m.Company.ThermalWidthMm * 72f / 25.4f;
        var ci = CultureInfo.InvariantCulture;
        string N2(decimal v) => v.ToString("N2", ci);
        string Num(decimal v) => v.ToString("0.##", ci);
        string cur = ar ? m.Company.CurrencyAr : m.Company.CurrencyEn;

        byte[]? logo = m.Company.LogoBytes;
        if (logo == null && !string.IsNullOrWhiteSpace(m.Company.LogoPath) && File.Exists(m.Company.LogoPath))
            logo = File.ReadAllBytes(m.Company.LogoPath!);
        byte[]? icon = OrderTypeIcon(m.InvoiceType);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.ContinuousSize(widthPt);
                page.MarginHorizontal(6);
                page.MarginVertical(8);
                page.DefaultTextStyle(t => t.FontFamily("Tahoma").FontSize(9).LineHeight(1.18f));

                page.Content().Element(e =>
                {
                    var root = ar ? e.ContentFromRightToLeft() : e.ContentFromLeftToRight();
                    root.Column(col =>
                    {
                        col.Spacing(1.5f);

                        // ---------------- header (centered) ----------------
                        if (logo != null) col.Item().AlignCenter().MaxWidth(140).Image(logo);
                        col.Item().AlignCenter().Text(ar ? m.Company.NameAr : m.Company.NameEn).Bold().FontSize(13);
                        if (bi && m.Company.NameEn.Length > 0) col.Item().AlignCenter().Text(m.Company.NameEn).FontSize(9);
                        string a1 = ar ? m.Company.AddressAr : m.Company.AddressEn;
                        string a2 = ar ? m.Company.Address2Ar : m.Company.Address2En;
                        if (a1.Length > 0) col.Item().AlignCenter().Text(a1).FontSize(8.5f);
                        if (a2.Length > 0) col.Item().AlignCenter().Text(a2).FontSize(8.5f);
                        if (m.Company.Phone.Length > 0) col.Item().AlignCenter().Text(m.Company.Phone).FontSize(8.5f);
                        if (m.Company.VatNumber.Length > 0)
                            col.Item().AlignCenter().Text((ar ? "رقم سجل ضريبة القيمة المضافة:" : "VAT Reg No: ") + m.Company.VatNumber).FontSize(8.5f);
                        col.Item().AlignCenter().Text(ar ? "فاتورة ضريبية مبسطة" : "Simplified Tax Invoice").Bold().FontSize(10.5f);

                        // ---------------- order-type icon + big (daily) number ----------------
                        col.Item().PaddingTop(2).AlignLeft().Element(x => x.ContentFromLeftToRight().Row(r =>
                        {
                            if (icon != null) r.ConstantItem(50).AlignMiddle().Image(icon);
                            if (icon != null) r.ConstantItem(10);
                            r.AutoItem().AlignMiddle().Text(m.InvoiceNo.ToString()).Bold().FontSize(28);
                        }));

                        // ---------------- invoice number ----------------
                        col.Item().PaddingTop(2).Text(t =>
                        {
                            t.Span(ar ? "رقم الفاتورة  : " : "Invoice No : ");
                            t.Span(m.BillNo.ToString()).SemiBold();
                        });

                        // ---------------- items ----------------
                        col.Item().PaddingTop(2).Table(tb =>
                        {
                            tb.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(0.5f);  // #
                                c.RelativeColumn(2.4f);  // name
                                c.RelativeColumn(0.85f); // qty
                                c.RelativeColumn(1.05f); // price
                                c.RelativeColumn(1.25f); // total
                            });
                            tb.Header(h =>
                            {
                                h.Cell().Text("#").SemiBold().FontSize(8f);
                                h.Cell().Text(ar ? "الصنف" : "Item").SemiBold().FontSize(8f);
                                h.Cell().AlignCenter().Text(ar ? "الكمية" : "Qty").SemiBold().FontSize(8f);
                                h.Cell().AlignCenter().Text(ar ? "السعر" : "Price").SemiBold().FontSize(8f);
                                h.Cell().AlignCenter().Text(ar ? "الإجمالي" : "Total").SemiBold().FontSize(8f);
                            });
                            int idx = 0;
                            foreach (var it in m.Items)
                            {
                                idx++;
                                string name = bi
                                    ? $"{(it.NameAr.Length > 0 ? it.NameAr : it.NameEn)}\n{it.NameEn}"
                                    : (ar ? (it.NameAr.Length > 0 ? it.NameAr : it.NameEn) : (it.NameEn.Length > 0 ? it.NameEn : it.NameAr));
                                tb.Cell().Text(idx.ToString()).FontSize(8.5f);
                                tb.Cell().Text(name).FontSize(8.5f);
                                tb.Cell().AlignCenter().Text(Num(it.Quantity)).FontSize(8.5f);
                                tb.Cell().AlignCenter().Text(Num(it.Rate)).FontSize(8.5f);
                                tb.Cell().AlignCenter().Text(Num(it.Amount)).FontSize(8.5f);
                                string? note = bi ? (it.NotesAr ?? it.NotesEn) : (ar ? it.NotesAr : it.NotesEn);
                                if (!string.IsNullOrWhiteSpace(note))
                                    tb.Cell().ColumnSpan(5).PaddingLeft(6).Text("• " + note).Italic().FontSize(7.5f);
                            }
                        });
                        col.Item().LineHorizontal(0.7f);

                        // ---------------- مجموع (subtotal) ----------------
                        decimal totQty = 0m, totAmt = 0m;
                        foreach (var it in m.Items) { totQty += it.Quantity; totAmt += it.Amount; }
                        col.Item().Table(tb =>
                        {
                            tb.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(0.5f); c.RelativeColumn(2.4f); c.RelativeColumn(0.85f); c.RelativeColumn(1.05f); c.RelativeColumn(1.25f);
                            });
                            tb.Cell().Text("");
                            tb.Cell().Text(ar ? "مجموع" : "Subtotal").SemiBold().FontSize(8f);
                            tb.Cell().AlignCenter().Text(Num(totQty)).SemiBold().FontSize(8f);
                            tb.Cell().Text("");
                            tb.Cell().AlignCenter().Text(Num(totAmt)).SemiBold().FontSize(8f);
                        });

                        // ---------------- totals (left-aligned, POS style) ----------------
                        void Line(string label, decimal v, bool big = false)
                            => col.Item().PaddingTop(big ? 1f : 0f).AlignLeft().Text(t =>
                            {
                                t.DefaultTextStyle(s => big ? s.Bold().FontSize(13) : s.Bold().FontSize(9));
                                t.Span(label + " ");
                                t.Span(N2(v) + " " + cur);
                            });
                        Line(ar ? "الخصم" : "Discount", m.DiscountAmount);
                        Line(ar ? "الإجمالي" : "Total", m.TotalInclVat, big: true);
                        Line(ar ? "المقبوض" : "Paid", m.Received);
                        Line(ar ? "المتبقي" : "Remaining", m.Remaining);
                        col.Item().PaddingVertical(1).LineHorizontal(0.7f);

                        col.Item().AlignLeft().Text((ar ? "صافي الفاتورة قبل ضريبة القيمة المضافة : " : "Net before VAT : ") + N2(m.NetExclVat) + " " + cur).FontSize(8.5f);
                        col.Item().AlignLeft().Text((ar ? $"ضريبة القيمة المضافة ( {m.Company.VatPercent:0} % ) : " : $"VAT ( {m.Company.VatPercent:0}% ) : ") + N2(m.VatAmount) + " " + cur).FontSize(8.5f);
                        if (m.TobaccoVatAmount > 0)
                            col.Item().AlignLeft().Text((ar ? "ضريبة التبغ : " : "Tobacco VAT : ") + N2(m.TobaccoVatAmount) + " " + cur).FontSize(8.5f);
                        string payMethod = m.Card > 0 && m.Cash <= 0 ? (ar ? "شبكة" : "Card") : (ar ? "نقدي" : "Cash");
                        col.Item().AlignLeft().Text((ar ? $"الدفع - {payMethod} : " : $"Payment - {payMethod} : ") + N2(m.Received > 0 ? m.Received : m.TotalInclVat) + " " + cur).FontSize(8.5f);

                        // ---------------- footer ----------------
                        string dt = m.CreatedDate == DateTime.MinValue ? "" : m.CreatedDate.ToString("dd/MM/yyyy hh:mm:ss tt", ci);
                        if (dt.Length > 0)
                            col.Item().PaddingTop(3).AlignLeft().Text((ar ? "وقت الفاتورة - " : "Invoice Time - ") + dt).FontSize(8);
                        if (m.PrintedBy.Length > 0)
                            col.Item().AlignLeft().Text((ar ? "المطبوعة بواسطة - " : "Printed by - ") + m.PrintedBy + (dt.Length > 0 ? ", " + dt : "")).FontSize(8);
                        col.Item().PaddingTop(2).AlignCenter().Text(ar ? m.Company.ThanksAr : m.Company.ThanksEn).FontSize(9);
                        if (bi) col.Item().AlignCenter().Text(m.Company.ThanksEn).FontSize(8.5f);
                        col.Item().PaddingTop(4).AlignCenter().MaxWidth(150).Image(qrPng);
                    });
                });
            });
        });
    }
}
