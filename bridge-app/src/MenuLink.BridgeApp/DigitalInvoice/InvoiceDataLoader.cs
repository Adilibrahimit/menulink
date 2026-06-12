using System.Globalization;
using Microsoft.Data.SqlClient;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// Loads an immutable InvoiceRenderModel from the local POS DB by InvoiceID, using the same
/// sproc the POS print path uses: dbo.GetItemsForPrintInvoice(@InvoiceID,@Language).
/// One row per line item; header columns repeat on each row. Column set verified on the clone.
/// LoadCompany() pulls the receipt header + logo from dbo.GeneralSettings for POS render-parity.
/// </summary>
public sealed class InvoiceDataLoader
{
    private readonly string _connectionString;
    public InvoiceDataLoader(string connectionString) => _connectionString = connectionString;

    public InvoiceRenderModel Load(Guid invoiceId, RenderLanguage language, CompanyProfile company)
    {
        var model = new InvoiceRenderModel { InvoiceId = invoiceId, Language = language, Company = company };

        using var cn = new SqlConnection(_connectionString);
        cn.Open();
        using var cmd = cn.CreateCommand();
        cmd.CommandType = System.Data.CommandType.StoredProcedure;
        cmd.CommandText = "dbo.GetItemsForPrintInvoice";
        cmd.Parameters.AddWithValue("@InvoiceID", invoiceId);
        cmd.Parameters.AddWithValue("@Language", language == RenderLanguage.English ? 0 : 1);

        using var r = cmd.ExecuteReader();
        var cols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < r.FieldCount; i++) cols.Add(r.GetName(i));

        bool header = false;
        while (r.Read())
        {
            if (!header)
            {
                model.InvoiceNo = L(r, cols, "InvoiceNo");
                model.BillNo = L(r, cols, "BillNo");
                model.CreatedDate = DT(r, cols, "CreatedDate");
                model.InvoiceDateText = S(r, cols, "InvoiceDate");
                model.UserName = S(r, cols, "UserName");
                model.OnlineBillNo = SN(r, cols, "OnlineBillNo");
                model.CustomerEn = SN(r, cols, "Customer");
                model.CustomerAr = SN(r, cols, "Customer_A");
                model.OnlineCustomerEn = SN(r, cols, "OnlineCustomer");
                model.OnlineCustomerAr = SN(r, cols, "OnlineCustomer_A");
                model.InvoiceNotesEn = SN(r, cols, "InvoiceNotes");
                model.InvoiceNotesAr = SN(r, cols, "InvoiceNotes_A");
                model.TotalInclVat = M(r, cols, "InvoiceNetAmount");
                model.NetExclVat = M(r, cols, "NetInvoiceAmountWithOutVat");
                model.VatAmount = M(r, cols, "TaxAmount");
                model.DiscountAmount = M(r, cols, "DiscountAmount");
                model.TobaccoVatAmount = M(r, cols, "TobaccoVatAmount");
                model.TobaccoVatPercent = M(r, cols, "TobaccoVatPercent");
                model.Cash = M(r, cols, "Cash");
                model.Card = M(r, cols, "Card");
                model.InvoiceType = (int)L(r, cols, "InvoiceType");
                model.PersistedQr = SN(r, cols, "QR");
                header = true;
            }

            // line item (skip rows with no item name, e.g., a header-only shape)
            string nameAr = S(r, cols, "ItemName_A");
            string nameEn = S(r, cols, "ItemName_E");
            if (nameAr.Length > 0 || nameEn.Length > 0)
            {
                model.Items.Add(new InvoiceLineItem
                {
                    NameEn = nameEn,
                    NameAr = nameAr,
                    Quantity = M(r, cols, "Quantity"),
                    Rate = M(r, cols, "Rate"),
                    Amount = M(r, cols, "Amount"),
                    NotesEn = SN(r, cols, "Notes"),
                    NotesAr = SN(r, cols, "Notes_A"),
                });
            }
        }

        if (!header) throw new InvalidOperationException($"No invoice rows for {invoiceId} (does it exist on this DB?)");

