using System.Net;
using System.Runtime.Versioning;

namespace MenuLink.BridgeApp.DigitalInvoice.Meta;

/// <summary>
/// BG-3 self-test: DPAPI token roundtrip + cost-policy selection + Meta error classification +
/// per-tenant circuit breaker, all via a FAKE Graph HTTP handler (no real token / no network).
/// Run: dotnet run -- bg3-selftest
/// </summary>
[SupportedOSPlatform("windows")]
public static class Bg3SelfTestCommand
{
    private sealed class FakeHandler : HttpMessageHandler
    {
        public Func<HttpRequestMessage, HttpResponseMessage> Responder = _ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") };
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
            => Task.FromResult(Responder(r));
    }
    private static HttpResponseMessage Ok(HttpRequestMessage r)
    {
        string body = r.RequestUri!.AbsolutePath.EndsWith("/media")
            ? "{\"id\":\"media-123\"}"
            : "{\"messages\":[{\"id\":\"wamid.SELFTEST\"}]}";
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
    }
    private static HttpResponseMessage Err(HttpStatusCode http, int code, string msg)
        => new(http) { Content = new StringContent($"{{\"error\":{{\"code\":{code},\"message\":\"{msg}\"}}}}") };

    private sealed class FakeToken : ITokenProvider { public string? T; public string? GetToken(string id) => T; }

    public static int Run()
    {
        var fails = new List<string>();
        void Check(bool ok, string label) { Console.WriteLine($"  [{(ok ? "PASS" : "FAIL")}] {label}"); if (!ok) fails.Add(label); }
        Console.WriteLine("=== BG-3 self-test (fake Graph handler) ===");

        var handler = new FakeHandler();
        var http = new HttpClient(handler);
        var client = new MetaCloudClient(http);
        var cfg = new TenantSendConfig { TenantId = "t1", InstallationId = "inst-1", PhoneNumberId = "PN1", AllowPaidTemplate = false };
        var token = new FakeToken { T = "TESTTOKEN" };
        var job = new ClaimedJob("j1", "k1", Guid.NewGuid().ToString(), "33931", "966500000001", "ar", "SendOnly", JobStatus.Sending, 0, null);
        Func<byte[]> render = () => new byte[] { 1, 2, 3 };

        // 1) DPAPI roundtrip
        try
        {
            var store = new DpapiTokenStore(Path.Combine(Path.GetTempPath(), "bg3-secrets", Guid.NewGuid().ToString("N")[..8]));
            store.Store("inst-1", "SECRET-XYZ");
            Check(store.TryGet("inst-1") == "SECRET-XYZ" && store.TryGet("nope") == null, "DPAPI token roundtrip (protect/unprotect)");
        }
        catch (Exception ex) { Check(false, "DPAPI roundtrip threw: " + ex.Message); }

        // 2) window OPEN → free service document message → Accepted
        handler.Responder = Ok;
        var tOpen = new MetaCloudTransport(client, token, new StubWindowStateProvider(true), new CircuitBreaker(), cfg, "salt");
        var r2 = tOpen.SendAsync(job, render, CancellationToken.None).GetAwaiter().GetResult();
        Check(r2.Accepted && r2.MetaMessageId == "wamid.SELFTEST", "window OPEN → service message accepted");

        // 3) window CLOSED + paid allowed → template → Accepted
        var cfgPaid = new TenantSendConfig { TenantId = "t1", InstallationId = "inst-1", PhoneNumberId = "PN1", AllowPaidTemplate = true };
        var tTpl = new MetaCloudTransport(client, token, new StubWindowStateProvider(false), new CircuitBreaker(), cfgPaid, "salt");
        var r3 = tTpl.SendAsync(job, render, CancellationToken.None).GetAwaiter().GetResult();
        Check(r3.Accepted, "window CLOSED + paid → utility template accepted");

        // 4) window CLOSED + free-only → BlockedByPolicy (no HTTP)
        var tBlock = new MetaCloudTransport(client, token, new StubWindowStateProvider(false), new CircuitBreaker(), cfg, "salt");
        var r4 = tBlock.SendAsync(job, render, CancellationToken.None).GetAwaiter().GetResult();
        Check(r4.Blocked && !r4.Accepted, "window CLOSED + free-only → BlockedByPolicy");

        // 5) unknown window (fail-closed) + free-only → blocked
        var tUnknown = new MetaCloudTransport(client, token, new StubWindowStateProvider(null), new CircuitBreaker(), cfg, "salt");
        Check(tUnknown.SendAsync(job, render, CancellationToken.None).GetAwaiter().GetResult().Blocked, "unknown window fail-closed → blocked");

        // 6) error classification: 429 → transient ; 400/131026 → permanent
        handler.Responder = r => r.RequestUri!.AbsolutePath.EndsWith("/media") ? Ok(r) : Err(HttpStatusCode.TooManyRequests, 130429, "rate");
        var rRate = tOpen.SendAsync(job, render, CancellationToken.None).GetAwaiter().GetResult();
        Check(!rRate.Accepted && !rRate.Permanent && !rRate.Blocked, "429 rate → transient");
        handler.Responder = r => r.RequestUri!.AbsolutePath.EndsWith("/media") ? Ok(r) : Err(HttpStatusCode.BadRequest, 131026, "not on WhatsApp");
        var rPerm = new MetaCloudTransport(client, token, new StubWindowStateProvider(true), new CircuitBreaker(), cfg, "salt")
            .SendAsync(job, render, CancellationToken.None).GetAwaiter().GetResult();
        Check(rPerm.Permanent, "400/131026 not-on-WhatsApp → permanent");

        // 7) no token → transient (awaiting provisioning)
        var rNoTok = new MetaCloudTransport(client, new FakeToken { T = null }, new StubWindowStateProvider(true), new CircuitBreaker(), cfg, "salt")
            .SendAsync(job, render, CancellationToken.None).GetAwaiter().GetResult();
        Check(!rNoTok.Accepted && !rNoTok.Permanent, "missing token → transient (awaiting provisioning)");

        // 8) circuit breaker opens after threshold consecutive failures
        var breaker = new CircuitBreaker(threshold: 3, cooldown: TimeSpan.FromMinutes(5));
        handler.Responder = r => r.RequestUri!.AbsolutePath.EndsWith("/media") ? Ok(r) : Err(HttpStatusCode.ServiceUnavailable, 132000, "temp");
        var tCb = new MetaCloudTransport(client, token, new StubWindowStateProvider(true), breaker, cfg, "salt");
        for (int i = 0; i < 3; i++) tCb.SendAsync(job, render, CancellationToken.None).GetAwaiter().GetResult();
        var rOpen = tCb.SendAsync(job, render, CancellationToken.None).GetAwaiter().GetResult();
        Check(breaker.Current == CircuitBreaker.State.Open && rOpen.Error == "circuit open for tenant", "circuit breaker opens after 3 failures");

        Console.WriteLine(fails.Count == 0 ? "=== BG-3 SELF-TEST: ALL PASS ===" : $"=== BG-3 SELF-TEST: {fails.Count} FAILURE(S) ===");
        return fails.Count == 0 ? 0 : 1;
    }
}
