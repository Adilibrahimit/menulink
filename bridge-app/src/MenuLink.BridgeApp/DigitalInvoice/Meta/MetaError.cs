using System.Net;

namespace MenuLink.BridgeApp.DigitalInvoice.Meta;

/// <summary>Thrown by MetaCloudClient on a non-2xx Graph response; carries transient/permanent classification.</summary>
public sealed class MetaApiException : Exception
{
    public bool Permanent { get; }
    public int? MetaCode { get; }
    public HttpStatusCode Http { get; }
    public MetaApiException(HttpStatusCode http, int? metaCode, bool permanent, string message) : base(message)
    { Http = http; MetaCode = metaCode; Permanent = permanent; }
}

public static class MetaErrorClassifier
{
    /// <summary>
    /// Transient (retry): 408/429/500/502/503/504 + Meta codes 4 (rate), 80007, 130429, 131048/131056 (rate/spam pacing),
    /// 132000 (temporary). Permanent (no retry): 400/401/403 auth/validation, 131026 (not on WhatsApp),
    /// 132001 (template not found/rejected), 100 (invalid param), 190 (token expired/revoked).
    /// </summary>
    public static bool IsPermanent(HttpStatusCode http, int? metaCode)
    {
        int code = (int)http;
        if (code is 408 or 429 or 500 or 502 or 503 or 504) return false;
        switch (metaCode)
        {
            case 4: case 80007: case 130429: case 131048: case 131056: case 132000: return false; // transient
            case 100: case 190: case 131026: case 132001: case 132005: case 132007: case 133010: return true; // permanent
        }
        // default: 5xx transient, 4xx permanent
        return code < 500;
    }
}
