namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>Result of a delivery attempt.</summary>
public sealed record SendResult(bool Accepted, string? MetaMessageId, bool Permanent, string? Error, bool Blocked = false)
{
    public static SendResult Ok(string id) => new(true, id, false, null);
    public static SendResult Transient(string err) => new(false, null, false, err);
    public static SendResult Fatal(string err) => new(false, null, true, err);
    /// <summary>Cost policy blocked the send (out-of-window + paid templates disabled). Durable, no retry.</summary>
    public static SendResult BlockedByPolicy(string err) => new(false, null, false, err, true);
}

/// <summary>
/// Delivery transport abstraction. BG-2 uses FakeTransport for self-tests; BG-3 adds the real
/// Meta Cloud API transport. The sender pipeline depends only on this interface.
/// </summary>
public interface IInvoiceTransport
{
    /// <param name="job">claimed job</param>
    /// <param name="renderPdf">lazy: renders the invoice PDF bytes on demand</param>
    Task<SendResult> SendAsync(ClaimedJob job, Func<byte[]> renderPdf, CancellationToken ct);
}

/// <summary>Deterministic in-memory transport for tests: accepts unless the phone starts with '000'.</summary>
public sealed class FakeTransport : IInvoiceTransport
{
    private int _seq;
    public Task<SendResult> SendAsync(ClaimedJob job, Func<byte[]> renderPdf, CancellationToken ct)
    {
        _ = renderPdf(); // exercise the render path
        if (job.CustomerPhone.StartsWith("000")) return Task.FromResult(SendResult.Fatal("not on WhatsApp"));
        return Task.FromResult(SendResult.Ok($"wamid.FAKE{System.Threading.Interlocked.Increment(ref _seq):D6}"));
    }
}
