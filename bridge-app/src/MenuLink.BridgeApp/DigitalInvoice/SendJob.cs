using System.Text.Json;
using System.Text.Json.Serialization;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>Job lifecycle states (mirror of ARCHITECTURE.md). Persisted as text in SQLite.</summary>
public enum JobStatus
{
    Pending, LoadingInvoice, Rendering, ReadyToSend, UploadingMedia, Sending,
    AcceptedByMeta, Sent, Delivered, Read, RetryScheduled, FailedPermanent,
    BlockedByPolicy, Cancelled
}

/// <summary>
/// Versioned spool job contract written atomically by the POS Helper and imported by the Bridge.
/// JSON-serializable; the Helper (.NET FW 4.7.2) writes the same shape. NO Meta token / invoice image here.
/// </summary>
public sealed class SendJob
{
    [JsonPropertyName("schemaVersion")] public int SchemaVersion { get; set; } = 1;
    [JsonPropertyName("jobId")] public string JobId { get; set; } = Guid.NewGuid().ToString();
    [JsonPropertyName("idempotencyKey")] public string IdempotencyKey { get; set; } = "";
    [JsonPropertyName("invoiceId")] public string InvoiceId { get; set; } = "";
    [JsonPropertyName("billNo")] public string BillNo { get; set; } = "";
    [JsonPropertyName("branchId")] public string BranchId { get; set; } = "";
    [JsonPropertyName("cashierId")] public string CashierId { get; set; } = "";
    [JsonPropertyName("customerPhoneE164")] public string CustomerPhoneE164 { get; set; } = "";
    [JsonPropertyName("language")] public string Language { get; set; } = "ar";
    [JsonPropertyName("completionMode")] public string CompletionMode { get; set; } = "SendOnly";
    [JsonPropertyName("digitalInvoiceRequested")] public bool DigitalInvoiceRequested { get; set; } = true;
    [JsonPropertyName("optInSource")] public string OptInSource { get; set; } = "POS_VERBAL_REQUEST";
    [JsonPropertyName("requestedAtUtc")] public string RequestedAtUtc { get; set; } = "";

    private static readonly JsonSerializerOptions Opts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        WriteIndented = false
    };

    public string ToJson() => JsonSerializer.Serialize(this, Opts);
    public static SendJob? FromJson(string json) => JsonSerializer.Deserialize<SendJob>(json, Opts);

    /// <summary>Idempotency identity = explicit key if present, else jobId. Drives the unique index.</summary>
    public string IdentityKey => string.IsNullOrWhiteSpace(IdempotencyKey) ? JobId : IdempotencyKey;

    public RenderLanguage RenderLanguage => Language?.ToLowerInvariant() switch
    {
        "en" => DigitalInvoice.RenderLanguage.English,
        "bi" or "bilingual" => DigitalInvoice.RenderLanguage.Bilingual,
        _ => DigitalInvoice.RenderLanguage.Arabic
    };
}
