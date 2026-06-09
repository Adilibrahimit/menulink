using System.Collections.Concurrent;
using MenuLink.BridgeApp.DigitalInvoice.Meta;

namespace MenuLink.BridgeApp.DigitalInvoice.Gateway;

/// <summary>
/// IWindowStateProvider backed by the Cloudflare gateway (Codex #3) with a short-TTL cache.
/// FAIL-CLOSED: any error/timeout returns null → MetaCloudTransport treats unknown as CLOSED.
/// </summary>
public sealed class CloudflareWindowStateProvider : IWindowStateProvider
{
    private readonly GatewayClient _gw;
    private readonly TimeSpan _ttl;
    private readonly Func<DateTime> _now;
    private readonly ConcurrentDictionary<string, (bool open, DateTime at)> _cache = new();

    public CloudflareWindowStateProvider(GatewayClient gw, TimeSpan? ttl = null, Func<DateTime>? now = null)
    { _gw = gw; _ttl = ttl ?? TimeSpan.FromMinutes(2); _now = now ?? (() => DateTime.UtcNow); }

    public async Task<bool?> IsWindowOpenAsync(string tenantId, string customerWaIdHash, CancellationToken ct)
    {
        if (_cache.TryGetValue(customerWaIdHash, out var c) && _now() - c.at < _ttl)
            return c.open;
        try
        {
            var open = await _gw.GetWindowOpenAsync(customerWaIdHash, ct);
            if (open is bool b) _cache[customerWaIdHash] = (b, _now());
            return open; // may be null (unknown) → caller fails-closed
        }
        catch
        {
            return null; // fail-closed
        }
    }
}
