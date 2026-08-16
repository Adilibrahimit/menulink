using System.Text.Json;
using MenuLink.BridgeApp.Models;
using MenuLink.BridgeApp.Pos;
using MenuLink.BridgeApp.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MenuLink.BridgeApp;

public sealed class BridgeAppOptions
{
    public string InstanceId { get; set; } = Environment.MachineName.ToLowerInvariant();
    public int PollingIntervalSeconds { get; set; } = 5;
    public int MaxAttempts { get; set; } = 5;
    public int BatchSize { get; set; } = 5;

    /// <summary>How often to write a heartbeat row. /admin/pos treats a bridge
    /// as offline after 3 minutes, so this must stay well under that.</summary>
    public int HeartbeatIntervalSeconds { get; set; } = 60;

    /// <summary>A row claimed longer ago than this is treated as abandoned and
    /// returned to 'pending'. Must exceed the worst realistic InsertInvoice
    /// round-trip, or we would steal work from a live instance.</summary>
    public int ReclaimClaimedAfterMinutes { get; set; } = 10;

    /// <summary>An order older than this is never injected — it is parked as
    /// 'failed' instead. Stops a bridge that has been down for hours from
    /// dumping a whole night of orders onto the kitchen at once.</summary>
    public int MaxOrderAgeMinutes { get; set; } = 120;
}

/// <summary>
/// The background loop. Every N seconds:
///   1. Claim a batch of pending rows from pos_outbox (atomic, via RPC).
///   2. For each row: parse payload, write to POS, mark synced/failed.
/// Idempotency is enforced by the unique (restaurant_id, order_id) constraint
/// on pos_outbox plus the claim's status transition.
///
/// Realtime: supabase-csharp's Realtime subscription is initialized in
/// SupabaseService — we use it as an "interrupt" to wake the polling loop
/// instead of waiting for the next interval. Polling is the floor.
/// </summary>
public sealed class Worker : BackgroundService
{
    private readonly BridgeAppOptions _opts;
    private readonly SupabaseService _supabase;
    private readonly IPosAdapter _pos;
    private readonly ILogger<Worker> _log;

    public Worker(
        IOptions<BridgeAppOptions> opts,
        SupabaseService supabase,
        IPosAdapter pos,
        ILogger<Worker> log)
    {
        _opts = opts.Value;
        _supabase = supabase;
        _pos = pos;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation(
            "BridgeApp starting · instance={Instance} pollEvery={Sec}s batch={Batch}",
            _opts.InstanceId, _opts.PollingIntervalSeconds, _opts.BatchSize);

        var startedAt = DateTime.UtcNow;
        var lastHeartbeat = DateTime.MinValue;
        var lastReclaim = DateTime.MinValue;
        DateTime? lastSyncAt = null;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Housekeeping before claiming, so a stranded row from a previous
                // run is back in 'pending' by the time we ask for work.
                if (DateTime.UtcNow - lastReclaim >= TimeSpan.FromMinutes(1))
                {
                    lastReclaim = DateTime.UtcNow;
                    var (reclaimed, expired) = await _supabase.ReclaimStaleAsync(
                        _opts.ReclaimClaimedAfterMinutes, _opts.MaxOrderAgeMinutes, stoppingToken);
                    if (reclaimed > 0 || expired > 0)
                        _log.LogWarning(
                            "Outbox housekeeping: {Reclaimed} stranded claim(s) returned to pending, {Expired} stale order(s) parked as failed.",
                            reclaimed, expired);
                }

                var synced = await ProcessBatchOnceAsync(stoppingToken);
                if (synced > 0) lastSyncAt = DateTime.UtcNow;

                if (DateTime.UtcNow - lastHeartbeat >= TimeSpan.FromSeconds(_opts.HeartbeatIntervalSeconds))
                {
                    lastHeartbeat = DateTime.UtcNow;
                    await _supabase.SendHeartbeatAsync(new
                    {
                        restaurant_id  = _supabase.RestaurantId,
                        instance_id    = _opts.InstanceId,
                        version        = typeof(Worker).Assembly.GetName().Version?.ToString(),
                        machine_name   = Environment.MachineName,
                        local_db_name  = _pos.DatabaseName,
                        pos_kind       = _pos.Kind,
                        uptime_seconds = (int)(DateTime.UtcNow - startedAt).TotalSeconds,
                        last_sync_at   = lastSyncAt,
                    }, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Unhandled error in worker loop; continuing.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(_opts.PollingIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException) { /* clean shutdown */ }
        }

        _log.LogInformation("BridgeApp stopping.");
    }

    /// <summary>Returns how many rows were successfully written to the POS.</summary>
    private async Task<int> ProcessBatchOnceAsync(CancellationToken ct)
    {
        var batch = await _supabase.ClaimBatchAsync(_opts.InstanceId, _opts.BatchSize, ct);
        if (batch.Count == 0) return 0;

        _log.LogInformation("Claimed {Count} outbox row(s).", batch.Count);
        var synced = 0;

        foreach (var row in batch)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var payload = row.Payload.Deserialize<OutboxPayload>()
                    ?? throw new InvalidOperationException("Outbox payload was null after deserialize.");

                var menuLinkInvoiceNo = row.MenuLinkInvoiceNo ?? 0;
                var result = await _pos.WriteOrderAsync(payload, menuLinkInvoiceNo, ct);
                await _supabase.MarkSyncedAsync(row.Id, result, ct);
                synced++;

                _log.LogInformation(
                    "Synced outbox {OutboxId} (MenuLink #{MlNo}) -> POS InvoiceNo={InvoiceNo} BillNo={BillNo}",
                    row.Id, menuLinkInvoiceNo, result.PosInvoiceNo, result.PosBillNo);
            }
            catch (Exception ex)
            {
                var willRetry = (row.Attempts + 1) < _opts.MaxAttempts;
                _log.LogError(ex,
                    "Outbox {OutboxId} failed (attempt {N}/{Max}). willRetry={Retry}",
                    row.Id, row.Attempts + 1, _opts.MaxAttempts, willRetry);

                try
                {
                    await _supabase.MarkFailedAsync(row.Id, ex.Message, willRetry, ct);
                }
                catch (Exception markEx)
                {
                    _log.LogError(markEx, "Failed to record failure for {OutboxId}", row.Id);
                }
            }
        }

        return synced;
    }
}
