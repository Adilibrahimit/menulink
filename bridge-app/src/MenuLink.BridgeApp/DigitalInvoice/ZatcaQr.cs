using System.Text;
using QRCoder;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// ZATCA Phase-1 QR = Base64 of a TLV blob (tags 1..5). Deterministic, so the Bridge can
/// reproduce exactly what the POS would print. For Phase-2 the signed QR is already persisted
/// (model.PersistedQr) and MUST be reused verbatim — never re-signed (preserves sign-once).
///
/// TLV tag order matches the POS (CommonBusiness): 1 seller name, 2 VAT reg, 3 timestamp,
/// 4 invoice total (incl VAT), 5 VAT total.
/// </summary>
public static class ZatcaQr
{
    /// <summary>Returns the Base64 QR payload for the invoice (persisted Phase-2 if present, else Phase-1 TLV).</summary>
    public static string BuildPayload(InvoiceRenderModel m)
    {
        if (!string.IsNullOrWhiteSpace(m.PersistedQr))
            return m.PersistedQr!.Trim();   // Phase-2 signed QR — reuse as-is

        // Phase-1: deterministic TLV. Seller name = English company name (matches POS TLV(1)).
        string seller = string.IsNullOrWhiteSpace(m.Company.NameEn) ? m.Company.NameAr : m.Company.NameEn;
        string ts = m.CreatedDate.ToString("yyyy-MM-ddTHH:mm:ssZ");
        string total = m.TotalInclVat.ToString("F2", System.Globalization.CultureInfo.InvariantCulture);
        string vat = m.VatAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture);

        using var ms = new MemoryStream();
        WriteTlv(ms, 1, seller);
        WriteTlv(ms, 2, m.Company.VatNumber);
        WriteTlv(ms, 3, ts);
        WriteTlv(ms, 4, total);
        WriteTlv(ms, 5, vat);
        return Convert.ToBase64String(ms.ToArray());
    }

    private static void WriteTlv(Stream s, byte tag, string value)
    {
        byte[] v = Encoding.UTF8.GetBytes(value ?? "");
        if (v.Length > 255) throw new InvalidOperationException($"ZATCA TLV tag {tag} value exceeds 255 bytes");
        s.WriteByte(tag);
        s.WriteByte((byte)v.Length);
        s.Write(v, 0, v.Length);
    }

    /// <summary>PNG bytes for the QR payload (ECC level M, ~size px).</summary>
    public static byte[] RenderPng(string payload, int pixelsPerModule = 8)
    {
        using var gen = new QRCodeGenerator();
        using var data = gen.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        var png = new PngByteQRCode(data);
        return png.GetGraphic(pixelsPerModule);
    }
}
