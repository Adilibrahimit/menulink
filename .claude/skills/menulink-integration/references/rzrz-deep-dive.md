# RzRz / Punnelifosys ResApp · Technical Reference

> Read this file when working on anything RzRz-specific.

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
| ORM | Entity Framework (classic, not Core) |
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
│  User: samer910_jopaul                         │
│  Pass: jopaul477                               │
└────────────────────────────────────────────────┘
              ▲
              │ Entity Framework
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

**Key insight:** Each branch has its OWN local SQL Server (LocalDB .mdf file). Sync to central happens via flags. This means:

- **If customer DB is on central server (192.250.231.22):** Direct integration works
- **If customer DB is local only:** Need Bridge App (cannot reach local DB from cloud)

Always confirm which topology the customer uses before proposing an integration approach.

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

| Value | Meaning |
|-------|---------|
| 1 | Regular sale (most common — use this for delivery/pickup) |
| 5, 6, 7, 8 | Table-related (dine-in variants) |
| 9 | Party/event booking |

For MenuLink:
- `delivery` → InvoiceType = 1
- `pickup` → InvoiceType = 1
- `dinein` → InvoiceType = 5 (and set TableID)

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
4. **Single shared SQL user** (`samer910_jopaul`) for all clients = no audit trail

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
