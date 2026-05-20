using System.Data;
using System.Globalization;
using System.Text;
using MenuLink.BridgeApp.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MenuLink.BridgeApp.Pos;

public sealed class PosOptions
{
    public string Kind { get; set; } = "rzrz";
    public int BranchId { get; set; }
    public string ConnectionString { get; set; } = "";
    public long OnlineCustomerId { get; set; } = 999;
    public long CounterId { get; set; } = 1;
    public int InvoiceType { get; set; } = 11;
    public long DefaultUserId { get; set; } = 1;
}

/// <summary>
/// Talks to a local RzRz / Punnelifosys ResApp SQL Server (database "client").
/// Builds the verified XML and calls dbo.InsertInvoice with IsHold=0 so the
/// existing cashier UI dispatcher picks up KitichenOrderForPrint rows and
/// fires the kitchen printers via the ItemPrinters table mapping.
/// </summary>
public sealed class RzrzPosAdapter : IPosAdapter
{
    private readonly PosOptions _opts;
    private readonly ILogger<RzrzPosAdapter> _log;

    public RzrzPosAdapter(IOptions<PosOptions> opts, ILogger<RzrzPosAdapter> log)
    {
        _opts = opts.Value;
        _log = log;
    }

    public async Task<PosWriteResult> WriteOrderAsync(OutboxPayload payload, CancellationToken ct)
    {
        if (payload.Items.Count == 0)
            throw new InvalidOperationException("Cannot write an order with zero items.");

        // Translate each item: ensure pos_item_id is present (the trigger
        // populates it via pos_item_map). If null, the menu hasn't been
        // mapped; bail loudly rather than insert garbage.
        var unmapped = payload.Items.Where(i => !i.PosItemId.HasValue).ToList();
        if (unmapped.Count > 0)
        {
            var names = string.Join(", ", unmapped.Select(i => i.ItemName));
            throw new InvalidOperationException(
                $"Order has items without POS mapping: {names}. " +
                $"Add rows to public.pos_item_map for restaurant {payload.Order.RestaurantId} first.");
        }

        var (xmlInvoice, xmlItems) = BuildXml(payload);

        await using var conn = new SqlConnection(_opts.ConnectionString);
        await conn.OpenAsync(ct);

        await using var cmd = new SqlCommand("dbo.InsertInvoice", conn)
        {
            CommandType = CommandType.StoredProcedure
        };

        cmd.Parameters.Add("@XmlInvoice", SqlDbType.NVarChar, -1).Value = xmlInvoice;
        cmd.Parameters.Add("@XmlItems", SqlDbType.NVarChar, -1).Value = xmlItems;
        cmd.Parameters.Add("@IsHold", SqlDbType.Bit).Value = 0;
        cmd.Parameters.Add("@SectionID", SqlDbType.Int).Value = 0;
        cmd.Parameters.Add("@InvoiceType", SqlDbType.Int).Value = _opts.InvoiceType;
        cmd.Parameters.Add("@AppendInvoiceIDS", SqlDbType.NVarChar, 500).Value = "";

        _log.LogDebug("Calling InsertInvoice for MenuLink order {OrderId}", payload.Order.Id);
        await cmd.ExecuteNonQueryAsync(ct);

        // Look up the resulting Invoice row by InvoiceNotes_A tag we embedded.
        // We tag with MenuLink_<order_id> so we can locate the just-inserted row.
        await using var lookup = new SqlCommand(@"
            select top 1
                CAST(InvoiceID as nvarchar(50)) as InvoiceId,
                InvoiceNo,
                BillNo
            from Invoice
            where OnlineCustomerID = @ocid
              and InvoiceNotes_A like @tag
            order by CreatedDate desc;", conn);
        lookup.Parameters.Add("@ocid", SqlDbType.BigInt).Value = _opts.OnlineCustomerId;
        lookup.Parameters.Add("@tag", SqlDbType.NVarChar, 200).Value =
            $"MenuLink #{ShortId(payload.Order.Id)}%";

        await using var rdr = await lookup.ExecuteReaderAsync(ct);
        if (!await rdr.ReadAsync(ct))
            throw new InvalidOperationException(
                "InsertInvoice succeeded but the resulting Invoice row wasn't found by tag.");

        var posInvoiceId = rdr.GetString(0);
        var posInvoiceNo = rdr.GetInt64(1);
        var posBillNo = rdr.GetInt64(2);

        _log.LogInformation(
            "Wrote MenuLink order {OrderId} to RzRz: InvoiceNo={InvoiceNo}, BillNo={BillNo}, InvoiceID={InvoiceId}",
            payload.Order.Id, posInvoiceNo, posBillNo, posInvoiceId);

        return new PosWriteResult(posInvoiceId, posInvoiceNo, posBillNo);
    }

    private (string XmlInvoice, string XmlItems) BuildXml(OutboxPayload p)
    {
        var inv = p.Order;
        var c = p.Customer;
        var ci = CultureInfo.InvariantCulture;

        var notesAr = BuildNotesArabic(p);

        var xmlInvoice = string.Format(ci,
            "<Invoice " +
                "InvoiceID=\"00000000-0000-0000-0000-000000000000\" " +
                "InvoiceAmount=\"{0}\" " +
                "InvoiceType=\"{1}\" " +
                "TableID=\"0\" " +
                "InvoiceNotes=\"\" " +
                "InvoiceNotes_A=\"{2}\" " +
                "DiscountAmount=\"0.00\" " +
                "CreatedBy=\"{3}\" " +
                "CounterID=\"{4}\" " +
                "CustomerID=\"0\" " +
                "OnlineCustomerID=\"{5}\" " +
                "InvoicePartyID=\"00000000-0000-0000-0000-000000000000\" " +
                "TobaccoVatAmount=\"0\" " +
                "InvoiceDiscountPercentage=\"0\" " +
                "DishItemInvoiceID=\"00000000-0000-0000-0000-000000000000\" />",
            inv.Total.ToString("0.00", ci),
            _opts.InvoiceType,
            EscapeAttr(notesAr),
            _opts.DefaultUserId,
            _opts.CounterId,
            _opts.OnlineCustomerId);

        var sb = new StringBuilder(p.Items.Count * 200);
        for (var i = 0; i < p.Items.Count; i++)
        {
            var item = p.Items[i];
            sb.Append("<Items ");
            sb.AppendFormat(ci, "ItemID=\"{0}\" ", item.PosItemId!.Value);
            sb.AppendFormat(ci, "Qty=\"{0}\" ", item.Qty.ToString("0.00", ci));
            sb.AppendFormat(ci, "Rate=\"{0}\" ", item.UnitPrice.ToString("0.00", ci));
            sb.AppendFormat(ci, "Amount=\"{0}\" ", item.LineTotal.ToString("0.00", ci));
            sb.Append("DiscountAmount=\"0\" Notes=\"\" Notes_A=\"");
            sb.Append(EscapeAttr(item.Variant ?? ""));
            sb.Append("\" ");
            sb.AppendFormat(ci, "DisplayOrder=\"{0}\" ", i + 1);
            sb.Append("TaxPercent=\"0\" />");
        }

        return (xmlInvoice, sb.ToString());
    }

    private static string BuildNotesArabic(OutboxPayload p)
    {
        var parts = new List<string> { $"MenuLink #{ShortId(p.Order.Id)}" };
        if (!string.IsNullOrWhiteSpace(p.Customer?.Name))
            parts.Add(p.Customer.Name!);
        if (!string.IsNullOrWhiteSpace(p.Customer?.Phone))
            parts.Add(p.Customer.Phone);
        if (!string.IsNullOrWhiteSpace(p.Order.Address))
            parts.Add(p.Order.Address!);
        return string.Join(" · ", parts);
    }

    private static string ShortId(Guid g) => g.ToString("N").Substring(0, 8);

    private static string EscapeAttr(string s) =>
        s.Replace("&", "&amp;")
         .Replace("<", "&lt;")
         .Replace(">", "&gt;")
         .Replace("\"", "&quot;")
         .Replace("'", "&apos;");
}
