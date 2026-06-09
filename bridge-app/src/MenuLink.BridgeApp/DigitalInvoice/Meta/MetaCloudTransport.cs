using System.Security.Cryptography;
using System.Text;

namespace MenuLink.BridgeApp.DigitalInvoice.Meta;

/// <summary>
/// Real WhatsApp Cloud API transport (BG-3). Cost policy / transport selection (hybrid):
///   window OPEN            → free service document message
///   window CLOSED + paid   → approved Utility Template (document header)
///   window CLOSED + free-only → BlockedByPolicy (durable, no retry)
/// Fail-closed: unknown/unreachable window ⇒ treated as CLOSED. Per-tenant circuit breaker + token (DPAPI).
/// The actual network call is exercised in tests via a fake HttpMessageHandler; live use needs a real token.
/// </summary>
public sealed class MetaCloudTransport : IInvoiceTransport
{
    private readonly MetaCloudClient _client;
    private readonly ITokenProvider _tokens;
    private readonly IWindowStateProvider _windows;
    private readonly CircuitBreaker _breaker;
    private readonly TenantSendConfig _cfg;
    private readonly string _windowSalt;

    public MetaCloudTransport(MetaCloudClient client, ITokenProvider tokens, IWindowStateProvider windows,
        CircuitBreaker breaker, TenantSendConfig cfg, string windowSalt)
    { _client = client; _tokens = tokens; _windows = windows; _breaker = breaker; _cfg = cfg; _windowSalt = windowSalt; }

    public async Task<SendResult> SendAsync(ClaimedJob job, Func<byte[]> renderPdf, CancellationToken ct)
    {
        if (!_breaker.AllowRequest()) return SendResult.Transient("circuit open for tenant");

        string? token = _tokens.GetToken(_cfg.InstallationId);
        if (string.IsNullOrEmpty(token)) return SendResult.Transient("no Meta token (awaiting provisioning)");

        // window state — fail-closed
        bool open;
        try { open = (await _windows.IsWindowOpenAsync(_cfg.TenantId, Cwh(job.CustomerPhone), ct)) ?? false; }
        catch { open = false; }

        if (!open && !_cfg.AllowPaidTemplate)
            return SendResult.BlockedByPolicy("out-of-window and paid templates disabled");

        try
        {
            byte[] pdf = renderPdf();
            string mediaId = await _client.UploadMediaAsync(_cfg.PhoneNumberId, token, pdf, "application/pdf", "invoice.pdf", ct);
            string id = open
                ? await _client.SendDocumentAsync(_cfg.PhoneNumberId, token, job.CustomerPhone, mediaId, "invoice.pdf", $"فاتورة {job.BillNo}", ct)
                : await _client.SendTemplateAsync(_cfg.PhoneNumberId, token, job.CustomerPhone, _cfg.UtilityTemplateName,
                    _cfg.UtilityTemplateLang, mediaId, new[] { job.BillNo }, ct);
            _breaker.RecordSuccess();
            return SendResult.Ok(id);
        }
        catch (MetaApiException ex)
        {
            _breaker.RecordFailure();
            return ex.Permanent ? SendResult.Fatal(ex.Message) : SendResult.Transient(ex.Message);
        }
        catch (Exception ex)
        {
            _breaker.RecordFailure();
            return SendResult.Transient(ex.Message);
        }
    }

    /// <summary>customer_wa_id_hash = SHA-256(tenant window_salt ‖ E164) — matches the gateway derivation.</summary>
    private string Cwh(string e164)
    {
        byte[] h = SHA256.HashData(Encoding.UTF8.GetBytes(_windowSalt + "|" + e164));
        return Convert.ToHexString(h).ToLowerInvariant();
    }
}
