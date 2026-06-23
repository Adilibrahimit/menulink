# RzRz POS Database Tables & Workflows

> Reference for POS database structure and business workflows.
> Source: verified against RZRZCLIENT on (localdb)\ProjectModels + production Almalaz 2026-05-20.
> No credentials stored in this file.

## Database Structure

Two databases per installation:
- **POS DB** (`client` on production, `RZRZCLIENT` on local copy) — sales, inventory, customers, items
- **Accounting DB** (`samer910_accreef`) — chart of accounts, journal vouchers

## Key Tables (91 total in POS DB)

### Core Transaction Tables
| Table | Purpose |
|-------|---------|
| `Invoice` | Order header — InvoiceID (GUID), InvoiceNo, InvoiceAmount, InvoiceType, TableID, CustomerID, OnlineCustomerID, InvoiceNotes_A, IsHold, CreatedBy, CounterID |
| `InvoiceDetails` | Line items — InvoiceID FK, ItemID, Qty, Rate, Amount, DiscountAmount, Notes_A, DisplayOrder |
| `InvoiceGenerate` | Invoice number generation |
| `CancelInvoice` | Cancelled invoice headers |
| `CancelInvoiceDetails` | Cancelled invoice line items |
| `InvoicePaymentTypeDetails` | Payment method breakdown (cash, card, etc.) |

### Menu & Item Management
| Table | Purpose |
|-------|---------|
| `Items` | Item catalog — ItemID, ItemName_E, ItemName_A, Rate, ItemParent, ItemMainCategoryID, Printer, DisplayOrder |
| `ItemCategory` | Item sub-categories |
| `ItemMainCategory` | Top-level categories |
| `ItemPrinters` | Kitchen print routing — ItemID → Printer name + InvoiceTypeID (data-driven routing) |
| `ItemSaleType` | Sale type classification |
| `ItemPackType` | Packaging types |

### Kitchen & Preparation
| Table | Purpose |
|-------|---------|
| `KitichenOrderForPrint` | Kitchen print queue (note: "Kitichen" is a typo frozen in the schema) |
| `CookItems` / `CookItemRecipe` / `CookItemPrepare` | Recipe management |
| `CookEntry` / `CookType` | Cooking operations |
| `CookedWasteEntry` / `WasteEntry` | Waste tracking |

### People
| Table | Purpose |
|-------|---------|
| `CustomerDetails` / `CustomerTransaction` | Customer management |
| `OnlineCustomer` / `OnlineCustomerItems` | Online aggregator customers (HungerStation, Jahez, MenuLink) |
| `DriverDetails` / `DriverCommission` | Driver roster and commission tracking |
| `EmployeeDetails` / `EmployeeDiscountDetails` | Staff management |
| `SupplierDetails` / `SupplierTransaction` | Supplier management |

### Floor & Tables
| Table | Purpose |
|-------|---------|
| `TableDetails` | Table/section definitions |
| `DeliveryDetails` | Delivery tracking |

### Financial
| Table | Purpose |
|-------|---------|
| `CreditPayment` | Credit customer payments |
| `CashOpening` | Opening cash per shift |
| `CloseShift` / `CloseShiftCardPayment` | End-of-shift reconciliation |
| `ExpenseDetails` / `OperatingExpense` | Expense tracking |

### Configuration
| Table | Purpose |
|-------|---------|
| `GeneralSettings` | Master config (~70 columns!) — company name, tax, VAT reg, license, business rules |
| `CounterDetails` | Physical POS counter definitions |
| `BranchDetails` | Branch definitions |
| `UserDetails` / `UserRoles` / `Roles` / `Menu` / `MenuRoles` | Auth and permissions |
| `Colors` | UI color schemes |

### ZATCA (Saudi e-invoicing)
| Table | Purpose |
|-------|---------|
| `ZatcaIntegrationSettings` | Per-counter ZATCA config |
| `ZatcaInvoice` / `ZatcaInvoiceDetails` | ZATCA submission tracking |
| `ZatcaInvoiceType` / `ZatcaPaymentMean` | ZATCA code tables |
| `ZatcaDebitCreditNoteReason` / `ZatcaDiscountReason` | ZATCA reason codes |
| `ZatcaReportingDetails` | ZATCA reporting queue |

## InsertInvoice Stored Procedure

Entry point for all invoice creation (including MenuLink Bridge App).

