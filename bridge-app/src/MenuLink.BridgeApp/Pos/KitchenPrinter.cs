using System.Data;
using System.Drawing;
using System.Drawing.Printing;
using System.Globalization;
using System.Runtime.Versioning;
using MenuLink.BridgeApp.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace MenuLink.BridgeApp.Pos;

/// <summary>
/// Fires the kitchen ticket print after the Bridge App writes PaymentDetails.
/// The RzRz cashier UI ordinarily does this client-side when its "Pay" button
/// runs — when we write the rows from a service context, no UI process picks
/// them up, so we issue the print ourselves.
///
/// v1: prints all items in a single ticket on the configured Windows printer
///     name (default "KETCHIN"). One job per invoice.
/// v2 (later): per-station routing using the ItemPrinters table — query each
///     item's target Printer column and group items by destination, send one
///     job per printer.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class KitchenPrinter
{
    private readonly ILogger<KitchenPrinter> _log;

    public KitchenPrinter(ILogger<KitchenPrinter> log)
    {
        _log = log;
    }

    public async Task PrintAndMarkAsync(
        SqlConnection conn,
        Guid invoiceId,
        long menuLinkInvoiceNo,
        OutboxPayload payload,
        string printerName,
        CancellationToken ct)
    {
        // 1. Look up the un-printed kitchen rows for this invoice.
        var lines = new List<(long ItemId, string NameEn, string NameAr, int Qty, string? Notes)>();
        await using (var q = new SqlCommand(@"
            select k.ItemID, i.ItemName_E, i.ItemName_A, k.Quantity, k.Notes_A
            from KitichenOrderForPrint k
            inner join Items i on i.ItemID = k.ItemID
            where k.InvoiceID = @inv and k.IsPrinted = 0
            order by k.DisplayOrder;", conn))
        {
            q.Parameters.Add("@inv", SqlDbType.UniqueIdentifier).Value = invoiceId;
            await using var rdr = await q.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
            {
                lines.Add((
                    rdr.GetInt64(0),
                    rdr.IsDBNull(1) ? "" : rdr.GetString(1),
                    rdr.IsDBNull(2) ? "" : rdr.GetString(2),
                    (int)rdr.GetDouble(3),
                    rdr.IsDBNull(4) ? null : rdr.GetString(4)
                ));
            }
        }

        if (lines.Count == 0)
        {
            _log.LogInformation("No un-printed kitchen rows for invoice {InvoiceId} — skipping print.", invoiceId);
            return;
        }

        // 2. Build the ticket text.
        var ticket = BuildTicket(menuLinkInvoiceNo, payload, lines);

        // 3. Send to the Windows printer.
        try
        {
            PrintTicket(printerName, ticket);
            _log.LogInformation("Kitchen ticket sent to printer '{Printer}' for MenuLink #{No}.", printerName, menuLinkInvoiceNo);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to print kitchen ticket to '{Printer}'.", printerName);
            throw;
        }

        // 4. Mark the rows printed.
        await using var upd = new SqlCommand(
            "update KitichenOrderForPrint set IsPrinted = 1 where InvoiceID = @inv and IsPrinted = 0;", conn);
        upd.Parameters.Add("@inv", SqlDbType.UniqueIdentifier).Value = invoiceId;
        await upd.ExecuteNonQueryAsync(ct);
    }

    private static string BuildTicket(
        long menuLinkInvoiceNo,
        OutboxPayload payload,
        List<(long ItemId, string NameEn, string NameAr, int Qty, string? Notes)> lines)
    {
        var ci = CultureInfo.InvariantCulture;
        var sb = new System.Text.StringBuilder();

        sb.AppendLine("===============================");
        sb.AppendLine($"        MenuLink #{menuLinkInvoiceNo}");
        sb.AppendLine("===============================");
        sb.AppendLine($"Order: {payload.Order.Id.ToString("N").Substring(0, 8)}");
        sb.AppendLine($"Time : {DateTime.Now.ToString("yyyy-MM-dd HH:mm", ci)}");
        sb.AppendLine($"Type : {payload.Order.OrderType}");
        if (!string.IsNullOrWhiteSpace(payload.Customer?.Phone))
            sb.AppendLine($"Phone: {payload.Customer.Phone}");
        if (!string.IsNullOrWhiteSpace(payload.Customer?.Name))
            sb.AppendLine($"Name : {payload.Customer.Name}");
        sb.AppendLine("-------------------------------");
        sb.AppendLine("Qty  Item");
        sb.AppendLine("-------------------------------");
        foreach (var line in lines)
        {
            var name = !string.IsNullOrWhiteSpace(line.NameEn) ? line.NameEn : line.NameAr;
            sb.AppendLine($" {line.Qty,2}  {name}");
            if (!string.IsNullOrWhiteSpace(line.Notes))
                sb.AppendLine($"      Note: {line.Notes}");
        }
        sb.AppendLine("===============================");
        sb.AppendLine("        *** MENULINK ***");
        sb.AppendLine();
        sb.AppendLine();

        return sb.ToString();
    }

    private static void PrintTicket(string printerName, string text)
    {
        using var doc = new PrintDocument();
        doc.PrinterSettings.PrinterName = printerName;
        if (!doc.PrinterSettings.IsValid)
            throw new InvalidOperationException($"Windows printer '{printerName}' is not installed on this machine.");

        var lines = text.Split('\n');
        var lineIndex = 0;

        doc.PrintPage += (sender, e) =>
        {
            using var font = new Font("Consolas", 9f, FontStyle.Regular);
            float y = e.MarginBounds.Top;
            var lineHeight = font.GetHeight(e.Graphics!) + 1;
            while (lineIndex < lines.Length && y + lineHeight < e.MarginBounds.Bottom)
            {
                e.Graphics!.DrawString(lines[lineIndex].TrimEnd('\r'), font, Brushes.Black, e.MarginBounds.Left, y);
                lineIndex++;
                y += lineHeight;
            }
            e.HasMorePages = lineIndex < lines.Length;
        };

        doc.Print();
    }
}
