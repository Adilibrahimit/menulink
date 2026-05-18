# SQL Patterns · InsertInvoice & Friends

> Read when building integration code that talks to RzRz or any SQL-based POS.

## The Two XML Inputs To `InsertInvoice`

### XmlInvoice (the order header)

```xml
<Invoice 
  InvoiceID="00000000-0000-0000-0000-000000000000"
  InvoiceAmount="79.00"
  InvoiceType="1"
  TableID="0"
  InvoiceNotes=""
  InvoiceNotes_A="طلب من تطبيق MenuLink · أحمد · 0501234567"
  DiscountAmount="0"
  CreatedBy="999"
  CounterID="999"
  CustomerID="0"
  InvoiceDiscountPercentage="0"
  AdvanceRentID="0"
  OnlineCustomerID="999"
  TobaccoVatAmount="0"
/>
```

**Field meanings:**

| Attribute | Type | What it is |
|-----------|------|------------|
| `InvoiceID` | GUID | Pass empty GUID for new order — proc generates one |
| `InvoiceAmount` | float | Total before tax (procedure adds tax) |
| `InvoiceType` | int | 1=regular, 5-8=dine-in, 9=event |
| `TableID` | bigint | 0 for delivery/pickup, table # for dine-in |
| `InvoiceNotes` | nvarchar | English notes |
| `InvoiceNotes_A` | nvarchar | **Arabic notes** — put customer name + phone here |
| `DiscountAmount` | float | Total discount applied |
| `CreatedBy` | bigint | User ID — use a dedicated "MenuLink Bot" user |
| `CounterID` | bigint | Physical counter — use a dedicated virtual counter |
| `CustomerID` | bigint | 0 for walk-in, > 0 for registered customers |
| `OnlineCustomerID` | bigint | ⭐ **Always set this for MenuLink orders** to flag the source |
| `TobaccoVatAmount` | float | 0 unless menu has tobacco products |

### XmlItems (the line items)

```xml
<Items>
  <Items 
    ItemID="1245"
    Qty="2"
    Rate="20.00"
    Amount="40.00"
    DiscountAmount="0"
    Notes=""
    Notes_A="بدون بصل"
    DisplayOrder="1"
    TaxPercent="15"
  />
  <Items 
    ItemID="1267"
    Qty="1"
    Rate="39.00"
    Amount="39.00"
    DiscountAmount="0"
    Notes=""
    Notes_A=""
    DisplayOrder="2"
    TaxPercent="15"
  />
</Items>
```

**Notes:**
- `ItemID` MUST match a real row in RzRz `Items` table — get this from the menu mapping
- `Rate` is the unit price; `Amount` is Qty × Rate (yes, redundant — pass both)
- `Notes_A` is where customer-requested modifications go ("بدون بصل" = without onion)
- `TaxPercent` should equal the value in `GeneralSettings.Tax` (usually 15 for Saudi VAT)

---

## Complete TypeScript Function (Supabase Edge Function)

```typescript
// supabase/functions/sync-order-to-rzrz/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { Connection, Request, TYPES } from "https://deno.land/x/tedious/mod.ts";

interface MenuLinkOrder {
  order_id: string;
  total: number;
  notes_ar?: string;
  customer_name: string;
  customer_phone: string;
  order_type: "delivery" | "pickup" | "dinein";
  items: Array<{
    pos_item_id: number;
    qty: number;
    unit_price: number;
    notes_ar?: string;
  }>;
}

function buildInvoiceXml(order: MenuLinkOrder, config: any): string {
  const invoiceType = order.order_type === "dinein" ? 5 : 1;
  const customerHeader = `${order.customer_name} · ${order.customer_phone}`;
  const fullNotes = order.notes_ar 
    ? `${customerHeader} · ${order.notes_ar}` 
    : customerHeader;
  
  return `<Invoice 
    InvoiceID="00000000-0000-0000-0000-000000000000"
    InvoiceAmount="${order.total}"
    InvoiceType="${invoiceType}"
    TableID="0"
    InvoiceNotes=""
    InvoiceNotes_A="${escapeXml(fullNotes)}"
    DiscountAmount="0"
    CreatedBy="${config.created_by}"
    CounterID="${config.counter_id}"
    CustomerID="0"
    InvoiceDiscountPercentage="0"
    AdvanceRentID="0"
    OnlineCustomerID="${config.online_customer_id}"
    TobaccoVatAmount="0"
  />`;
}

function buildItemsXml(order: MenuLinkOrder): string {
  const items = order.items.map((item, i) => `
    <Items 
      ItemID="${item.pos_item_id}"
      Qty="${item.qty}"
      Rate="${item.unit_price}"
      Amount="${(item.qty * item.unit_price).toFixed(2)}"
      DiscountAmount="0"
      Notes=""
      Notes_A="${escapeXml(item.notes_ar || '')}"
      DisplayOrder="${i + 1}"
      TaxPercent="15"
    />`).join('');
  
  return `<Items>${items}</Items>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

