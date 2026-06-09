using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;

namespace MenuLink.BridgeApp.DigitalInvoice.Gateway;

/// <summary>
/// Signs Bridge→Gateway requests with ECDSA P-256 (Codex #1). Private key at rest via DPAPI;
/// signature is raw r||s (IEEE-P1363) which WebCrypto verify on the Worker expects. The signed
/// canonical string includes method+path+query (Codex #2 — anti cross-endpoint replay):
///   {METHOD}\n{path}\n{canonicalQuery}\n{installationId}\n{unixTs}\n{nonce}\n{sha256hex(body)}
/// </summary>
public sealed class EcdsaRequestSigner : IDisposable
{
    private readonly ECDsa _ecdsa;
    public string InstallationId { get; }

    public EcdsaRequestSigner(ECDsa ecdsa, string installationId) { _ecdsa = ecdsa; InstallationId = installationId; }

    public static EcdsaRequestSigner CreateEphemeral(string installationId)
        => new(ECDsa.Create(ECCurve.NamedCurves.nistP256), installationId);

    /// <summary>Load the installation key from DPAPI, or create+persist one. Returns signer + whether it was newly created.</summary>
    [SupportedOSPlatform("windows")]
    public static (EcdsaRequestSigner signer, bool created) LoadOrCreate(string installationId, string? secretsDir = null)
    {
        string dir = secretsDir ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "PunnelifosysDigitalInvoice", "secrets");
        Directory.CreateDirectory(dir);
        string path = Path.Combine(dir, installationId + ".eckey");
        var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        if (File.Exists(path))
        {
            byte[] pkcs8 = ProtectedData.Unprotect(File.ReadAllBytes(path), Entropy, DataProtectionScope.CurrentUser);
            ec.ImportPkcs8PrivateKey(pkcs8, out _);
            return (new EcdsaRequestSigner(ec, installationId), false);
        }
        byte[] enc = ProtectedData.Protect(ec.ExportPkcs8PrivateKey(), Entropy, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(path, enc);
        return (new EcdsaRequestSigner(ec, installationId), true);
    }
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("MenuLink.DigitalInvoice.GatewayKey.v1");

    /// <summary>base64 SPKI public key to register in D1 installations.public_key.</summary>
    public string PublicKeySpkiBase64 => Convert.ToBase64String(_ecdsa.ExportSubjectPublicKeyInfo());

    public sealed record SignedHeaders(string InstallationId, string Timestamp, string Nonce, string Signature);

    public SignedHeaders Sign(string method, string path, string canonicalQuery, string bodyHashHex)
    {
        string ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        string nonce = Guid.NewGuid().ToString("N");
        string msg = $"{method}\n{path}\n{canonicalQuery}\n{InstallationId}\n{ts}\n{nonce}\n{bodyHashHex}";
        byte[] sig = _ecdsa.SignData(Encoding.UTF8.GetBytes(msg), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        return new SignedHeaders(InstallationId, ts, nonce, Convert.ToBase64String(sig));
    }

    /// <summary>Self-test helper: verify a signature with a public key (mirrors the Worker's check).</summary>
    public static bool VerifyWithSpki(string spkiBase64, string message, string signatureBase64)
    {
        using var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        ec.ImportSubjectPublicKeyInfo(Convert.FromBase64String(spkiBase64), out _);
        return ec.VerifyData(Encoding.UTF8.GetBytes(message), Convert.FromBase64String(signatureBase64),
            HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
    }

    public static string Sha256Hex(string s)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();

    /// <summary>Canonical query = params sorted by key then value, each url-escaped, joined with '&'.
    /// Values used (hex cwh, ISO cursor, digit limit) escape identically under .NET and JS encodeURIComponent.</summary>
    public static string CanonicalQuery(IEnumerable<KeyValuePair<string, string>> parameters)
        => string.Join("&", parameters
            .OrderBy(p => p.Key, StringComparer.Ordinal).ThenBy(p => p.Value, StringComparer.Ordinal)
            .Select(p => $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

    public void Dispose() => _ecdsa.Dispose();
}
