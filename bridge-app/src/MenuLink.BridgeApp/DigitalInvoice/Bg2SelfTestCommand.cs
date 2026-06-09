using System.Diagnostics;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// BG-2 self-test: spool → import (idempotent) → SQLite outbox → fake transport → crash/reboot recovery →
/// pause/checkpoint. No POS/DB/network. Run: dotnet run -- bg2-selftest [workDir]
/// </summary>
public static class Bg2SelfTestCommand
{
    public static int Run(string[] args)
    {
        string root = args.Length >= 2 ? args[1] : Path.Combine(Path.GetTempPath(), "bg2-selftest", Guid.NewGuid().ToString("N")[..8]);
        if (Directory.Exists(root)) Directory.Delete(root, true);
        Directory.CreateDirectory(root);
        string spool = Path.Combine(root, "spool");
        string db = Path.Combine(root, "data", "invoice-sender.db");
        var fails = new List<string>();
        void Check(bool ok, string label) { Console.WriteLine($"  [{(ok ? "PASS" : "FAIL")}] {label}"); if (!ok) fails.Add(label); }

        Console.WriteLine("=== BG-2 self-test ===");
        Console.WriteLine($"root={root}");

        SendJob MakeJob(string phone) => new()
        {
            JobId = Guid.NewGuid().ToString(),
            InvoiceId = Guid.NewGuid().ToString(),
            BillNo = Random.Shared.Next(40000, 50000).ToString(),
            BranchId = "2", CashierId = "6", CustomerPhoneE164 = phone,
            Language = "ar", CompletionMode = "SendOnly",
            RequestedAtUtc = DateTime.UtcNow.ToString("o"),
            IdempotencyKey = ""
        };

        // 1) atomic write + import
        var outbox = new SqliteOutbox(db);
        var importer = new SpoolImporter(spool, outbox);
        var good = new[] { MakeJob("966500000001"), MakeJob("966500000002"), MakeJob("966500000003") };
        var fatal = MakeJob("000000000000"); // fake transport => permanent fail
        foreach (var j in good) importer.WriteAtomic(j);
        importer.WriteAtomic(fatal);
        var r1 = importer.Sweep();
        Console.WriteLine($"  sweep#1 {r1}");
        Check(r1.Imported == 4 && r1.Quarantined == 0, "imported 4 valid jobs");

        // 2) idempotency: re-write one of the same jobs (same JobId/identity) → duplicate, not re-imported
        importer.WriteAtomic(good[0]);
        var r2 = importer.Sweep();
        Console.WriteLine($"  sweep#2 {r2}");
        Check(r2.Duplicates == 1 && r2.Imported == 0, "duplicate file is idempotent (not re-imported)");

        // 3) quarantine: malformed file
        File.WriteAllText(Path.Combine(spool, "incoming", "bad.json"), "{ this is not valid json ");
        var r3 = importer.Sweep();
        Check(r3.Quarantined == 1, "malformed file quarantined");

        // 4) crash/reboot recovery: dispose + reopen on same DB → pending jobs survive
        var before = outbox.CountsByStatus().GetValueOrDefault("Pending");
        outbox.Dispose();
        var outbox2 = new SqliteOutbox(db);
        var after = outbox2.CountsByStatus().GetValueOrDefault("Pending");
        Check(before == 4 && after == 4, $"reboot recovery: {after} pending survived restart");

        // 5) process via fake transport: 3 accepted, 1 permanent-fail
        var pipeline = new SenderPipeline(outbox2, new FakeTransport(), _ => new byte[] { 1, 2, 3 }, maxAttempts: 5);
        int processed = pipeline.ProcessDueAsync(50, CancellationToken.None).GetAwaiter().GetResult();
        var counts = outbox2.CountsByStatus();
        Console.WriteLine("  counts: " + string.Join(", ", counts.Select(kv => $"{kv.Key}={kv.Value}")));
        Check(processed == 4, "processed all due jobs");
        Check(counts.GetValueOrDefault("AcceptedByMeta") == 3, "3 jobs accepted (meta id assigned)");
        Check(counts.GetValueOrDefault("FailedPermanent") == 1, "1 job permanently failed (not on WhatsApp)");

        // 6) pause/checkpoint (reconcile-rollback hook): in-flight = the 3 AcceptedByMeta
        var inflight = outbox2.CheckpointAndFreeze();
        Check(outbox2.IsPaused(), "sender paused after checkpoint");
        Check(inflight.Count == 3, $"checkpoint froze {inflight.Count} in-flight job(s) for reconcile");
        Check(pipeline.ProcessDueAsync(50, CancellationToken.None).GetAwaiter().GetResult() == 0, "paused pipeline processes nothing");

        // 7) enqueue latency benchmark (atomic write + import)
        var sw = Stopwatch.StartNew();
        const int N = 50;
        for (int i = 0; i < N; i++) importer.WriteAtomic(MakeJob("9665" + i.ToString("D8")));
        outbox2.Resume();
        importer.Sweep();
        sw.Stop();
        double perJob = sw.Elapsed.TotalMilliseconds / N;
        Console.WriteLine($"  enqueue+import avg = {perJob:F1} ms/job over {N} jobs");
        Check(perJob < 300, "enqueue under 300ms/job");

        outbox2.Dispose();
        Console.WriteLine(fails.Count == 0 ? "=== BG-2 SELF-TEST: ALL PASS ===" : $"=== BG-2 SELF-TEST: {fails.Count} FAILURE(S) ===");
        return fails.Count == 0 ? 0 : 1;
    }
}