**Parameters:**
- `@XmlInvoice` nvarchar(MAX) — single self-closing `<Invoice ... />` element
- `@XmlItems` nvarchar(MAX) — multiple `<Items ... />` siblings (NO outer wrapper)
- `@IsHold` bit — `1` = held/pending, `0` = finalized
- `@SectionID` int — section identifier
- `@InvoiceType` int — `11` = Online (MenuLink), `1` = Dine In, `9` = Event
- `@AppendInvoiceIDS` nvarchar(1000) — CSV of child invoice IDs (usually empty)

**Critical XML format rules:**
- Invoice header is a SINGLE self-closing element with all attributes inline
- Items are MULTIPLE sibling `<Items />` elements at root level — NO wrapper element
- `InvoiceID = "00000000-..."` for new orders (proc generates the real GUID)
- `OnlineCustomerID = 999` for MenuLink
- `TaxPercent = 0` in Items XML — proc overrides from GeneralSettings

## Delivery Invoice Workflow (current state)

```
MenuLink customer places delivery order
  ↓
submit_order RPC saves to Supabase orders table
  ↓
enqueue_pos_outbox trigger writes to pos_outbox (if pos_bridge addon enabled)
  ↓
Bridge App claims the outbox row (status: claimed)
  ↓
Bridge App builds InsertInvoice XML from payload + pos_item_map
  ↓
Bridge App calls EXEC InsertInvoice with IsHold=1 (held/pending)
  ↓
Invoice appears in cashier UI as held online order
  ↓
Cashier reviews, finalizes (IsHold=0), pays → triggers kitchen print
  ↓
Bridge App updates pos_outbox status to synced, stores pos_invoice_id
```

**Confirmed working:** Steps 1-6 proven on 2026-05-20.
**Remaining:** Driver assignment sync, cash settlement sync, cancellation sync, failure reason sync.

## Table Dining Invoice Workflow (planned, not yet implemented)

```
Customer scans table QR at /m/rzrz-bukhari?table=X
  ↓
MenuLink opens table session (open_table_session RPC)
  ↓
Customer submits dine-in order → persisted with session_id
  ↓
Bridge App detects new outbox row for dine_in order
  ↓
Bridge App looks up POS table ID from pos_table_map
  ↓
Bridge App opens POS table or finds existing open table (TBD)
  ↓
Bridge App adds items to POS table via InsertInvoice with TableID
  ↓
Kitchen printers fire for new items
  ↓
Customer can add more rounds (same session)
  ↓
Cashier closes table/payment from POS side
```

**Status:** Not yet implemented. Key unknowns:
- How does RzRz open a table programmatically? (stored procedure or direct INSERT?)
- Can items be added to an already-open table?
- Does closing a table in POS need to sync back to MenuLink?

## Known Schema Quirks

1. **Misspelled names frozen in schema:** `KitichenOrderForPrint` (not Kitchen), `StockTransction` (not Transaction), `DeliveryDeleveried` (not Delivered)
2. **GeneralSettings has ~70 columns** in a single row — hidden feature flags, business rules, company info all mixed
3. **`IGUID` column** used for both cancellation links AND ZATCA credit-note references (overloaded)
4. **`AppendInvoiceIDS`** is a CSV string of child invoice IDs (not normalized)
5. **XML blob payloads** — `@XmlInvoice`, `@XmlItems`, `@XmlPurchase` (atomicity hack, works but opaque)
6. **Kitchen printer name is `KETCHIN`** (typo for KITCHEN) — Windows printer must use the typo
7. **Tax-inclusive pricing** — `Items.Rate` includes 15% VAT, `Items.Tax` is always 0
8. **Plaintext passwords** in `.exe.config` files — security debt for production

## Assumptions vs Confirmed Facts

### Confirmed
- InsertInvoice XML format (verified via Extended Events on production 2026-05-20)
- Items table column names (ItemName_E/A, not Item/Item_A)
- OnlineCustomerID 999 works for MenuLink
- Kitchen print routing is via ItemPrinters table, not Items.Printer column
- Tax-inclusive pricing model
- Bridge App hold mode (IsHold=1) works
- Local test DB has 414 items, 7 drivers, 6 online customers

### Assumptions (need verification)
- Table dining: assumed InsertInvoice with TableID > 0 opens/appends to a POS table
- Driver assignment: assumed there's a way to link a POS invoice to a driver (DriverDetails → Invoice relationship TBD)
- Cancellation sync: assumed CancelInvoice table is the destination for cancellation data
- Items active/inactive: assumed tracked somewhere (no visible IsActive column in first inspection)

### Unknowns
- Full InsertInvoice proc source code (not yet extracted from SQL Server)
- How POS handles adding items to an already-open table
- Whether table close/payment triggers any event that Bridge can subscribe to
- Whether driver commission calculation in POS needs MenuLink input
