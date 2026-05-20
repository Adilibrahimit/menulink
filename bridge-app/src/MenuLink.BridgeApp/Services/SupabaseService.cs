using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using MenuLink.BridgeApp.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MenuLink.BridgeApp.Services;

public sealed class SupabaseOptions
{
    public string Url { get; set; } = "";
    public string ServiceRoleKey { get; set; } = "";
    public Guid RestaurantId { get; set; }
}

/// <summary>
/// Thin HTTP client wrapper for PostgREST RPC calls. We call our three
/// SECURITY DEFINER functions: pos_outbox_claim, pos_outbox_mark_synced,
/// pos_outbox_mark_failed. Polling-mode loop drives the workload; Realtime
/// can be added later as an interrupt source.
/// </summary>
public sealed class SupabaseService
{
    private readonly SupabaseOptions _opts;
    private readonly ILogger<SupabaseService> _log;
    private readonly HttpClient _http;

    public SupabaseService(IOptions<SupabaseOptions> opts, ILogger<SupabaseService> log, HttpClient http)
    {
        _opts = opts.Value;
        _log = log;
        _http = http;

        _http.BaseAddress = new Uri(_opts.Url.TrimEnd('/') + "/rest/v1/");
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _opts.ServiceRoleKey);
        _http.DefaultRequestHeaders.Add("apikey", _opts.ServiceRoleKey);
        _http.Timeout = TimeSpan.FromSeconds(30);
    }

    /// <summary>Claim a batch of pending outbox rows atomically.</summary>
    public async Task<List<PosOutboxRow>> ClaimBatchAsync(string instanceId, int batchSize, CancellationToken ct)
    {
        var body = new
        {
            p_restaurant_id = _opts.RestaurantId,
            p_instance_id   = instanceId,
            p_batch_size    = batchSize
        };
        using var resp = await _http.PostAsJsonAsync("rpc/pos_outbox_claim", body, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var text = await resp.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"pos_outbox_claim failed: {(int)resp.StatusCode} {text}");
        }

        var rows = await resp.Content.ReadFromJsonAsync<List<PosOutboxRow>>(JsonOpts, ct);
        return rows ?? new();
    }

    public async Task MarkSyncedAsync(Guid outboxId, PosWriteResult r, CancellationToken ct)
    {
        var body = new
        {
            p_outbox_id      = outboxId,
            p_pos_invoice_id = r.PosInvoiceId,
            p_pos_invoice_no = r.PosInvoiceNo,
            p_pos_bill_no    = r.PosBillNo
        };
        using var resp = await _http.PostAsJsonAsync("rpc/pos_outbox_mark_synced", body, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task MarkFailedAsync(Guid outboxId, string error, bool willRetry, CancellationToken ct)
    {
        var body = new
        {
            p_outbox_id  = outboxId,
            p_error      = error,
            p_will_retry = willRetry
        };
        using var resp = await _http.PostAsJsonAsync("rpc/pos_outbox_mark_failed", body, ct);
        resp.EnsureSuccessStatusCode();
    }

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
}
