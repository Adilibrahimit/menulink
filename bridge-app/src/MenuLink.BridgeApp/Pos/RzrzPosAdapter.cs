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
    public string KitchenPrinterName { get; set; } = "KETCHIN";
    public bool PrintEnabled { get; set; } = true;

    /// <summary>
    /// If true (default), the Bridge App lands MenuLink orders in the cashier UI's
    /// "held" list and lets staff review + tap Pay manually to finalize. We
    /// only call InsertInvoice with IsHold=1 — no PaymentDetails, no kitchen
    /// print (the cashier UI's own code handles those when they pay, including
    /// printing with the native receipt format).
    ///
    /// If false, the Bridge App writes invoice + payment + kitchen print
    /// directly so the order is "auto-confirmed" with zero staff interaction.
    /// </summary>
    public bool HoldMode { get; set; } = true;
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
    private readonly KitchenPrinter _printer;

    public RzrzPosAdapter(IOptions<PosOptions> opts, ILogger<RzrzPosAdapter> log, KitchenPrinter printer)
    {
        _opts = opts.Value;
        _log = log;
        _printer = printer;
    }

    public async Task<PosWriteResult> WriteOrderAsync(OutboxPayload payload, long menuLinkInvoiceNo, CancellationToken ct)
    {
        if (payload.Items.Count == 0)
            throw new InvalidOperationException("Cannot write an order with zero items.");

        var unmapped = payload.Items.Where(i => !i.PosItemId.HasValue).ToList();
        if (unmapped.Count > 0)
        {
            var names = string.Join(", ", unmapped.Select(i => i.ItemName));
            throw new InvalidOperationException(
                $"Order has items without POS mapping: {names}. " +
                $"Add rows to public.pos_item_map for restaurant {payload.Order.RestaurantId} first.");
        }

        // Per-order POS values come from the outbox payload (snapshotted at
        // enqueue time by build_pos_outbox_payload in migration 0012). For
        // outbox rows enqueued before 0012, payload.Pos is null and we fall
        // back to the PosOptions defaults.
        var invoiceType     = payload.Pos?.InvoiceType    ?? _opts.InvoiceType;
        var onlineCustomer  = payload.Pos?.OnlineCustomerId ?? _opts.OnlineCustomerId;
        var counterId       = payload.Pos?.CounterId      ?? _opts.CounterId;
        var sectionId       = payload.Pos?.SectionId      ?? 0;

        var (xmlInvoice, xmlItems) = BuildXml(payload, menuLinkInvoiceNo, invoiceType, onlineCustomer, counterId);

        await using var conn = new SqlConnection(_opts.ConnectionString);
        await conn.OpenAsync(ct);

        // ---- Idempotency precheck -------------------------------------------------
        // If a previous attempt already created the POS Invoice (and failed in a
        // later step), use that row instead of inserting another duplicate.
        // Match by OnlineCustomerID + InvoiceNotes_A tag prefix.
        var tagPattern = $"MenuLink #{menuLinkInvoiceNo} %";
        Guid posInvoiceGuid;
        long posInvoiceNo;
        long posBillNo;
        decimal taxAmount;
        bool invoiceAlreadyExisted;

        await using (var precheck = new SqlCommand(@"
            select top 1 InvoiceID, InvoiceNo, BillNo, TaxAmount
            from Invoice
            where OnlineCustomerID = @ocid and InvoiceNotes_A like @tag
            order by CreatedDate desc;", conn))
        {
            precheck.Parameters.Add("@ocid", SqlDbType.BigInt).Value = onlineCustomer;
            precheck.Parameters.Add("@tag", SqlDbType.NVarChar, 200).Value = tagPattern;
            await using var rdr = await precheck.ExecuteReaderAsync(ct);
            if (await rdr.ReadAsync(ct))
            {
                posInvoiceGuid = rdr.GetGuid(0);
                posInvoiceNo = rdr.GetInt64(1);
                posBillNo = rdr.GetInt64(2);
                taxAmount = rdr.IsDBNull(3) ? 0m : Convert.ToDecimal(rdr.GetValue(3));
                invoiceAlreadyExisted = true;
            }
            else
            {
                posInvoiceGuid = Guid.Empty;
                posInvoiceNo = 0;
                posBillNo = 0;
                taxAmount = 0;
                invoiceAlreadyExisted = false;
            }
        }

        if (invoiceAlreadyExisted)
        {
            _log.LogWarning(
                "Idempotency: found existing Invoice {Id} for MenuLink #{MlNo} — skipping InsertInvoice.",
                posInvoiceGuid, menuLinkInvoiceNo);
        }
        else
        {
            // 1. InsertInvoice — header + items (+ KitichenOrderForPrint rows when IsHold=0)
            await using (var cmd = new SqlCommand("dbo.InsertInvoice", conn) { CommandType = CommandType.StoredProcedure })
            {
                cmd.Parameters.Add("@XmlInvoice", SqlDbType.NVarChar, -1).Value = xmlInvoice;
                cmd.Parameters.Add("@XmlItems", SqlDbType.NVarChar, -1).Value = xmlItems;
                cmd.Parameters.Add("@IsHold", SqlDbType.Bit).Value = _opts.HoldMode ? 1 : 0;
                cmd.Parameters.Add("@SectionID", SqlDbType.Int).Value = sectionId;
                cmd.Parameters.Add("@InvoiceType", SqlDbType.Int).Value = invoiceType;
                cmd.Parameters.Add("@AppendInvoiceIDS", SqlDbType.NVarChar, 500).Value = "";
                _log.LogDebug(
                    "Calling InsertInvoice for MenuLink #{No} (order {OrderId}, OrderType={OrderType}, InvoiceType={InvoiceType}, IsHold={IsHold})",
                    menuLinkInvoiceNo, payload.Order.Id, payload.Order.OrderType, invoiceType, _opts.HoldMode);
                await cmd.ExecuteNonQueryAsync(ct);
            }

            // 2. Look up the resulting Invoice row by our InvoiceNotes_A tag
            await using var lookup = new SqlCommand(@"
                select top 1 InvoiceID, InvoiceNo, BillNo, TaxAmount
                from Invoice
                where OnlineCustomerID = @ocid and InvoiceNotes_A like @tag
                order by CreatedDate desc;", conn);
            lookup.Parameters.Add("@ocid", SqlDbType.BigInt).Value = onlineCustomer;
            lookup.Parameters.Add("@tag", SqlDbType.NVarChar, 200).Value = tagPattern;

            await using var rdr = await lookup.ExecuteReaderAsync(ct);
            if (!await rdr.ReadAsync(ct))
                throw new InvalidOperationException(
                    $"InsertInvoice ran but no Invoice row found with tag '{tagPattern}'. Check the proc and InvoiceNotes_A formatting.");

            posInvoiceGuid = rdr.GetGuid(0);
            posInvoiceNo = rdr.GetInt64(1);
            posBillNo = rdr.GetInt64(2);
            taxAmount = rdr.IsDBNull(3) ? 0m : Convert.ToDecimal(rdr.GetValue(3));
        }

        // ---------------------------------------------------------------------
        // HoldMode: stop after the Invoice + InvoiceDetails landed. The order
        // appears in the cashier UI's held list; staff review + tap Pay to
        // finalize (which fires the native receipt + kitchen print).
        // ---------------------------------------------------------------------
        if (_opts.HoldMode)
        {
            _log.LogInformation(
                "Wrote MenuLink #{No} (order {OrderId}) to RzRz as HELD: InvoiceNo={InvoiceNo}, BillNo={BillNo}, InvoiceID={InvoiceId} — cashier will review + pay",
                menuLinkInvoiceNo, payload.Order.Id, posInvoiceNo, posBillNo, posInvoiceGuid);
            return new PosWriteResult(posInvoiceGuid.ToString(), posInvoiceNo, posBillNo);
        }

        // 3. PaymentDetails — record this as a paid "Online" transaction so
        //    the POS doesn't leave it in finalized-but-unpaid limbo.
        //    Idempotent: only inserts if no positive-amount payment row exists yet.
        await using (var payCmd = new SqlCommand(@"
            if not exists (
                select 1 from PaymentDetails where InvoiceID = @inv and PaidAmount > 0
            )
            insert into PaymentDetails
              (PaymentID, InvoiceID, CounterID, PaidAmount, Discount, GivenAmount,
               ChangeAmount, Cash, Card, Remark, Remark_A, PaymentType, CreatedBy,
               CreatedDateTime, TaxAmount, IsSyncRequired, OnlinePaymentType,
               CardPaymentType, WaiterID, Person, WaiterAmount, OnlineBillNo, TobaccoVatAmount)
            values
              (NEWID(), @inv, @counter, @paid, 0, 0,
               0, 0, @paid, '', '', 0, @createdBy,
               GETDATE(), @tax, 1, 1,
               1, 0, 0, 0, @billNo, 0);", conn))
        {
            payCmd.Parameters.Add("@inv",       SqlDbType.UniqueIdentifier).Value = posInvoiceGuid;
            payCmd.Parameters.Add("@counter",   SqlDbType.BigInt).Value = counterId;
            payCmd.Parameters.Add("@paid",      SqlDbType.Decimal).Value = payload.Order.Total;
            payCmd.Parameters.Add("@createdBy", SqlDbType.BigInt).Value = _opts.DefaultUserId;
            payCmd.Parameters.Add("@tax",       SqlDbType.Decimal).Value = taxAmount;
            payCmd.Parameters.Add("@billNo",    SqlDbType.NVarChar, 50).Value =
                menuLinkInvoiceNo.ToString(CultureInfo.InvariantCulture);
            await payCmd.ExecuteNonQueryAsync(ct);
        }

        // 4. InvoicePaymentTypeDetails — single Mada-typed row for the full amount
        //    Idempotent: only inserts if no row exists yet for this Invoice.
        await using (var ptCmd = new SqlCommand(@"
            if not exists (
                select 1 from InvoicePaymentTypeDetails where InvoiceID = @inv
            )
            insert into InvoicePaymentTypeDetails
              (InvoicePaymentTypeDetailsID, InvoiceID, PaymentCardTypeID, Amount)
            values
              (NEWID(), @inv, 1, @amount);", conn))
        {
            ptCmd.Parameters.Add("@inv",    SqlDbType.UniqueIdentifier).Value = posInvoiceGuid;
            ptCmd.Parameters.Add("@amount", SqlDbType.Decimal).Value = payload.Order.Total;
            await ptCmd.ExecuteNonQueryAsync(ct);
        }

        _log.LogInformation(
            "Wrote MenuLink #{No} (order {OrderId}) to RzRz: InvoiceNo={InvoiceNo}, BillNo={BillNo}, InvoiceID={InvoiceId} -- paid+closed",
            menuLinkInvoiceNo, payload.Order.Id, posInvoiceNo, posBillNo, posInvoiceGuid);

        // 5. Fire the kitchen ticket print. The cashier UI ordinarily does this
        //    from .NET when its "Pay" button runs — when we write the data from
        //    a service context, no UI is around to do it, so we do it here.
        if (_opts.PrintEnabled && OperatingSystem.IsWindows())
        {
            try
            {
                await _printer.PrintAndMarkAsync(
                    conn, posInvoiceGuid, menuLinkInvoiceNo, payload, _opts.KitchenPrinterName, ct);
            }
            catch (Exception ex)
            {
                // Don't unwind the whole order — invoice + payment already landed.
                // Print failure should not roll back a successful sale.
                _log.LogError(ex,
                    "Kitchen print failed for MenuLink #{No} but the invoice + payment are committed. " +
                    "Manual re-print from the cashier UI may be needed.", menuLinkInvoiceNo);
            }
        }

        return new PosWriteResult(posInvoiceGuid.ToString(), posInvoiceNo, posBillNo);
    }

    private (string XmlInvoice, string XmlItems) BuildXml(
        OutboxPayload p,
        long menuLinkInvoiceNo,
        int invoiceType,
        long onlineCustomerId,
        long counterId)
    {
        var inv = p.Order;
        var c = p.Customer;
        var ci = CultureInfo.InvariantCulture;

        var notesAr  = BuildNotesArabic(p, menuLinkInvoiceNo);
        var notesEng = OrderTypeArabicLabel(inv.OrderType);  // populates the (otherwise-empty) InvoiceNotes field
                                                              // so the cashier can read the order type on the held invoice
                                                              // even before deciding which POS InvoiceType to apply.

        var xmlInvoice = string.Format(ci,
            "<Invoice " +
                "InvoiceID=\"00000000-0000-0000-0000-000000000000\" " +
                "InvoiceAmount=\"{0}\" " +
                "InvoiceType=\"{1}\" " +
                "TableID=\"0\" " +
                "InvoiceNotes=\"{6}\" " +
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
            invoiceType,
            EscapeAttr(notesAr),
            _opts.DefaultUserId,
            counterId,
            onlineCustomerId,
            EscapeAttr(notesEng));

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

    // Kept short — thermal receipt prints this on one line, so packing
    // address + short order id overflows onto the items header (seen in
    // production receipt for invoice 439). The idempotency precheck only
    // requires the "MenuLink #N " prefix.
    private static string BuildNotesArabic(OutboxPayload p, long menuLinkInvoiceNo)
    {
        var parts = new List<string> { $"MenuLink #{menuLinkInvoiceNo}" };
        if (!string.IsNullOrWhiteSpace(p.Customer?.Name))
            parts.Add(p.Customer.Name!);
        if (!string.IsNullOrWhiteSpace(p.Customer?.Phone))
            parts.Add(LocalSaudiPhone(p.Customer.Phone));
        return string.Join(" · ", parts);
    }

    // MenuLink order_type → human Arabic label written into Invoice.InvoiceNotes.
    // Lets the cashier read what the customer chose ("توصيل" / "محلي" / "سفري" / "سيارة")
    // directly off the held invoice, without depending on the InvoiceType integer alone.
    private static string OrderTypeArabicLabel(string orderType) => orderType switch
    {
        "delivery" => "توصيل",
        "dine_in"  => "محلي",
        "pickup"   => "سفري",
        "car"      => "سيارة",
        _          => orderType ?? ""
    };

    // +966598292413 → 0598292413. Receipt readers expect the 05xx form.
    private static string LocalSaudiPhone(string phone)
    {
        if (phone.StartsWith("+966")) return "0" + phone.Substring(4);
        if (phone.StartsWith("966"))  return "0" + phone.Substring(3);
        return phone;
    }

    private static string EscapeAttr(string s) =>
        s.Replace("&", "&amp;")
         .Replace("<", "&lt;")
         .Replace(">", "&gt;")
         .Replace("\"", "&quot;")
         .Replace("'", "&apos;");
}
