using System.Text.Json.Serialization;

namespace MenuLink.BridgeApp.Models;

/// <summary>One row in public.pos_outbox, as returned by RPC pos_outbox_claim.</summary>
public sealed class PosOutboxRow
{
    [JsonPropertyName("id")]                  public Guid Id { get; set; }
    [JsonPropertyName("restaurant_id")]       public Guid RestaurantId { get; set; }
    [JsonPropertyName("order_id")]            public Guid OrderId { get; set; }
    [JsonPropertyName("menulink_invoice_no")] public long? MenuLinkInvoiceNo { get; set; }
    [JsonPropertyName("payload")]             public System.Text.Json.JsonElement Payload { get; set; }
    [JsonPropertyName("status")]              public string Status { get; set; } = "pending";
    [JsonPropertyName("claimed_by")]          public string? ClaimedBy { get; set; }
    [JsonPropertyName("attempts")]            public int Attempts { get; set; }
    [JsonPropertyName("last_error")]          public string? LastError { get; set; }
    [JsonPropertyName("pos_invoice_id")]      public string? PosInvoiceId { get; set; }
    [JsonPropertyName("created_at")]          public DateTime CreatedAt { get; set; }
}

/// <summary>Decoded payload of a single outbox row.</summary>
public sealed record OutboxPayload(
    [property: JsonPropertyName("order")]    OrderPayload Order,
    [property: JsonPropertyName("customer")] CustomerPayload? Customer,
    [property: JsonPropertyName("items")]    List<ItemPayload> Items,
    [property: JsonPropertyName("pos")]      PosPayload? Pos = null);

/// <summary>POS-specific settings snapshotted at enqueue time. Lets the bridge
/// pick the right InvoiceType / OnlineCustomerID per order without re-reading
/// pos_settings at run time. Nullable on the whole field for back-compat with
/// outbox rows enqueued before migration 0012.</summary>
public sealed record PosPayload(
    [property: JsonPropertyName("invoice_type")]       int? InvoiceType,
    [property: JsonPropertyName("online_customer_id")] long? OnlineCustomerId,
    [property: JsonPropertyName("counter_id")]         long? CounterId,
    [property: JsonPropertyName("section_id")]         int? SectionId);

public sealed record OrderPayload(
    [property: JsonPropertyName("id")]            Guid Id,
    [property: JsonPropertyName("restaurant_id")] Guid RestaurantId,
    [property: JsonPropertyName("order_type")]    string OrderType,
    [property: JsonPropertyName("channel")]       string Channel,
    [property: JsonPropertyName("status")]        string Status,
    [property: JsonPropertyName("subtotal")]      decimal Subtotal,
    [property: JsonPropertyName("delivery_fee")]  decimal DeliveryFee,
    [property: JsonPropertyName("total")]         decimal Total,
    [property: JsonPropertyName("address")]       string? Address,
    [property: JsonPropertyName("lat")]           decimal? Lat,
    [property: JsonPropertyName("lng")]           decimal? Lng,
    [property: JsonPropertyName("notes")]         string? Notes,
    [property: JsonPropertyName("created_at")]    DateTime CreatedAt);

public sealed record CustomerPayload(
    [property: JsonPropertyName("id")]    Guid Id,
    [property: JsonPropertyName("name")]  string? Name,
    [property: JsonPropertyName("phone")] string Phone);

public sealed record ItemPayload(
    [property: JsonPropertyName("item_name")]   string ItemName,
    [property: JsonPropertyName("variant")]     string? Variant,
    [property: JsonPropertyName("qty")]         int Qty,
    [property: JsonPropertyName("unit_price")]  decimal UnitPrice,
    [property: JsonPropertyName("line_total")]  decimal LineTotal,
    [property: JsonPropertyName("pos_item_id")] long? PosItemId);

/// <summary>Result of a successful POS write.</summary>
public sealed record PosWriteResult(string PosInvoiceId, long PosInvoiceNo, long PosBillNo);