serve(async (req) => {
  const order: MenuLinkOrder = await req.json();
  const config = JSON.parse(Deno.env.get("RZRZ_CONFIG") || "{}");
  
  const xmlInvoice = buildInvoiceXml(order, config);
  const xmlItems = buildItemsXml(order);
  
  // Connect to SQL Server
  const connection = new Connection({
    server: Deno.env.get("RZRZ_DB_HOST")!,
    authentication: {
      type: "default",
      options: {
        userName: Deno.env.get("RZRZ_DB_USER")!,
        password: Deno.env.get("RZRZ_DB_PASS")!,
      },
    },
    options: {
      database: Deno.env.get("RZRZ_DB_NAME")!,
      encrypt: false,
    },
  });
  
  return new Promise((resolve) => {
    connection.on("connect", (err) => {
      if (err) {
        resolve(new Response(JSON.stringify({ error: err.message }), { status: 500 }));
        return;
      }
      
      const request = new Request("InsertInvoice", (err, rowCount) => {
        connection.close();
        if (err) {
          resolve(new Response(JSON.stringify({ error: err.message }), { status: 500 }));
        } else {
          resolve(new Response(JSON.stringify({ success: true, rowCount }), { status: 200 }));
        }
      });
      
      request.addParameter("XmlInvoice", TYPES.NVarChar, xmlInvoice);
      request.addParameter("XmlItems", TYPES.NVarChar, xmlItems);
      request.addParameter("IsHold", TYPES.Bit, 0);
      request.addParameter("SectionID", TYPES.Int, 0);
      request.addParameter("InvoiceType", TYPES.Int, order.order_type === "dinein" ? 5 : 1);
      request.addParameter("AppendInvoiceIDS", TYPES.NVarChar, "");
      
      connection.callProcedure(request);
    });
    
    connection.connect();
  });
});
```

**Note:** This is a starting point. Issues to handle in production:
- Idempotency (don't double-insert if MenuLink retries)
- Error mapping (SQL errors → user-friendly responses)
- Connection pooling (for restaurants with high order volume)
- Logging (every successful insert → Supabase logs table)

---

## Useful Read Queries (For Debugging & Verification)

### Find an order we just inserted

```sql
SELECT TOP 1 *
FROM Invoice
WHERE OnlineCustomerID = 999  -- our MenuLink flag
ORDER BY InvoiceDate DESC, InvoiceNo DESC;
```

### Confirm kitchen got the print job

```sql
SELECT k.*, i.Item_A
FROM KitichenOrderForPrint k
JOIN Items i ON i.ItemID = k.ItemID
WHERE k.InvoiceID = '<the-invoice-guid>'
ORDER BY k.DisplayOrder;
```

If this returns rows, the kitchen printer should have fired.

### List all online orders today

```sql
SELECT i.InvoiceNo, i.InvoiceAmount, i.InvoiceNotes_A, i.InvoiceDate
FROM Invoice i
WHERE i.OnlineCustomerID > 0
  AND CAST(i.InvoiceDate AS DATE) = CAST(GETDATE() AS DATE)
ORDER BY i.InvoiceDate DESC;
```

### Find an item by Arabic name

```sql
SELECT ItemID, Item, Item_A, Rate
FROM Items
WHERE Item_A LIKE N'%بروستد%' AND IsActive = 1;
```

### Get the daily summary the way RzRz reports show it

```sql
SELECT 
  COUNT(*) AS OrderCount,
  SUM(InvoiceAmount) AS TotalSales,
  SUM(CASE WHEN OnlineCustomerID > 0 THEN InvoiceAmount ELSE 0 END) AS OnlineSales,
  SUM(CASE WHEN OnlineCustomerID = 0 THEN InvoiceAmount ELSE 0 END) AS WalkInSales
FROM Invoice
WHERE CAST(InvoiceDate AS DATE) = CAST(GETDATE() AS DATE);
```

Useful for showing the restaurant owner: "today MenuLink brought you X SAR of online orders."

---

## Idempotency Pattern

Critical for production. We must NOT double-insert orders if MenuLink retries on network failure.

```sql
-- Before calling InsertInvoice, check if we already inserted this order
DECLARE @existing UNIQUEIDENTIFIER;
SELECT TOP 1 @existing = InvoiceID
FROM Invoice
WHERE InvoiceNotes LIKE 'MENULINK_ORDER_<order_uuid>%';

IF @existing IS NOT NULL
BEGIN
  -- Already inserted, return the existing ID
  SELECT @existing AS InvoiceID, 'duplicate' AS Status;
  RETURN;
END

-- Otherwise proceed with InsertInvoice as normal
-- (and prefix InvoiceNotes with MENULINK_ORDER_<order_uuid> for future dedup)
```

Better approach: add a column `ExternalRef` to the `Invoice` table for storing MenuLink's order ID — much cleaner than parsing notes. But that requires a schema migration.

---

## Common Errors & Fixes

| SQL Error | Likely cause | Fix |
|-----------|--------------|-----|
| `Cannot insert NULL into column ItemID` | Unmapped menu item | Verify all items have `pos_item_id` set in MenuLink |
| `Foreign key conflict on Items table` | ItemID doesn't exist in RzRz | Re-sync menu from RzRz |
| `Cannot insert duplicate key in Invoice.InvoiceNo` | Race condition or duplicate retry | Implement idempotency (above) |
| `Invalid object name 'InsertInvoice'` | Wrong database selected | Confirm `Initial Catalog=samer910_rzrz` in connection string |
| `Conversion failed when converting from character to uniqueidentifier` | Bad XML — InvoiceID is malformed | Use exactly `00000000-0000-0000-0000-000000000000` for new orders |
| `Cannot open server requested by login` | IP allowlist blocks Supabase | Have customer add Supabase IPs to SQL firewall |

---

## Performance Notes

- Single `InsertInvoice` call takes **~200-500ms** on the central server (192.250.231.22)
- Most of that is network latency (the server is in the US, calls come from Saudi)
- For high-volume customers (>500 orders/day), consider:
  - Connection pooling on the Edge Function side
  - Batching multiple orders if they arrive simultaneously (unlikely but possible)
- Don't bother optimizing until a customer actually complains
