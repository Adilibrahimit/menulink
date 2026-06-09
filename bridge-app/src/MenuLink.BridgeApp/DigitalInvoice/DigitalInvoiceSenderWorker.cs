using System.Runtime.Versioning;
using MenuLink.BridgeApp.DigitalInvoice.Gateway;
using MenuLink.BridgeApp.DigitalInvoice.Meta;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace MenuLink.BridgeApp.DigitalInvoice;

/// <summary>Config (DigitalInvoice:*). Defaults keep the subsystem OFF so the live pos_outbox service is unaffected.</summary>
public sealed class DigitalInvoiceOptions
{
    public bool Enabled { get; set; } = false;
    public string SpoolRoot { get; set; } = @"C:\ProgramData\PunnelifosysDigitalInvoice\spool";
    public string DbPath { get; set; } = @"C:\ProgramData\PunnelifosysDigitalInvoice\data\invoice-sender.db";
    public string GatewayUrl { get; set; } = "";
    public string InstallationId { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string PhoneNumberId { get; set; } = "";
    public bool AllowPaidTemplate { get; set; } = false;
    public string UtilityTemplateName { get; set; } = "invoice_ready";
    public string UtilityTemplateLang { get; set; } = "ar";
    public string GraphVersion { get; set; } = "v21.0";
    public string WindowSalt { get; set; } = "";
    public int PollingIntervalSeconds { get; set; } = 10;
    public int BatchSize { get; set; } = 5;
    public int MaxAttempts { get; set; } = 5;
    public int HeartbeatEverySeconds { get; set; } = 60;
    public CompanyProfile Company { get; set; } = new();
}

/// <summary>
/// BG-5/6 co-hosted background sender: spool import → render → Meta send (cost policy) → register mapping →
/// status sync. Self-disables unless DigitalInvoice:Enabled=true. Windows-only (DPAPI + rendering).
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class DigitalInvoiceSenderWorker : BackgroundService
{
    private readonly DigitalInvoiceOptions _o;
    private readonly string _posConn;
    private readonly string _instanceId;
    private readonly ILogger<DigitalInvoiceSenderWorker> _log;

    public DigitalInvoiceSenderWorker(DigitalInvoiceOptions o, IConfiguration config, ILogger<DigitalInvoiceSenderWorker> log)
    {
        _o = o;
        _posConn = config["Pos:ConnectionString"] ?? "";
        _instanceId = config["BridgeApp:InstanceId"] ?? Environment.MachineName.ToLowerInvariant();
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!_o.Enabled) { _log.LogInformation("DigitalInvoice sender disabled (DigitalInvoice:Enabled=false)."); return; }
        if (string.IsNullOrWhiteSpace(_o.GatewayUrl) || string.IsNullOrWhiteSpace(_o.InstallationId) || string.IsNullOrWhiteSpace(_posConn))
        { _log.LogError("DigitalInvoice sender enabled but missing GatewayUrl/InstallationId/Pos:ConnectionString — staying idle."); return; }

        using var outbox = new SqliteOutbox(_o.DbPath);
        var importer = new SpoolImporter(_o.SpoolRoot, outbox);
        var (signer, created) = EcdsaRequestSigner.LoadOrCreate(_o.InstallationId);
        if (created) _log.LogWarning("New installation key created. Register public key with the gateway: {Spki}", signer.PublicKeySpkiBase64);

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        var gateway = new GatewayClient(http, signer, _o.GatewayUrl);
        var windows = new CloudflareWindowStateProvider(gateway);
        var tokens = new DpapiTokenStore();
        using var metaHttp = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        var metaClient = new MetaCloudClient(metaHttp, _o.GraphVersion);
        var breaker = new CircuitBreaker();
        var cfg = new TenantSendConfig
        {
            TenantId = _o.TenantId, InstallationId = _o.InstallationId, PhoneNumberId = _o.PhoneNumberId,
            AllowPaidTemplate = _o.AllowPaidTemplate, UtilityTemplateName = _o.UtilityTemplateName,
            UtilityTemplateLang = _o.UtilityTemplateLang, GraphVersion = _o.GraphVersion
        };
        var transport = new MetaCloudTransport(metaClient, tokens, windows, breaker, cfg, _o.WindowSalt);

        var loader = new InvoiceDataLoader(_posConn);
        var renderer = new InvoicePdfRenderer();
        byte[] Render(ClaimedJob j)
        {
            var lang = j.Language?.ToLowerInvariant() switch { "en" => RenderLanguage.English, "bi" or "bilingual" => RenderLanguage.Bilingual, _ => RenderLanguage.Arabic };
            var model = loader.Load(Guid.Parse(j.InvoiceId), lang, _o.Company);
            return renderer.RenderPdf(model);
        }
        async Task OnAccepted(ClaimedJob j, string metaId, CancellationToken c)
            => await gateway.RegisterMappingAsync(_o.TenantId, j.JobId, EcdsaRequestSigner.Sha256Hex(j.InvoiceId), metaId, _o.PhoneNumberId, c);

        var pipeline = new SenderPipeline(outbox, transport, Render, _o.MaxAttempts, OnAccepted);
        var statusSync = new StatusSyncService(gateway, outbox, _o.TenantId);

        _log.LogInformation("DigitalInvoice sender started · instance={I} gateway={G}", _instanceId, _o.GatewayUrl);
        try { await statusSync.SyncOnceAsync(ct, fromStart: true); } catch (Exception ex) { _log.LogWarning(ex, "startup status sync failed (will retry)"); }

        var lastBeat = DateTime.MinValue;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                importer.Sweep();
                await pipeline.ProcessDueAsync(_o.BatchSize, ct);
                await statusSync.SyncOnceAsync(ct);
                if ((DateTime.UtcNow - lastBeat).TotalSeconds >= _o.HeartbeatEverySeconds)
                { try { await statusSync.HeartbeatAsync(_instanceId, ct); lastBeat = DateTime.UtcNow; } catch { /* non-fatal */ } }
            }
            catch (Exception ex) { _log.LogError(ex, "DigitalInvoice sender loop error; continuing."); }
            try { await Task.Delay(TimeSpan.FromSeconds(_o.PollingIntervalSeconds), ct); } catch (OperationCanceledException) { }
        }
    }
}
