namespace MenuLink.BridgeApp.DigitalInvoice.Meta;

/// <summary>
/// Per-tenant circuit breaker (BG-3). Opens after N consecutive failures; half-opens after a cooldown;
/// a success closes it. Prevents a broken tenant credential from hammering Meta and isolates tenants.
/// Time is injectable for deterministic tests.
/// </summary>
public sealed class CircuitBreaker
{
    public enum State { Closed, Open, HalfOpen }

    private readonly int _threshold;
    private readonly TimeSpan _cooldown;
    private readonly Func<DateTime> _now;
    private int _consecutiveFailures;
    private DateTime _openedAt;
    private State _state = State.Closed;
    private readonly object _gate = new();

    public CircuitBreaker(int threshold = 5, TimeSpan? cooldown = null, Func<DateTime>? now = null)
    { _threshold = threshold; _cooldown = cooldown ?? TimeSpan.FromMinutes(2); _now = now ?? (() => DateTime.UtcNow); }

    public State Current { get { lock (_gate) { return Evaluate(); } } }

    /// <summary>True if a call may proceed (Closed or HalfOpen probe).</summary>
    public bool AllowRequest() { lock (_gate) { return Evaluate() != State.Open; } }

    public void RecordSuccess()
    { lock (_gate) { _consecutiveFailures = 0; _state = State.Closed; } }

    public void RecordFailure()
    {
        lock (_gate)
        {
            _consecutiveFailures++;
            if (_consecutiveFailures >= _threshold) { _state = State.Open; _openedAt = _now(); }
        }
    }

    private State Evaluate()
    {
        if (_state == State.Open && _now() - _openedAt >= _cooldown) _state = State.HalfOpen;
        return _state;
    }
}
