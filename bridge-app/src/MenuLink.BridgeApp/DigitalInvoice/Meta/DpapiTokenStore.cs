using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;

namespace MenuLink.BridgeApp.DigitalInvoice.Meta;

/// <summary>
/// Per-installation Meta access token at rest, protected with Windows DPAPI (CurrentUser scope).
/// The token NEVER appears in appsettings, source, logs, git, or D1 (Codex/SECURITY.md). Stored as a
/// DPAPI-encrypted blob under %ProgramData%\PunnelifosysDigitalInvoice\secrets\{installationId}.token.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class DpapiTokenStore : ITokenProvider
{
    public string? GetToken(string installationId) => TryGet(installationId);

    private readonly string _dir;
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("MenuLink.DigitalInvoice.MetaToken.v1");

    public DpapiTokenStore(string? root = null)
    {
        _dir = root ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "PunnelifosysDigitalInvoice", "secrets");
        Directory.CreateDirectory(_dir);
    }

    private string PathFor(string installationId) => Path.Combine(_dir, installationId + ".token");

    public void Store(string installationId, string token)
    {
        byte[] enc = ProtectedData.Protect(Encoding.UTF8.GetBytes(token), Entropy, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(PathFor(installationId), enc);
    }

    public string? TryGet(string installationId)
    {
        string p = PathFor(installationId);
        if (!File.Exists(p)) return null;
        try
        {
            byte[] dec = ProtectedData.Unprotect(File.ReadAllBytes(p), Entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(dec);
        }
        catch (CryptographicException) { return null; } // wrong user / corrupted
    }

    public bool Exists(string installationId) => File.Exists(PathFor(installationId));
    public void Delete(string installationId) { var p = PathFor(installationId); if (File.Exists(p)) File.Delete(p); }
}
