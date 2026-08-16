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

    /// <summary>The tenant this instance serves. Exposed for the heartbeat row.</summary>
    public Guid RestaurantId => _opts.RestaurantId;

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

    /// <summary>
    /// Return rows stranded in 'claimed' to 'pending', and park pending rows
    /// that are too old to serve. See migration 0079 for why both halves exist.
    /// Returns (reclaimed, expired) for logging.
    /// </summary>
    public async Task<(int Reclaimed, int Expired)> ReclaimStaleAsync(
        int claimedAfterMinutes, int maxAgeMinutes, CancellationToken ct)
    {
        var body = new
        {
            p_restaurant_id         = _opts.RestaurantId,
            p_claimed_after_minutes = claimedAfterMinutes,
            p_max_age_minutes       = maxAgeMinutes
        };
        using var resp = await _http.PostAsJsonAsync("rpc/pos_outbox_reclaim_stale", body, ct);
        if (!resp.IsSuccessStatusCode)
        {
            _log.LogWarning("pos_outbox_reclaim_stale failed: {Status} {Body}",
                (int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
            return (0, 0);
        }
        var rows = await resp.Content.ReadFromJsonAsync<List<ReclaimResult>>(JsonOpts, ct);
        var r = rows?.FirstOrDefault();
        return (r?.Reclaimed ?? 0, r?.Expired ?? 0);
    }

    private sealed class ReclaimResult
    {
        [System.Text.Json.Serialization.JsonPropertyName("reclaimed")] public int Reclaimed { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("expired")]   public int Expired { get; set; }
    }

    /// <summary>
    /// Write a heartbeat so /admin/pos can show the bridge as online.
    ///
    /// Posts straight to the table rather than /api/bridge/heartbeat: that route
    /// requires auth.getUser(), and the bridge authenticates with a service_role
    /// key which has no user session — so the route is unusable from here. The
    /// service_role key bypasses RLS, so the direct insert is both simpler and
    /// the only thing that actually works.
    ///
    /// Never throws: a missed heartbeat is a monitoring gap, not a reason to
    /// stop delivering orders.
    /// </summary>
    public async Task SendHeartbeatAsync(object heartbeat, CancellationToken ct)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, "bridge_heartbeats")
            {
                Content = JsonContent.Create(heartbeat)
            };
            req.Headers.Add("Prefer", "return=minimal");
            using var resp = await _http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
                _log.LogWarning("heartbeat rejected: {Status} {Body}",
                    (int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "heartbeat failed (continuing).");
        }
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
