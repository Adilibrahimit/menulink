namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// Imports atomic JSON spool files written by the POS Helper into the SQLite outbox (BG-2).
/// Layout under the spool root:  incoming\  processed\  quarantine\
/// The Helper writes {job}.json.tmp → fsync → rename {job}.json (atomic). Import is idempotent
/// (outbox unique identity), so a duplicate or replayed file is a no-op.
/// </summary>
public sealed class SpoolImporter
{
    private readonly string _incoming, _processed, _quarantine;
    private readonly SqliteOutbox _outbox;

    public SpoolImporter(string spoolRoot, SqliteOutbox outbox)
    {
        _incoming = Path.Combine(spoolRoot, "incoming");
        _processed = Path.Combine(spoolRoot, "processed");
        _quarantine = Path.Combine(spoolRoot, "quarantine");
        foreach (var d in new[] { _incoming, _processed, _quarantine }) Directory.CreateDirectory(d);
        _outbox = outbox;
    }

    /// <summary>Atomic write used by tests (and mirrored by the Helper in BG-6): tmp → rename.</summary>
    public string WriteAtomic(SendJob job)
    {
        string final = Path.Combine(_incoming, job.JobId + ".json");
        string tmp = final + ".tmp";
        using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
        using (var sw = new StreamWriter(fs, new System.Text.UTF8Encoding(false)))
        { sw.Write(job.ToJson()); sw.Flush(); fs.Flush(true); }
        File.Move(tmp, final, overwrite: true);
        return final;
    }

    public ImportResult Sweep()
    {
        var res = new ImportResult();
        foreach (var path in Directory.EnumerateFiles(_incoming, "*.json"))
        {
            // skip a half-written .json.tmp (only *.json matched anyway)
            try
            {
                string json = File.ReadAllText(path);
                var job = SendJob.FromJson(json);
                if (job is null || string.IsNullOrWhiteSpace(job.JobId) || string.IsNullOrWhiteSpace(job.InvoiceId))
                { Quarantine(path, "invalid/empty job"); res.Quarantined++; continue; }
                bool inserted = _outbox.TryEnqueue(job);
                if (inserted) res.Imported++; else res.Duplicates++;
                MoveTo(_processed, path);
            }
            catch (IOException) { res.Skipped++; /* file still being written / locked — retry next sweep */ }
            catch (Exception ex) { Quarantine(path, ex.Message); res.Quarantined++; }
        }
        return res;
    }

    private void Quarantine(string path, string reason)
    {
        try
        {
            MoveTo(_quarantine, path);
            File.WriteAllText(Path.Combine(_quarantine, Path.GetFileNameWithoutExtension(path) + ".reason.txt"), reason);
        }
        catch { /* best-effort */ }
    }

    private static void MoveTo(string dir, string path)
    {
        string dest = Path.Combine(dir, Path.GetFileName(path));
        if (File.Exists(dest)) dest = Path.Combine(dir, Path.GetFileNameWithoutExtension(path) + "-" + Guid.NewGuid().ToString("N")[..8] + Path.GetExtension(path));
        File.Move(path, dest, overwrite: false);
    }
}

public sealed class ImportResult
{
    public int Imported, Duplicates, Quarantined, Skipped;
    public override string ToString() => $"imported={Imported} duplicates={Duplicates} quarantined={Quarantined} skipped={Skipped}";
}
