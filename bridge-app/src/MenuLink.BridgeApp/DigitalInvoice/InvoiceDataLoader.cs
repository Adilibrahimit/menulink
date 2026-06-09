using Microsoft.Data.SqlClient;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// Loads an immutable InvoiceRenderModel from the local POS DB by InvoiceID, using the same
/// sproc the POS print path uses: dbo.GetItemsForPrintInvoice(@InvoiceID,@Language).
/// One row per line item; header columns repeat on each row. Column set verified on the clone.
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
        return model;
    }

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
