# RzRz / Punnelifosys ResApp · Technical Reference

> Read this file when working on anything RzRz-specific.
>
> 🔗 **Deeper, source-grounded reference now exists.** The full app was decompiled and mapped into the **`punnelifosys-pos`** skill (architecture, the DAL→284-sproc contract, ZATCA, printing, sync, schema) — load it for depth. To **build features INTO the POS** (co-owned with Samer), use **`punnelifosys-feature-dev`**. This file stays the *integration-focused* quick reference; where it disagrees with `punnelifosys-pos` or `learnings.md`, those win (a few legacy guesses below have been corrected — see ⚠️ markers).

## Identity

| Field | Value |
|-------|-------|
| Product name (brand) | Punnelifosys ResApp |
| Internal code name | RzRz |
| Type | Restaurant POS system |
| UI | Windows Forms (.NET Framework) |
| Languages | Arabic (ar, ar-SA), Armenian (hy-AM) |
| Built by | Punnelifosys |
| Used by | Brother's restaurant + other clients |

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | .NET Framework **4.7.2** (NOT .NET Core) |
| Data access | ⚠️ **Stored procedures + ADO.NET**, NOT an ORM. `CommonDAL` wraps `SqlHelper.FillDatatable(... "[dbo].[Sproc]")` and returns `DataTable`. (`EntityFramework.dll` ships in the bin folder but the real data path is sprocs — see `punnelifosys-pos/references/data-access-patterns.md`.) |
| Database | SQL Server |
| Reports | Microsoft Report Viewer (RDLC) |
| Barcodes/QR | ZXing.dll |
| ZATCA support | Built-in (2025/10/Zatca Service module) |

## Deployment Topology

```
┌────────────────────────────────────────────────┐
│  Central SQL Server (hosted)                   │
│  192.250.231.22                                │
│   ├── samer910_rzrz     ← main operations DB   │
│   └── samer910_accreef  ← accounting DB        │
│                                                │
│  Credentials in .exe.config (PLAIN TEXT ⚠️)    │
│  User: <REMOTE_SQL_USER>                         │
│  Pass: <REMOTE_SQL_PASSWORD>                               │
└────────────────────────────────────────────────┘
              ▲
              │ ADO.NET + stored procedures (not EF)
              │
┌─────────────┴──────────────────────────────────┐
│  SERVER application                            │
│  D:\Samer\RZRZ-CODE\SERVER\Debug\              │
│  PunnelifosysResAppServer.exe                  │
│  (runs on central machine — owner's PC?)       │
└────────────────────────────────────────────────┘
              ▲
              │ syncs via IsSyncRequired flag
              │
┌─────────────┴──────────────────────────────────┐
│  Branch (per-restaurant cashier)               │
│  D:\Samer\RZRZ-CODE\Branch-RES\                │
│  Local DB: RZRZCLIENT.mdf (LocalDB)            │
└────────────────────────────────────────────────┘
```

**Key insight:** Each branch can have its OWN local SQL Server; sync to central happens via the dynamic sproc list (see `punnelifosys-pos/references/sync-and-topology.md`). This means:

- **If customer DB is on central server (192.250.231.22):** Direct integration works
- **If customer DB is local only:** Need Bridge App (cannot reach local DB from cloud)

Always confirm which topology the customer uses before proposing an integration approach.

> ⚠️ **The "RZRZCLIENT.mdf (LocalDB)" detail above is from an early guess.** The *verified* Almalaz branch topology (learnings LRN-2026-05-20-almalaz-server-discovery) is **SQL Server 2022 Express, instance `PUNNELIFOSYS\SQLEXPRESS`, Integrated Security**, with local DBs `samer910_Cefalu` (ops), `samer910_accreef`, and `client`. Both production DBs end up named `client` on different machines — **always run `SELECT DB_NAME(), @@SERVERNAME;` and identify production by recent `dbo.Invoice` activity, never by DB name** (see the `menulink-data` skill).

## Critical Tables (samer910_rzrz schema)

