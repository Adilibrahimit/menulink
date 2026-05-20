using MenuLink.BridgeApp;
using MenuLink.BridgeApp.Pos;
using MenuLink.BridgeApp.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.Extensions.Options;
using Serilog;

// ---------------------------------------------------------------------------
// MenuLink Bridge App · entry point
//
// Default behaviour: console mode. Add `--service` switch (or install via
// `sc.exe create ...`) to run as a Windows Service.
// ---------------------------------------------------------------------------

var options = new HostApplicationBuilderSettings
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory,
    ApplicationName = "MenuLink.BridgeApp"
};

var builder = Host.CreateApplicationBuilder(options);

// appsettings.json + appsettings.{Environment}.json + appsettings.Local.json + env vars
builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables(prefix: "MENULINK_BRIDGE_");

// Serilog from configuration
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .CreateLogger();
builder.Logging.ClearProviders();
builder.Logging.AddSerilog(Log.Logger, dispose: true);

// Strongly-typed options
builder.Services.Configure<BridgeAppOptions>(builder.Configuration.GetSection("BridgeApp"));
builder.Services.Configure<SupabaseOptions>(builder.Configuration.GetSection("Supabase"));
builder.Services.Configure<PosOptions>(builder.Configuration.GetSection("Pos"));

// Adapter selection (single-POS for now — switch on Pos:Kind when adding others)
builder.Services.AddSingleton<IPosAdapter, RzrzPosAdapter>();

// HttpClient factory + Supabase REST wrapper
builder.Services.AddHttpClient<SupabaseService>();
builder.Services.AddHostedService<Worker>();

// Windows Service support — picked up automatically when running under SCM
builder.Services.AddWindowsService(opts =>
{
    opts.ServiceName = "MenuLink Bridge App";
});

try
{
    var host = builder.Build();
    Log.Information("Starting MenuLink Bridge App (managed={Managed})", WindowsServiceHelpers.IsWindowsService());
    await host.RunAsync();
    return 0;
}
catch (Exception ex)
{
    Log.Fatal(ex, "Bridge App terminated unexpectedly.");
    return 1;
}
finally
{
    Log.CloseAndFlush();
}
