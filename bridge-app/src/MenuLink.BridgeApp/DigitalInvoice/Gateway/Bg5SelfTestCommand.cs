using System.Net;

namespace MenuLink.BridgeApp.DigitalInvoice.Gateway;

/// <summary>
/// BG-5 self-test: ECDSA sign↔SPKI-verify roundtrip (proves Bridge signer ≡ Worker verify), the widened
/// canonical string (Codex #2), window cache + fail-closed (Codex #3), and status-sync applying remote
/// statuses to the outbox — all via a fake HTTP handler. Run: dotnet run -- bg5-selftest
/// </summary>
public static class Bg5SelfTestCommand
{
    private sealed class FakeHandler : HttpMessageHandler
    {
        public Func<HttpRequestMessage, HttpResponseMessage> Responder = _ => new(HttpStatusCode.OK) { Content = new StringContent("{}") };
        public int Calls;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        { Calls++; return Task.FromResult(Responder(r)); }
    }

    public static int Run()
    {
        var fails = new List<string>();
        void Check(bool ok, string label) { Console.WriteLine($"  [{(ok ? "PASS" : "FAIL")}] {label}"); if (!ok) fails.Add(label); }
        Console.WriteLine("=== BG-5 self-test ===");

        // 1) ECDSA sign ↔ SPKI verify (Bridge signer ≡ Worker verify), with widened canonical message
        using (var signer = EcdsaRequestSigner.CreateEphemeral("inst-1"))
        {
            string spki = signer.PublicKeySpkiBase64;
            string method = "GET", path = "/api/v1/window";
            string cq = EcdsaRequestSigner.CanonicalQuery(new Dictionary<string, string> { ["cwh"] = "deadbeef00" });
            string bodyHash = EcdsaRequestSigner.Sha256Hex("");
            var s = signer.Sign(method, path, cq, bodyHash);
            string msg = $"{method}\n{path}\n{cq}\n{s.InstallationId}\n{s.Timestamp}\n{s.Nonce}\n{bodyHash}";
            Check(EcdsaRequestSigner.VerifyWithSpki(spki, msg, s.Signature), "ECDSA sign→SPKI verify roundtrip (P1363)");
            Check(!EcdsaRequestSigner.VerifyWithSpki(spki, msg + "x", s.Signature), "tampered message rejected");
            // cross-endpoint replay: same sig, different path must fail
            string replay = $"POST\n/api/v1/heartbeat\n\n{s.InstallationId}\n{s.Timestamp}\n{s.Nonce}\n{bodyHash}";
            Check(!EcdsaRequestSigner.VerifyWithSpki(spki, replay, s.Signature), "cross-endpoint replay rejected (Codex #2)");
        }

        // 2) window provider: open=true, cache hit (no 2nd network call), then fail-closed on error
        using (var signer = EcdsaRequestSigner.CreateEphemeral("inst-1"))
        {
            var handler = new FakeHandler { Responder = _ => new(HttpStatusCode.OK) { Content = new StringContent("{\"open\":true,\"window_expires_at\":\"2026-06-10T00:00:00Z\"}") } };
            var gw = new GatewayClient(new HttpClient(handler), signer, "https://gw.example.dev");
            var prov = new CloudflareWindowStateProvider(gw, TimeSpan.FromMinutes(5));
            var r1 = prov.IsWindowOpenAsync("t1", "cwh1", CancellationToken.None).GetAwaiter().GetResult();
            var r2 = prov.IsWindowOpenAsync("t1", "cwh1", CancellationToken.None).GetAwaiter().GetResult();
            Check(r1 == true && r2 == true, "window open=true");
            Check(handler.Calls == 1, "window result cached (1 network call for 2 lookups)");

            var errHandler = new FakeHandler { Responder = _ => new(HttpStatusCode.InternalServerError) { Content = new StringContent("boom") } };
            var provErr = new CloudflareWindowStateProvider(new GatewayClient(new HttpClient(errHandler), signer, "https://gw.example.dev"));
            var rErr = provErr.IsWindowOpenAsync("t1", "cwhX", CancellationToken.None).GetAwaiter().GetResult();
            Check(rErr == null, "gateway error → window unknown (fail-closed)");
        }

        // 3) status-sync applies a remote 'Delivered' to a local job by meta_message_id
        using (var signer = EcdsaRequestSigner.CreateEphemeral("inst-1"))
        {
            string db = Path.Combine(Path.GetTempPath(), "bg5-selftest", Guid.NewGuid().ToString("N")[..8], "ob.db");
            using var outbox = new SqliteOutbox(db);
            var job = new SendJob { JobId = Guid.NewGuid().ToString(), InvoiceId = Guid.NewGuid().ToString(), BillNo = "33931", CustomerPhoneE164 = "966500000001" };
            outbox.TryEnqueue(job);
            outbox.ClaimDue(10);
            outbox.MarkStatus(job.JobId, JobStatus.AcceptedByMeta, metaMessageId: "wamid.X1");

            var handler = new FakeHandler { Responder = _ => new(HttpStatusCode.OK)
            { Content = new StringContent("{\"items\":[{\"meta_message_id\":\"wamid.X1\",\"current_status\":\"Delivered\",\"updated_at\":\"2026-06-09T12:00:00.000Z\"}],\"cursor\":\"2026-06-09T12:00:00.000Z\"}") } };
            var gw = new GatewayClient(new HttpClient(handler), signer, "https://gw.example.dev");
            var sync = new StatusSyncService(gw, outbox, "t1");
            int applied = sync.SyncOnceAsync(CancellationToken.None).GetAwaiter().GetResult();
            var counts = outbox.CountsByStatus();
            Check(applied == 1 && counts.GetValueOrDefault("Delivered") == 1, "status-sync applied Delivered to the local job");
            Check(outbox.GetServiceState("status_cursor") == "2026-06-09T12:00:00.000Z", "status cursor advanced");
        }

        Console.WriteLine(fails.Count == 0 ? "=== BG-5 SELF-TEST: ALL PASS ===" : $"=== BG-5 SELF-TEST: {fails.Count} FAILURE(S) ===");
        return fails.Count == 0 ? 0 : 1;
    }
}
