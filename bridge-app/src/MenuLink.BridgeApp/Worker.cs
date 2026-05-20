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

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchOnceAsync(stoppingToken);
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

    private async Task ProcessBatchOnceAsync(CancellationToken ct)
    {
        var batch = await _supabase.ClaimBatchAsync(_opts.InstanceId, _opts.BatchSize, ct);
        if (batch.Count == 0) return;

        _log.LogInformation("Claimed {Count} outbox row(s).", batch.Count);

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
    }
}
