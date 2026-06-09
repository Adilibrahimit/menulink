namespace MenuLink.BridgeApp.DigitalInvoice.Gateway;

/// <summary>
/// BG-5 status sync: pulls incremental delivery statuses from the gateway (cursor-based) and applies them
/// to the local outbox monotonically, without re-sending. Persists the cursor in service_state. Heartbeat.
/// </summary>
public sealed class StatusSyncService
{
    private readonly GatewayClient _gw;
    private readonly SqliteOutbox _outbox;
    private readonly string _tenantId;
    private const string CursorKey = "status_cursor";
    private static readonly string Epoch = "1970-01-01T00:00:00.000Z";

    public StatusSyncService(GatewayClient gw, SqliteOutbox outbox, string tenantId)
    { _gw = gw; _outbox = outbox; _tenantId = tenantId; }

    /// <summary>One sync pass. Returns number of status rows applied. Startup full sync = cursor at epoch.</summary>
    public async Task<int> SyncOnceAsync(CancellationToken ct, bool fromStart = false)
    {
        string cursor = fromStart ? Epoch : (_outbox.GetServiceState(CursorKey) ?? Epoch);
        var (items, next) = await _gw.StatusSyncAsync(cursor, 200, ct);
        int applied = 0;
        foreach (var it in items)
        {
            var status = MapStatus(it.CurrentStatus);
            if (status is null) continue;
            _outbox.RecordStatusEvent(it.MetaMessageId, it.CurrentStatus, RankOf(status.Value), it.UpdatedAt);
            var jobId = _outbox.FindJobIdByMeta(it.MetaMessageId);
            if (jobId is null) continue; // status for a message this Bridge didn't send (or not yet mapped)
            _outbox.ApplyRemoteStatus(jobId, status.Value);
            applied++;
        }
        _outbox.SetServiceState(CursorKey, next);
        return applied;
    }

    public Task HeartbeatAsync(string instanceId, CancellationToken ct) => _gw.HeartbeatAsync(instanceId, ct);

    private static JobStatus? MapStatus(string s) => s switch
    {
        "Sent" => JobStatus.Sent,
        "Delivered" => JobStatus.Delivered,
        "Read" => JobStatus.Read,
        "Failed" => JobStatus.FailedPermanent,
        "AcceptedByMeta" => JobStatus.AcceptedByMeta,
        _ => null
    };
    private static int RankOf(JobStatus s) => s switch
    {
        JobStatus.AcceptedByMeta => 10, JobStatus.Sent => 20, JobStatus.Delivered => 30,
        JobStatus.Read => 40, JobStatus.FailedPermanent => 100, _ => 0
    };
}