| Table | Purpose | Notes |
|-------|---------|-------|
| `Invoice` | Order header (one row per order) | PK: InvoiceID (uniqueidentifier) |
| `InvoiceDetails` | Order line items | Many rows per InvoiceID |
| `KitichenOrderForPrint` | **Triggers kitchen printer** ⭐ | Insert here = receipt prints |
| `Items` | Menu items | PK: ItemID (bigint) |
| `OnlineCustomer` | Online ordering customers | Already exists — use for MenuLink customers |
| `GeneralSettings` | Per-branch settings | Tax rate, branch ID, etc. |
| `TableDetails` | Dine-in tables | StatusID 2 = occupied |
| `Roles` | User permissions | For authorization features |

## The Holy Grail: `InsertInvoice` Stored Procedure

Location: `D:\Samer\RZRZ-CODE\Branch-RES\SCREPIT\2025\3\21032025 Branch For SideDish\6.InsertInvoice.sql`

**Why it matters:** Calling this proc handles the ENTIRE order workflow:
1. Generates invoice number
2. Inserts to `Invoice` table
3. Inserts line items to `InvoiceDetails`
4. **Adds entries to `KitichenOrderForPrint` → kitchen ticket prints automatically**
5. Calculates VAT (ZATCA-compliant)
6. Calculates Tobacco VAT if applicable
7. Sets sync flags

```sql
EXEC InsertInvoice
  @XmlInvoice = N'<Invoice ... />',
  @XmlItems   = N'<Items><Items ... /></Items>',
  @IsHold     = 0,    -- 0 = finalize, 1 = hold/draft
  @SectionID  = 0,    -- 0=all, 1=tables, 2=family tables
  @InvoiceType= 1,    -- see InvoiceType values below
  @AppendInvoiceIDS = ''
```

See `sql-patterns.md` for full XML payload examples.

### InvoiceType Values

⚠️ **Corrected.** The earlier table here (`1 = Regular sale`, `delivery → 1`, `dinein → 5`) was a guess and is **WRONG**. The authoritative enum comes from the stored procedure **`GetInvoiceType`** (identical in both production DBs) and was confirmed in production by placing one test invoice per type:

