using Microsoft.Data.Sqlite;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>
/// Bridge-owned durable outbox (BG-2). SQLite + WAL, single logical writer (lock-guarded), migrations,
/// idempotency (unique identity key), retries, and pause/WAL-checkpoint hooks for the Codex reconcile
/// rollback (#2). Invoice PDF/PNG are NOT stored here (rendered on demand / kept outside SQLite).
/// </summary>
public sealed class SqliteOutbox : IDisposable
{
    private readonly SqliteConnection _cn;
    private readonly object _gate = new();

    public SqliteOutbox(string dbPath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(dbPath))!);
        _cn = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = dbPath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Private
        }.ToString());
        _cn.Open();
        Exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
        Migrate();
    }

    private void Migrate()
    {
        lock (_gate)
        {
            Exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);");
            long v = ScalarLong("SELECT COALESCE(MAX(version),0) FROM schema_migrations;");
            if (v < 1)
            {
                Exec(@"
CREATE TABLE send_jobs(
  job_id TEXT PRIMARY KEY,
  identity_key TEXT NOT NULL UNIQUE,
  invoice_id TEXT NOT NULL,
  bill_no TEXT,
  branch_id TEXT,
  cashier_id TEXT,
  customer_phone TEXT,
  language TEXT,
  completion_mode TEXT,
  opt_in_source TEXT,
  requested_at_utc TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TEXT,
  meta_message_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_send_jobs_status ON send_jobs(status, next_attempt_at);
CREATE INDEX ix_send_jobs_meta ON send_jobs(meta_message_id);
CREATE TABLE send_attempts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  result TEXT,
  error TEXT,
  transport TEXT
);
CREATE TABLE status_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meta_message_id TEXT NOT NULL,
  event_type TEXT,
  status_rank INTEGER,
  event_ts TEXT,
  received_at TEXT NOT NULL
);
CREATE TABLE service_state(key TEXT PRIMARY KEY, value TEXT);");
                Exec("INSERT INTO schema_migrations(version, applied_at) VALUES(1, @t);", ("@t", Now()));
            }
        }
    }

    /// <summary>Atomic idempotent enqueue. Returns true if newly inserted, false if a duplicate identity existed.</summary>
    public bool TryEnqueue(SendJob j)
    {
        lock (_gate)
        {
            using var cmd = _cn.CreateCommand();
            cmd.CommandText = @"INSERT OR IGNORE INTO send_jobs
(job_id, identity_key, invoice_id, bill_no, branch_id, cashier_id, customer_phone, language, completion_mode, opt_in_source, requested_at_utc, status, created_at, updated_at)
VALUES (@job,@idk,@inv,@bill,@br,@cash,@phone,@lang,@mode,@opt,@req,'Pending',@now,@now);";
            Bind(cmd, ("@job", j.JobId), ("@idk", j.IdentityKey), ("@inv", j.InvoiceId), ("@bill", j.BillNo),
                ("@br", j.BranchId), ("@cash", j.CashierId), ("@phone", j.CustomerPhoneE164), ("@lang", j.Language),
                ("@mode", j.CompletionMode), ("@opt", j.OptInSource), ("@req", j.RequestedAtUtc), ("@now", Now()));
            return cmd.ExecuteNonQuery() == 1;
        }
    }

    /// <summary>Claim a batch of due jobs (Pending/RetryScheduled), transitioning them to 'Sending'.</summary>
    public List<ClaimedJob> ClaimDue(int batch)
    {
        lock (_gate)
        {
            var ids = new List<string>();
            using (var sel = _cn.CreateCommand())
            {
                sel.CommandText = @"SELECT job_id FROM send_jobs
WHERE status IN ('Pending','RetryScheduled') AND (next_attempt_at IS NULL OR next_attempt_at<=@now)
ORDER BY created_at LIMIT @n;";
                Bind(sel, ("@now", Now()), ("@n", batch));
                using var r = sel.ExecuteReader();
                while (r.Read()) ids.Add(r.GetString(0));
            }
            var claimed = new List<ClaimedJob>();
            foreach (var id in ids)
            {
                Exec("UPDATE send_jobs SET status='Sending', updated_at=@now WHERE job_id=@id;", ("@now", Now()), ("@id", id));
                claimed.Add(ReadJob(id)!);
            }
            return claimed;
        }
    }

    public void RecordAttempt(string jobId, int attemptNo, string transport, string result, string? error)
    {
        lock (_gate)
            Exec("INSERT INTO send_attempts(job_id,attempt_no,started_at,result,error,transport) VALUES(@j,@a,@t,@r,@e,@tr);",
                ("@j", jobId), ("@a", attemptNo), ("@t", Now()), ("@r", result), ("@e", (object?)error ?? DBNull.Value), ("@tr", transport));
    }

    public void MarkStatus(string jobId, JobStatus status, string? error = null, string? metaMessageId = null, DateTime? nextAttemptUtc = null)
    {
        lock (_gate)
            Exec(@"UPDATE send_jobs SET status=@s, last_error=@e,
                   attempts = attempts + CASE WHEN @s IN ('Sent','FailedPermanent','RetryScheduled','BlockedByPolicy','AcceptedByMeta') THEN 1 ELSE 0 END,
                   meta_message_id=COALESCE(@mid, meta_message_id),
                   next_attempt_at=@next, updated_at=@now WHERE job_id=@id;",
                ("@s", status.ToString()), ("@e", (object?)error ?? DBNull.Value),
                ("@mid", (object?)metaMessageId ?? DBNull.Value),
                ("@next", (object?)(nextAttemptUtc?.ToString("o")) ?? DBNull.Value),
                ("@now", Now()), ("@id", jobId));
    }

    public Dictionary<string, long> CountsByStatus()
    {
        lock (_gate)
        {
            var d = new Dictionary<string, long>();
            using var cmd = _cn.CreateCommand();
            cmd.CommandText = "SELECT status, COUNT(*) FROM send_jobs GROUP BY status;";
            using var r = cmd.ExecuteReader();
            while (r.Read()) d[r.GetString(0)] = r.GetInt64(1);
            return d;
        }
    }

    // ---- pause / reconcile (Codex correction #2) ----
    public void Pause() { lock (_gate) SetState("sender_paused", "1"); }
    public void Resume() { lock (_gate) SetState("sender_paused", "0"); }
    public bool IsPaused() { lock (_gate) return GetState("sender_paused") == "1"; }

    /// <summary>WAL-checkpoint + return the in-flight set (Sending/AcceptedByMeta) for reconcile-by-meta_message_id.</summary>
    public List<ClaimedJob> CheckpointAndFreeze()
    {
        lock (_gate)
        {
            SetState("sender_paused", "1");
            Exec("PRAGMA wal_checkpoint(TRUNCATE);");
            var list = new List<ClaimedJob>();
            using var cmd = _cn.CreateCommand();
            cmd.CommandText = "SELECT job_id FROM send_jobs WHERE status IN ('Sending','AcceptedByMeta');";
            using var r = cmd.ExecuteReader();
            var ids = new List<string>();
            while (r.Read()) ids.Add(r.GetString(0));
            foreach (var id in ids) list.Add(ReadJob(id)!);
            return list;
        }
    }

    public ClaimedJob? ReadJob(string jobId)
    {
        using var cmd = _cn.CreateCommand();
        cmd.CommandText = "SELECT job_id,identity_key,invoice_id,bill_no,customer_phone,language,completion_mode,status,attempts,meta_message_id FROM send_jobs WHERE job_id=@id;";
        Bind(cmd, ("@id", jobId));
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return new ClaimedJob(r.GetString(0), r.GetString(1), r.GetString(2),
            r.IsDBNull(3) ? "" : r.GetString(3), r.IsDBNull(4) ? "" : r.GetString(4),
            r.IsDBNull(5) ? "ar" : r.GetString(5), r.IsDBNull(6) ? "" : r.GetString(6),
            Enum.TryParse<JobStatus>(r.GetString(7), out var st) ? st : JobStatus.Pending,
            r.GetInt32(8), r.IsDBNull(9) ? null : r.GetString(9));
    }

    // ---- helpers ----
    private void SetState(string k, string v) => Exec("INSERT INTO service_state(key,value) VALUES(@k,@v) ON CONFLICT(key) DO UPDATE SET value=@v;", ("@k", k), ("@v", v));
    private string? GetState(string k)
    { using var c = _cn.CreateCommand(); c.CommandText = "SELECT value FROM service_state WHERE key=@k;"; Bind(c, ("@k", k)); return c.ExecuteScalar() as string; }
    private static string Now() => DateTime.UtcNow.ToString("o");
    private void Exec(string sql, params (string, object)[] ps) { using var c = _cn.CreateCommand(); c.CommandText = sql; Bind(c, ps); c.ExecuteNonQuery(); }
    private long ScalarLong(string sql) { using var c = _cn.CreateCommand(); c.CommandText = sql; return Convert.ToInt64(c.ExecuteScalar() ?? 0L); }
    private static void Bind(SqliteCommand c, params (string n, object v)[] ps) { foreach (var (n, v) in ps) c.Parameters.AddWithValue(n, v ?? DBNull.Value); }

    public void Dispose() => _cn.Dispose();
}

/// <summary>Lightweight projection of a claimed job for the sender/reconcile paths.</summary>
public sealed record ClaimedJob(string JobId, string IdentityKey, string InvoiceId, string BillNo,
    string CustomerPhone, string Language, string CompletionMode, JobStatus Status, int Attempts, string? MetaMessageId);
