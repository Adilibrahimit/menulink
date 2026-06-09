using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MenuLink.BridgeApp.DigitalInvoice.Meta;

/// <summary>
/// Thin WhatsApp Cloud API (Graph) client. Injectable HttpClient → unit-testable with a fake handler.
/// Token is passed per call (sourced from DPAPI; never logged). All non-2xx responses are parsed into a
/// classified MetaApiException (transient vs permanent).
/// </summary>
public sealed class MetaCloudClient
{
    private readonly HttpClient _http;
    private readonly string _ver;
    public MetaCloudClient(HttpClient http, string graphVersion = "v21.0") { _http = http; _ver = graphVersion; }

    private string Base => $"https://graph.facebook.com/{_ver}";

    public async Task<string> UploadMediaAsync(string phoneNumberId, string token, byte[] bytes, string mime, string filename, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent
        {
            { new StringContent("whatsapp"), "messaging_product" },
            { new StringContent(mime), "type" },
        };
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(mime);
        form.Add(file, "file", filename);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/{phoneNumberId}/media") { Content = form };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var resp = await _http.SendAsync(req, ct);
        var json = await ReadOrThrow(resp, ct);
        return json.RootElement.GetProperty("id").GetString()!;
    }

    public Task<string> SendDocumentAsync(string phoneNumberId, string token, string toWaId, string mediaId, string filename, string? caption, CancellationToken ct)
    {
        var body = new
        {
            messaging_product = "whatsapp",
            recipient_type = "individual",
            to = toWaId,
            type = "document",
            document = new { id = mediaId, filename, caption }
        };
        return PostMessageAsync(phoneNumberId, token, body, ct);
    }

    public Task<string> SendTemplateAsync(string phoneNumberId, string token, string toWaId, string templateName, string langCode, string headerMediaId, IReadOnlyList<string> bodyParams, CancellationToken ct)
    {
        var body = new
        {
            messaging_product = "whatsapp",
            to = toWaId,
            type = "template",
            template = new
            {
                name = templateName,
                language = new { code = langCode },
                components = new object[]
                {
                    new { type = "header", parameters = new object[] { new { type = "document", document = new { id = headerMediaId, filename = "invoice.pdf" } } } },
                    new { type = "body", parameters = bodyParams.Select(p => new { type = "text", text = p }).ToArray() }
                }
            }
        };
        return PostMessageAsync(phoneNumberId, token, body, ct);
    }

    private async Task<string> PostMessageAsync(string phoneNumberId, string token, object body, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/{phoneNumberId}/messages")
        { Content = JsonContent.Create(body) };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var resp = await _http.SendAsync(req, ct);
        var json = await ReadOrThrow(resp, ct);
        return json.RootElement.GetProperty("messages")[0].GetProperty("id").GetString()!;
    }

    private static async Task<JsonDocument> ReadOrThrow(HttpResponseMessage resp, CancellationToken ct)
    {
        string text = await resp.Content.ReadAsStringAsync(ct);
        if (resp.IsSuccessStatusCode) return JsonDocument.Parse(string.IsNullOrWhiteSpace(text) ? "{}" : text);

        int? metaCode = null; string msg = resp.ReasonPhrase ?? "error";
        try
        {
            using var err = JsonDocument.Parse(text);
            if (err.RootElement.TryGetProperty("error", out var e))
            {
                if (e.TryGetProperty("code", out var c) && c.TryGetInt32(out var ci)) metaCode = ci;
                if (e.TryGetProperty("message", out var m)) msg = m.GetString() ?? msg;
            }
        }
        catch { /* non-JSON error body */ }

        bool permanent = MetaErrorClassifier.IsPermanent(resp.StatusCode, metaCode);
        throw new MetaApiException(resp.StatusCode, metaCode, permanent, $"Meta {(int)resp.StatusCode} code={metaCode}: {msg}");
    }
}
