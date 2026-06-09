namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// Claims due jobs and delivers them through an IInvoiceTransport with exponential backoff + jitter
/// (BG-2 mechanics; reused by the real worker in BG-3/5). Honors the outbox pause flag (reconcile/rollback).
/// </summary>
public sealed class SenderPipeline
{
    private readonly SqliteOutbox _outbox;
    private readonly IInvoiceTransport _transport;
    private readonly Func<ClaimedJob, byte[]> _render;
    private readonly int _maxAttempts;
    private readonly Random _rng = new(12345); // fixed seed → deterministic tests; jitter only

    public SenderPipeline(SqliteOutbox outbox, IInvoiceTransport transport, Func<ClaimedJob, byte[]> render, int maxAttempts = 5)
    { _outbox = outbox; _transport = transport; _render = render; _maxAttempts = maxAttempts; }

    public async Task<int> ProcessDueAsync(int batch, CancellationToken ct)
    {
        if (_outbox.IsPaused()) return 0; // single-active-transport / reconcile in progress
        var jobs = _outbox.ClaimDue(batch);
        int done = 0;
        foreach (var job in jobs)
        {
            if (ct.IsCancellationRequested) break;
            int attemptNo = job.Attempts + 1;
            SendResult res;
            try { res = await _transport.SendAsync(job, () => _render(job), ct); }
            catch (Exception ex) { res = SendResult.Transient(ex.Message); }

            _outbox.RecordAttempt(job.JobId, attemptNo, _transport.GetType().Name,
                res.Accepted ? "accepted" : (res.Permanent ? "fatal" : "transient"), res.Error);

            if (res.Accepted)
                _outbox.MarkStatus(job.JobId, JobStatus.AcceptedByMeta, metaMessageId: res.MetaMessageId);
            else if (res.Permanent)
                _outbox.MarkStatus(job.JobId, JobStatus.FailedPermanent, error: res.Error);
            else if (attemptNo >= _maxAttempts)
                _outbox.MarkStatus(job.JobId, JobStatus.FailedPermanent, error: $"max attempts: {res.Error}");
            else
                _outbox.MarkStatus(job.JobId, JobStatus.RetryScheduled, error: res.Error, nextAttemptUtc: NextAttempt(attemptNo));
            done++;
        }
        return done;
    }

    private DateTime NextAttempt(int attemptNo)
    {
        double baseSec = Math.Min(300, Math.Pow(2, attemptNo)); // 2,4,8,16,…capped 5min
        double jitter = _rng.NextDouble() * baseSec * 0.25;
        return DateTime.UtcNow.AddSeconds(baseSec + jitter);
    }
}
