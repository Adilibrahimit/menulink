namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>Render language for the digital invoice (BG-1).</summary>
public enum RenderLanguage { English = 0, Arabic = 1, Bilingual = 2 }

/// <summary>
/// Per-installation company header that is NOT available in the invoice DB
/// (the POS reads these from ActiveSession at print time). BG-1 audit confirmed
/// company name/address/logo/VAT% are runtime values → they come from config here.
/// </summary>
public sealed class CompanyProfile
{
    public string NameEn { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string AddressEn { get; set; } = "";
    public string AddressAr { get; set; } = "";
    public string VatNumber { get; set; } = "";   // ZATCA seller VAT registration (TLV tag 2)
    public string Phone { get; set; } = "";
    public string? LogoPath { get; set; }          // optional local file; absent = no logo
    public decimal VatPercent { get; set; } = 15m;
    public int ThermalWidthMm { get; set; } = 80;  // 80mm thermal; 58 also supported
    public string CurrencyEn { get; set; } = "SAR";
    public string CurrencyAr { get; set; } = "ر.س";
    public string ThanksEn { get; set; } = "Thank you for your visit";
    public string ThanksAr { get; set; } = "شكراً لزيارتكم";
}

public sealed class InvoiceLineItem
{
    public string NameEn { get; set; } = "";
    public string NameAr { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal Rate { get; set; }
    public decimal Amount { get; set; }
    public string? NotesEn { get; set; }
    public string? NotesAr { get; set; }
}

/// <summary>
/// Immutable snapshot of one invoice, built from dbo.GetItemsForPrintInvoice(@InvoiceID,@Language)
/// + per-installation CompanyProfile. Column set verified against the live clone (BillNo 33931).
/// </summary>
public sealed class InvoiceRenderModel
{
    public Guid InvoiceId { get; set; }
    public long InvoiceNo { get; set; }
    public long BillNo { get; set; }
    public DateTime CreatedDate { get; set; }
    public string InvoiceDateText { get; set; } = "";   // POS-formatted e.g. "09 Jun 2026"
    public string UserName { get; set; } = "";
    public string? OnlineBillNo { get; set; }
    public string? CustomerEn { get; set; }
    public string? CustomerAr { get; set; }
    public string? OnlineCustomerEn { get; set; }
    public string? OnlineCustomerAr { get; set; }
    public string? InvoiceNotesEn { get; set; }
    public string? InvoiceNotesAr { get; set; }

    public decimal TotalInclVat { get; set; }            // InvoiceNetAmount
    public decimal NetExclVat { get; set; }              // NetInvoiceAmountWithOutVat
    public decimal VatAmount { get; set; }               // TaxAmount
    public decimal DiscountAmount { get; set; }
    public decimal TobaccoVatAmount { get; set; }
    public decimal TobaccoVatPercent { get; set; }
    public decimal Cash { get; set; }
    public decimal Card { get; set; }

    /// <summary>Persisted ZATCA QR (Phase-2 signed, from GetItemsForPrintInvoice.QR /
    /// ZatcaReportingDetails). When empty → Phase-1: regenerate a deterministic TLV. NEVER re-sign.</summary>
    public string? PersistedQr { get; set; }

    public List<InvoiceLineItem> Items { get; } = new();

    public CompanyProfile Company { get; set; } = new();
    public RenderLanguage Language { get; set; } = RenderLanguage.Arabic;
}
