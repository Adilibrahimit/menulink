using System.Net.Http.Json;
using System.Text.Json;

namespace MenuLink.BridgeApp.DigitalInvoice.Gateway;

/// <summary>Client for the Cloudflare status gateway. Every /api/v1 request is ECDSA-signed (method+path+query+body).</summary>
public sealed class GatewayClient
{
    private readonly HttpClient _http;
    private readonly EcdsaRequestSigner _signer;
    private readonly string _baseUrl; // e.g. https://whatsapp-invoice-gateway.example.workers.dev

    public GatewayClient(HttpClient http, EcdsaRequestSigner signer, string baseUrl)
    { _http = http; _signer = signer; _baseUrl = baseUrl.TrimEnd('/'); }

    public async Task<bool> RegisterMappingAsync(string tenantId, string localJobId, string invoiceIdHash,
        string metaMessageId, string phoneNumberId, CancellationToken ct)
    {
        var body = new { tenantId, localJobId, invoiceIdHash, metaMessageId, phoneNumberId };
        using var resp = await SendSignedAsync(HttpMethod.Post, "/api/v1/messages/register", new Dictionary<string, string>(), body, ct);
        return resp.IsSuccessStatusCode;
    }

    /// <summary>Window open? true/false from gateway, or null on any failure (caller fails-closed).</summary>
    public async Task<bool?> GetWindowOpenAsync(string cwh, CancellationToken ct)
    {
        var q = new Dictionary<string, string> { ["cwh"] = cwh };
        using var resp = await SendSignedAsync(HttpMethod.Get, "/api/v1/window", q, null, ct);
        if (!resp.IsSuccessStatusCode) return null;
        var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        return doc.RootElement.TryGetProperty("open", out var o) && o.ValueKind == JsonValueKind.True ? true
             : doc.RootElement.TryGetProperty("open", out var o2) && o2.ValueKind == JsonValueKind.False ? false : (bool?)null;
    }

    public sealed record StatusItem(string MetaMessageId, string CurrentStatus, string? UpdatedAt);

    public async Task<(List<StatusItem> items, string cursor)> StatusSyncAsync(string cursor, int limit, CancellationToken ct)
    {
        var q = new Dictionary<string, string> { ["cursor"] = cursor, ["limit"] = limit.ToString() };
        using var resp = await SendSignedAsync(HttpMethod.Get, "/api/v1/status-sync", q, null, ct);
        resp.EnsureSuccessStatusCode();
        var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var list = new List<StatusItem>();
        foreach (var it in doc.RootElement.GetProperty("items").EnumerateArray())
            list.Add(new StatusItem(
                it.GetProperty("meta_message_id").GetString() ?? "",
                it.GetProperty("current_status").GetString() ?? "",
                it.TryGetProperty("updated_at", out var u) ? u.GetString() : null));
        string next = doc.RootElement.TryGetProperty("cursor", out var c) ? (c.GetString() ?? cursor) : cursor;
        return (list, next);
    }

    public async Task HeartbeatAsync(string instanceId, CancellationToken ct)
    {
        using var resp = await SendSignedAsync(HttpMethod.Post, "/api/v1/heartbeat", new Dictionary<string, string>(), new { instanceId }, ct);
        resp.EnsureSuccessStatusCode();
    }

    private async Task<HttpResponseMessage> SendSignedAsync(HttpMethod method, string path,
        Dictionary<string, string> query, object? body, CancellationToken ct)
    {
        string canonicalQuery = EcdsaRequestSigner.CanonicalQuery(query);
        string url = _baseUrl + path + (query.Count > 0 ? "?" + canonicalQuery : "");
        string bodyJson = body is null ? "" : JsonSerializer.Serialize(body);
        string bodyHash = EcdsaRequestSigner.Sha256Hex(bodyJson);
        var sig = _signer.Sign(method.Method, path, canonicalQuery, bodyHash);

        var req = new HttpRequestMessage(method, url);
        // send the EXACT bytes we hashed, so the Worker's sha256(rawBody) matches the signed body hash
        if (body is not null) req.Content = new StringContent(bodyJson, System.Text.Encoding.UTF8, "application/json");
        req.Headers.TryAddWithoutValidation("X-Inst-Id", sig.InstallationId);
        req.Headers.TryAddWithoutValidation("X-Timestamp", sig.Timestamp);
        req.Headers.TryAddWithoutValidation("X-Nonce", sig.Nonce);
        req.Headers.TryAddWithoutValidation("X-Signature", sig.Signature);
        return await _http.SendAsync(req, ct);
    }
}