        // POS receipt summary fields (not always in the print sproc): derive locally.
        model.Received = model.Cash + model.Card;
        model.Remaining = Math.Max(0m, model.TotalInclVat - model.Received);
        model.PrintedBy = model.UserName;
        if (!cols.Contains("InvoiceType")) model.InvoiceType = LoadInvoiceType(invoiceId);
        return model;
    }

    /// <summary>Pull the receipt header + logo from dbo.GeneralSettings (POS print-time source of truth).
    /// DB values win; the passed <paramref name="fallback"/> (config) fills any blanks.</summary>
    public CompanyProfile LoadCompany(CompanyProfile fallback)
    {
        var c = new CompanyProfile
        {
            ThermalWidthMm = fallback.ThermalWidthMm,
            VatPercent = fallback.VatPercent,
            NameEn = fallback.NameEn, NameAr = fallback.NameAr,
            AddressEn = fallback.AddressEn, AddressAr = fallback.AddressAr,
            Address2En = fallback.Address2En, Address2Ar = fallback.Address2Ar,
            VatNumber = fallback.VatNumber, Phone = fallback.Phone,
            CurrencyEn = fallback.CurrencyEn, CurrencyAr = fallback.CurrencyAr,
            ThanksEn = fallback.ThanksEn, ThanksAr = fallback.ThanksAr,
            LogoPath = fallback.LogoPath,
        };
        try
        {
            using var cn = new SqlConnection(_connectionString);
            cn.Open();
            using var cmd = cn.CreateCommand();
            cmd.CommandText =
                "SELECT TOP 1 Company,Company_A,Address,Address_A,Address1,Address1_A,Phone,Phone_A," +
                "Thanks,Thanks_A,CurrencyE,CurrencyA,TaxReg,Tax,CompanyLogo_A FROM dbo.GeneralSettings";
            using var r = cmd.ExecuteReader();
            if (r.Read())
            {
                string GS(string n) { int i = r.GetOrdinal(n); return i < 0 || r.IsDBNull(i) ? "" : r.GetValue(i)?.ToString()?.Trim() ?? ""; }
                c.NameEn   = Pick(GS("Company"),    c.NameEn);
                c.NameAr   = Pick(GS("Company_A"),  c.NameAr);
                c.AddressEn = Pick(GS("Address"),   c.AddressEn);
                c.AddressAr = Pick(GS("Address_A"), c.AddressAr);
                c.Address2En = Pick(GS("Address1"),   c.Address2En);
                c.Address2Ar = Pick(GS("Address1_A"), c.Address2Ar);
                c.Phone    = Pick(GS("Phone_A"), Pick(GS("Phone"), c.Phone));
                c.ThanksEn = Pick(GS("Thanks"),   c.ThanksEn);
                c.ThanksAr = Pick(GS("Thanks_A"), c.ThanksAr);
                c.CurrencyEn = Pick(GS("CurrencyE"), c.CurrencyEn);
                c.CurrencyAr = Pick(GS("CurrencyA"), c.CurrencyAr);
                c.VatNumber  = Pick(GS("TaxReg"),    c.VatNumber);
                if (decimal.TryParse(GS("Tax"), NumberStyles.Any, CultureInfo.InvariantCulture, out var tx) && tx > 0) c.VatPercent = tx;

                int li = r.GetOrdinal("CompanyLogo_A");
                if (li >= 0 && !r.IsDBNull(li) && r.GetValue(li) is byte[] raw && raw.Length > 0)
                    c.LogoBytes = NormalizePng(raw);
            }
        }
        catch { /* keep config fallback on any GeneralSettings read error */ }
        return c;
    }

    private int LoadInvoiceType(Guid invoiceId)
    {
        try
        {
            using var cn = new SqlConnection(_connectionString);
            cn.Open();
            using var cmd = cn.CreateCommand();
            cmd.CommandText = "SELECT TOP 1 InvoiceType FROM dbo.Invoice WHERE InvoiceID=@id";
            cmd.Parameters.AddWithValue("@id", invoiceId);
            var o = cmd.ExecuteScalar();
            return o == null || o == DBNull.Value ? 0 : Convert.ToInt32(o);
        }
        catch { return 0; }
    }

    /// <summary>Re-encode the POS logo blob (BMP/JPG/PNG) to PNG so QuestPDF always reads it.</summary>
    private static byte[]? NormalizePng(byte[] raw)
    {
        if (raw.Length == 0) return null;
        if (!OperatingSystem.IsWindows()) return raw;
        try
        {
            using var ms = new MemoryStream(raw);
            using var img = System.Drawing.Image.FromStream(ms);
            using var o = new MemoryStream();
            img.Save(o, System.Drawing.Imaging.ImageFormat.Png);
            return o.ToArray();
        }
        catch { return raw; }
    }

    private static string Pick(string dbVal, string fallback) => string.IsNullOrWhiteSpace(dbVal) ? fallback : dbVal;

    // ---- safe column getters (tolerate missing columns / nulls) ----
    private static int Ord(SqlDataReader r, HashSet<string> cols, string c) => cols.Contains(c) ? r.GetOrdinal(c) : -1;
    private static string S(SqlDataReader r, HashSet<string> cols, string c)
    { int i = Ord(r, cols, c); return i < 0 || r.IsDBNull(i) ? "" : r.GetValue(i)?.ToString()?.Trim() ?? ""; }
    private static string? SN(SqlDataReader r, HashSet<string> cols, string c)
    { string v = S(r, cols, c); return v.Length == 0 ? null : v; }
    private static long L(SqlDataReader r, HashSet<string> cols, string c)
    { int i = Ord(r, cols, c); return i < 0 || r.IsDBNull(i) ? 0L : Convert.ToInt64(r.GetValue(i)); }
    private static decimal M(SqlDataReader r, HashSet<string> cols, string c)
    { int i = Ord(r, cols, c); if (i < 0 || r.IsDBNull(i)) return 0m;
      return decimal.TryParse(r.GetValue(i)?.ToString(), System.Globalization.NumberStyles.Any,
          System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : 0m; }
    private static DateTime DT(SqlDataReader r, HashSet<string> cols, string c)
    { int i = Ord(r, cols, c); return i < 0 || r.IsDBNull(i) ? DateTime.MinValue : Convert.ToDateTime(r.GetValue(i)); }
}