| Value | Meaning (UI label) |
|-------|--------------------|
| `0` | TakeAway (سفري) — dominant historical type |
| `1` | DineIn (محلي) |
| `2` | DineInFamily |
| `3` | Delivery (توصيل) — triggers driver-assignment workflow |
| `4` | Telephone (هاتف) — phone pickup-later |
| `5` | Table |
| `6` | FamilyTable |
| `7` | TakeAway-Table |
| `8` | TakeAway-Family |
| `9` | Party / event |
| `10` | Car (سيارة) — curbside pickup-later |
| **`11`** | **Online (موقع الكتروني)** — the value HungerStation/Jahez/Keeta/**MenuLink** orders carry |

**For MenuLink** (this is nuanced — read `learnings.md` before choosing):
- `Invoice.InvoiceType = 11` is the *correct* Online-channel value (verified on held aggregator invoices).
- BUT setting `Invoice.OnlineCustomerID > 0` triggers a cashier-UI payment-type lock (hardcoded in the .NET source), and types `3`/`11` trip workflow side-effects. The **current production default** for MenuLink invoices is therefore to make them look like a plain walk-in (`OnlineCustomerID = 0`, a non-triggering type) — see `learnings.md` LRN-2026-05-23-online-customer-id-triggers-workflow and LRN-2026-05-23-pos-invoice-type-mapping. Fixing the lock in the .NET source (so true `InvoiceType=11` works) is a `punnelifosys-feature-dev` task.
- Full enum + the `GetInvoiceType` proc: see `punnelifosys-pos/references/domain-and-schema.md`.

## What's in the Debug Folder

```
D:\Samer\RZRZ-CODE\SERVER\Debug\
├── PunnelifosysResAppServer.exe       ← main app
├── *.exe.config                       ← DB credentials live here ⚠️
├── Punnelifosys.*.dll/.pdb            ← business logic libraries
├── EntityFramework.*.dll              ← ORM
├── Microsoft.ReportViewer.*.dll       ← RDLC reports
├── zxing.dll                          ← barcodes
├── ar/, ar-SA/, hy-AM/                ← language resources
├── RDLC/                              ← report templates
├── DotDocuments/                      ← ?
├── Icon Images/                       ← UI icons
└── PdfFiles/                          ← generated PDFs
```

## Security Concerns (Document & Plan To Fix Later)

1. **DB credentials in plain text** in `PunnelifosysResAppServer.exe.config`
2. **No encryption at rest** for the .mdf file
3. **No IP allowlist** on the central SQL Server (assumed — verify with port scan)
4. **Single shared SQL user** (`<REMOTE_SQL_USER>`) for all clients = no audit trail

**Mitigation roadmap (for production rollout):**
- [ ] Move credentials to Windows DPAPI or AWS/Azure Key Vault
- [ ] Enable SQL Server encryption (TDE) — needs Enterprise edition though
- [ ] Add per-client SQL users with row-level security
- [ ] Add IP allowlist on the hosting provider firewall

None of these are blockers for the MVP integration. Flag them but don't fix until customer #5.

## Integration Strategies (Pick Based On Customer)

### Tier A: Direct DB (BEST when central SQL is reachable)
```
MenuLink Cloud → SQL Server 192.250.231.22 → EXEC InsertInvoice
```
- Pros: Fastest (~200ms), no extra software on customer side
- Cons: Requires network reachability from Supabase to SQL Server
- Use when: Customer uses the same central DB hosting

### Tier B: Bridge App (REQUIRED when DB is local-only)
```
MenuLink Cloud → SignalR → Bridge App on cashier PC → Local SQL → InsertInvoice
```
- Pros: Works behind any firewall, no port forwarding needed
- Cons: Customer must install a small .exe
- Use when: Customer's DB is local (RZRZCLIENT.mdf on cashier's PC)
- See `references/adapter-pattern.md` (when written) for implementation

### Tier C: Polling (FALLBACK if SignalR isn't viable)
```
Bridge App polls MenuLink API every 30s → fetches new orders → inserts to local SQL
```
- Pros: Simplest possible
- Cons: 15-30s latency, wastes bandwidth
- Use when: Customer has flaky internet, prefers simple software

## Common Pitfalls When Integrating

1. **Forgetting `OnlineCustomerID`** — set it to identify the order came from MenuLink (use a specific ID like 999 or create one in `OnlineCustomer` table)
2. **Wrong CounterID** — the procedure expects a physical counter. For online orders, create a virtual "MenuLink" counter in RzRz settings.
3. **Item ID mismatch** — MenuLink's product IDs ≠ RzRz's `ItemID` (bigint). Maintain a mapping table.
4. **Missing GeneralSettings** — the procedure reads `Tax` and `invoiceDate` from `GeneralSettings`. Make sure they're populated.
5. **Sync flag forgotten** — if updating an existing invoice, set `IsSyncRequired=1` so branches pick it up.

## Reference Files In The Project

These are inside the actual customer project at `D:\Samer\RZRZ-CODE\`:

- `Branch-RES\SCREPIT\2025\3\21032025 Branch For SideDish\6.InsertInvoice.sql` — the master proc
- `Branch-RES\SCREPIT\2025\3\21032025 Branch For SideDish\2.Tables.sql` — table definitions
- `Branch-RES\SCREPIT\2025\3\21032025 Branch For SideDish\10.GetInvoiceDetails.sql` — read pattern
- `Branch-RES\SCREPIT\2025\10\Zatca Service\` — ZATCA compliance module
- `samer910_accreef.bak` — accounting DB backup (for reference)

When you need a deeper look at the schema, ask the user to share specific stored procedures from these folders — don't read everything at once.

### 🔗 Now decompiled + graphed (use these for depth)

The full app source is decompiled and mapped — you no longer have to ask for individual files for *understanding* (you still build against Samer's real VS solution):

- **`D:\Samer\research-output\decompiled\`** — full Branch + Server C# source (481 files). Grep it directly.
- **`D:\Samer\research-output\graphify-out\`** — knowledge graph (`graph.json` queryable via `graphify query "…"`, `graph-semantic.html`, `GRAPH_REPORT.md`).
- **`D:\Samer\research-output\0*.md`** — 5 research write-ups (architecture / domain / features / stack / new-POS design).
- **`punnelifosys-pos`** skill — the curated, source-grounded reference (load it). **`punnelifosys-feature-dev`** — building features into the POS. **`menulink-data`** — the two DBs + extracted procs.
