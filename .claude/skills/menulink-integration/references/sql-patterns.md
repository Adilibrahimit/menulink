# SQL Patterns · InsertInvoice & Friends

> Read when building integration code that talks to RzRz or any SQL-based POS.
> **Verified against production RzRz Bukhari (Almalaz branch, 2026-05-20) by capturing live cashier calls via Extended Events. The XML structure below is the GROUND TRUTH — don't trust prior versions of this doc.**

## The Two XML Inputs To `InsertInvoice`

### XmlInvoice (the order header)

**Single self-closing element. All attributes inline. Include `InvoicePartyID` and `DishItemInvoiceID` (both empty GUIDs) — they're easy to miss but the proc reads them.**

```xml
<Invoice
  InvoiceID="00000000-0000-0000-0000-000000000000"
  InvoiceAmount="73.00"
  InvoiceType="11"
  TableID="0"
  InvoiceNotes=""
  InvoiceNotes_A="MenuLink #abc123 · أحمد · 0598292413"
  DiscountAmount="0.00"
  CreatedBy="1"
  CounterID="1"
  CustomerID="0"
  OnlineCustomerID="999"
  InvoicePartyID="00000000-0000-0000-0000-000000000000"
  TobaccoVatAmount="0"
  InvoiceDiscountPercentage="0"
  DishItemInvoiceID="00000000-0000-0000-0000-000000000000"
/>
```

**Field meanings:**

| Attribute | Type | What it is |
|-----------|------|------------|
| `InvoiceID` | GUID | Empty GUID = new order (proc generates one). Existing GUID = update branch (used to finalize a held invoice). |
| `InvoiceAmount` | float | Total **including tax** — RzRz uses tax-inclusive pricing. |
| `InvoiceType` | int | **`11` = Online section** (موقع الكتروني — what MenuLink uses). Other values: 1=Dine In, 9=Event, 2/6/8=Family modes. **NOT `1` for "regular sale" — that's a docs lie from earlier; 1 maps to "Dine In" in the held-invoice search UI.** |
| `TableID` | bigint | 0 for delivery/pickup/online; table # for dine-in. |
| `InvoiceNotes` | nvarchar(2000) | English notes — usually empty. |
| `InvoiceNotes_A` | nvarchar(2000) | **Arabic notes shown in cashier UI cart**. Use this for MenuLink order ID + customer name + phone, separated by ` · `. |
| `DiscountAmount` | float | Total discount applied (SAR). |
| `CreatedBy` | bigint | User ID. `1` = Admin (verified on RzRz Bukhari). |
| `CounterID` | bigint | Physical counter from `CounterDetails`. `1` = SERVER-RES2. Add a dedicated "MENULINK" counter later if desired. |
| `CustomerID` | bigint | 0 for walk-in / online (we use OnlineCustomerID instead). |
| `OnlineCustomerID` | bigint | ⭐ **999 = MenuLink** (after migration 0008-equivalent on the POS DB adds the row). |
| `InvoicePartyID` | GUID | Empty GUID. Only non-empty for party/event invoices (InvoiceType=9). |
| `TobaccoVatAmount` | float | 0 unless menu has tobacco. |
| `InvoiceDiscountPercentage` | decimal | 0 unless % discount applied. |
| `DishItemInvoiceID` | GUID | Empty GUID. Linked to `InvoiceSideDishItemDetails` for combo meals; empty for normal orders. |

### XmlItems (the line items)

**⚠️ CRITICAL: NO outer wrapper. Multiple `<Items />` elements as siblings at root.** SQL Server `CAST(string AS xml)` defaults to CONTENT mode, which allows multiple top-level elements. `@xml1.nodes('Items')` then matches each one.

```xml
<Items ItemID="1886" Qty="1.00" Rate="40.00" Amount="40.00" DiscountAmount="0" Notes="" Notes_A="" DisplayOrder="1" TaxPercent="0" /><Items ItemID="1892" Qty="1.00" Rate="21.00" Amount="21.00" DiscountAmount="0" Notes="" Notes_A="" DisplayOrder="2" TaxPercent="0" />
```

**DO NOT do this** (it's what the old version of this doc said):

```xml
<!-- BROKEN — causes "Cannot insert NULL into column ItemID" -->
<Items>
  <Items ItemID="1886" ... />
  <Items ItemID="1892" ... />
</Items>
```

**Items field meanings:**

| Attribute | Type | What it is |
|-----------|------|------------|
| `ItemID` | bigint | Real row in RzRz `Items.ItemID` — from your menu mapping table. |
| `Qty` | float | Quantity — cashier sends "1.00" / "2.00" (with decimal). |
| `Rate` | float | Unit price tax-inclusive (RzRz prices include 15% VAT). |
| `Amount` | float | Qty × Rate. Pass it explicitly. |
| `DiscountAmount` | float | Per-item discount, usually 0. |
| `Notes` | nvarchar(2000) | English notes. Usually empty. |
| `Notes_A` | nvarchar(2000) | Arabic notes for the kitchen — "بدون بصل", "حار", etc. |
| `DisplayOrder` | int | 1, 2, 3, ... (the row order in the cart). |
| `TaxPercent` | float | **Send `0`** — the proc later updates each row's TaxPercent from `GeneralSettings.Tax`. (Sending 15 here is harmless because the proc overrides it.) |

### Verified RzRz `Items` table columns (Almalaz branch, 2026-05-20)

| Column | Type | Notes |
|---|---|---|
| ItemID | bigint | PK |
| ItemName_E | nvarchar(100) | English name (the docs incorrectly said `Item`) |
| ItemName_A | nvarchar(100) | Arabic name (docs incorrectly said `Item_A`) |
| ItemCode | nvarchar(200) | |
| Rate | float | Tax-INCLUSIVE unit price |
| Discount | float | |
| DiscountPercent | float | |
| ImageName | nvarchar(500) | |
| ItemBackColor / ItemForeColor | nvarchar(50) | Cashier UI colors |
| DisplayOrder | bigint | |
| ItemParent | bigint | For variants (e.g., quarter/half/full of same dish) |
| Image | image | Stored binary |
| Printer | nvarchar(200) | **Empty for all items** — print routing is via `ItemPrinters` table, not this column |
| ItemSaleTypeID | int | |
| ItemMainCategoryID | bigint | FK to category table |
| Tax | float | **Always 0** — tax-inclusive pricing means no per-item tax stored here. Real rate is in `GeneralSettings.Tax`. |
| SyncBackRequired | int | |
| ISTobacco | bit | |
| SideDishCount | float | |
| ...+ more (full schema in customers/rzrz-restaurant.md) | | |

### Verified `ItemPrinters` table

`(ItemID, Printer text, SectionID int, Control text, InvoiceTypeID int)` — each item has multiple rows, one per `InvoiceTypeID`, mapping to a Windows printer name. The cashier UI's print dispatcher reads this on every order finalize and routes to the matching local Windows printer.

For Almalaz: items typically have entries for printer names `KITCHEN` (orphan, old name), `KETCHIN` (current working name), `BBQ`, `DESERT`, `KABULE`. The Bridge App **does not need to touch this** — calling `InsertInvoice` with `InvoiceType=11` triggers the existing routing automatically.

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
