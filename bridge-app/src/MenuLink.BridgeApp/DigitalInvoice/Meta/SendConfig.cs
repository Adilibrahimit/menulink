namespace MenuLink.BridgeApp.DigitalInvoice.Meta;

/// <summary>Per-tenant/installation send configuration (token is NOT here — it's in DPAPI).</summary>
public sealed class TenantSendConfig
{
    public string TenantId { get; set; } = "";
    public string InstallationId { get; set; } = "";
    public string PhoneNumberId { get; set; } = "";
    public bool AllowPaidTemplate { get; set; }            // cost policy (Codex #1/hybrid)
    public string UtilityTemplateName { get; set; } = "invoice_ready";
    public string UtilityTemplateLang { get; set; } = "ar";
    public string GraphVersion { get; set; } = "v21.0";
}

/// <summary>Supplies the Meta token for an installation (DPAPI-backed in production).</summary>
public interface ITokenProvider { string? GetToken(string installationId); }

/// <summary>
/// Tells whether a customer's 24h service window is currently open (Codex #3). Returns true/false, or
/// null when unknown. Callers MUST fail-closed (null/exception ⇒ treat as closed). Real impl in BG-5
/// queries the Cloudflare gateway /api/v1/window + short-TTL cache.
/// </summary>
public interface IWindowStateProvider
{
    Task<bool?> IsWindowOpenAsync(string tenantId, string customerWaIdHash, CancellationToken ct);
}

/// <summary>Deterministic stub for tests / pre-gateway: always returns the configured value.</summary>
public sealed class StubWindowStateProvider : IWindowStateProvider
{
    private readonly bool? _open;
    public StubWindowStateProvider(bool? open) => _open = open;
    public Task<bool?> IsWindowOpenAsync(string t, string c, CancellationToken ct) => Task.FromResult(_open);
}
