# Customer · RzRz Restaurant (Itaqn w Jowdah)

> **Slug:** `rzrz`
> **Brand:** **RzRz** (the restaurant brand customers know)
> **Operating company:** **Itaqn w Jowdah** (إتقان وجودة — "Mastery & Quality")
> **POS used:** RzRz POS, a.k.a. Punnelifosys ResApp — built by **Samer Cefalu**
> **Status:** **co-developed deep partnership** (the user is Samer's BUSINESS PARTNER in the POS software venture)
> **Strategic role:** 🔧 **POS INTEGRATION R&D LAB** + 🤝 **co-branded product channel for ALL Punnelifosys customers**

## ⚠️ Critical relationship context (added 2026-05-20)

The user is **a partner in the POS software business** with Samer Cefalu. Samer is the programmer; the user is his partner. They co-own/co-sell the RzRz POS to other restaurants. This means:

1. **We're not "asking Punnelifosys to integrate" — we ARE Punnelifosys.** The user has equity in both sides of the deal.
2. **Schema changes are on the table.** We can add an `ExternalRef` column to `Invoice`, add a `MenuLink_InsertInvoice` wrapper proc, modify the dispatcher. Not begging — co-deciding.
3. **The integration can be a co-branded feature of BOTH MenuLink AND RzRz POS** — sold to existing RzRz customers as an add-on, sold to new MenuLink customers as a POS pairing.
4. **The "12-month partnership goal" in the original endgame section is achieved on day one.** Adjust the roadmap accordingly.

---

## 🎯 Why This Customer Matters

This is **not** about revenue. This restaurant is our **engineering laboratory** for everything POS-related. Why:

1. **User's brother is operations manager here** → privileged access for testing
2. **Restaurant uses RzRz POS** → we can study, modify, and validate against a real production system
3. **Bridge App development** → we'll build the .NET bridge here, test it for weeks before deploying to paying customers
4. **Risk-tolerant environment** → brother can absorb hiccups during dev that paying customers can't

**Don't bill them for the headache.** Treat them as a development partner. The integration knowledge we extract here becomes our competitive moat for the next 50 customers.

---

## 📋 Business Profile

- **Restaurant name (AR):** **رزرز بخاري** (verified 2026-05-20 from GeneralSettings)
- **Restaurant name (EN):** **RZRZ BUKHARI**
- **VAT Registration:** `311750526500003` (15-digit ZATCA number, stored in GeneralSettings.TaxReg)
- **VAT rate:** 15% (Saudi standard); `TaxForAllItem = 1` so applied to every item via tax-inclusive pricing
- **ZATCA phase:** 1 (simplified B2C invoices — POS handles compliance automatically)
- **License expires:** 2027-02-20
- **Owner name:** [TBD — different from operations manager]
- **Operations manager:** **User's brother** ⭐
- **Brother's phone:** [TBD — primary contact]
- **City / District:** Riyadh (inferred — both branches are Riyadh districts)
- **Branch count:** **2** — Alazizah + Almalaz (confirmed 2026-05-20)
- **Avg orders/day:** [TBD]
- **Cuisine:** [TBD]

## 👥 Relationship Map

- **Owner:** Decision-maker on pricing, branding, business terms
- **Brother (Operations Manager):** Decision-maker on operational changes, can authorize tests on the POS, our primary contact
- **Cashier/staff:** End-users of the integration — their feedback is what matters most for UX

**Communication channel hierarchy:**
1. Tech/integration issues → Brother (he understands the POS, has admin access)
2. Business questions (pricing, contract) → Owner via Brother
3. Production incidents → Brother (he can physically check the cashier PC)

## 🔌 POS Integration — THE MAIN EVENT

- **POS system:** ✅ **RzRz (Punnelifosys ResApp)** — full version on .NET Framework 4.7.2
- **Integration tier:** **Tier 1b (Bridge App)** — confirmed local DB per server machine inspection 2026-05-20
- **Status:** Phase 1 discovery in progress
- **DB topology (Almalaz branch — confirmed 2026-05-20):**
  - Machine name: `DESKTOP-8Q7DQKA` (LAN hostname `PUNNELIFOSYS`)
  - LAN IP: `192.168.1.113`
  - SQL Server: **2022 Express** (16.0.1180), instance default (no `\SQLEXPRESS` suffix — see correction below)
  - Auth options: Integrated Security works AND `sa` SQL auth is enabled (the user is logged in to SSMS as `sa`)
  - **Active main DB: `client`** ← correction posted 2026-05-20: the `.exe.config` files we received earlier pointed at `samer910_Cefalu`, but that DB does not exist on this server. The DB that actually holds `InsertInvoice` (and presumably `Invoice`, `InvoiceDetails`, `Items`, `KitichenOrderForPrint`) is named `client`. The config files were stale or from a different machine.
  - Accounting DB: `samer910_accreef` (local copy; possibly synced to central — TBD)
  - Sync to central `192.250.231.22` confirmed at application level (drives the online dashboard the user mentioned, viewing both branches' sales)
- **`InsertInvoice` proc signature (verified 2026-05-20 on `client` DB):**
  - `@XmlInvoice` nvarchar(MAX)
  - `@XmlItems` nvarchar(MAX)
  - `@IsHold` bit
  - `@SectionID` int
  - `@InvoiceType` int
  - `@AppendInvoiceIDS` nvarchar(1000)
  Matches `references/sql-patterns.md` documentation exactly.

- **Items table schema (verified 2026-05-20):**
  Column names in this DB differ from the docs. Use these:
  - `ItemID` (bigint, PK) — was `ItemID` ✓
  - `ItemName_E` / `ItemName_A` (nvarchar 100) — docs called them `Item` / `Item_A` ✗
  - `Rate` (float) — unit price ✓
  - `Tax` (float) — **always 0 in this DB; tax is included in `Rate` (tax-inclusive pricing)**. GeneralSettings holds the canonical Saudi VAT %.
  - `Printer` (nvarchar 200) — **empty for all items**. Kitchen routing is NOT done via this column. It lives in a separate dedicated routing table (TBD which one — investigate before Bridge App).
  - `ItemMainCategoryID` (bigint) — FK to category table
  - `ItemParent` (bigint) — parent item ID for variants (e.g., 1885 "الشواية" is parent of all grill variants)
  - `ISTobacco` (bit) — tobacco VAT flag
  - **No `IsActive` column visible in first 20 columns** (full schema list pending verification). Active/inactive likely tracked elsewhere — TBD.

- **Pricing model: TAX-INCLUSIVE.** The user confirmed RzRz uses tax-inclusive pricing — the price displayed on the menu is what the customer pays. So when we build `XmlItems`, `Rate` should be the menu price (not pre-tax price), and `TaxPercent` in the XML should be whatever GeneralSettings says (likely 15) so the proc can decompose it correctly for the ZATCA invoice. **Validate this empirically: a 40 SAR item should yield Net=40 in the resulting Invoice row, not 46.**

- **Sample real items (use these for the test invoice):**
  - 1886 "حبة شواية بخاري" (Full Bukhari grill) — 40 SAR
  - 1892 "نص شواية بخاري" (Half Bukhari grill) — 21 SAR
  - 1898 "ربع شواية أحمر" (Quarter Red grill) — 12 SAR
  - Restaurant style: Arabian / Saudi grilled meat (شواية)
- **Alazizah branch:** presumed similar setup with its own LAN + own local DB. Not yet inspected.
- **PunnelifosysResAppServer.exe location:** on this machine, alongside the `.exe.config` (user provided the config file)
- **DB credentials:** Integrated Security on this machine — no plain-text DB password needed for local writes. Remote `accreef` connection still uses `samer910_jopaul / jopaul477` (plain text in config) — security debt for production.
- **Kitchen printers (Almalaz LAN, TCP/IP):**
  - `192.168.1.175` BBQ — only BBQ section items
  - `192.168.1.177` **KETCHIN** (typo for "kitchen" — must match this name everywhere) — prints ALL items (master)
  - `192.168.1.179` DESERT — only Dessert section items
  - `192.168.1.181` KABULE — only Family section items
  - Plus a USB printer on each cashier set as Default → prints CUSTOMER receipt
  - Each item is mapped to one or more printers via `ItemPrinters` table; the cashier UI's print dispatcher reads that mapping and routes to each item's printer(s). The Bridge App **does not need to implement print routing** — writing `InvoiceDetails` + `KitichenOrderForPrint` rows triggers the existing dispatcher.
  - **Critical:** the Windows printer name on EVERY machine that runs the cashier UI or Bridge App must be exactly "KETCHIN" (with the typo). If it's "KITCHEN", prints silently fail.

### Open RzRz Integration Questions (need brother's input)

1. Is the DB on the central hosted server (192.250.231.22) or local LocalDB?
2. What's the physical setup? Single cashier PC, or multiple cashiers connected to a server in the back office?
3. Is there a kitchen printer connected to RzRz already? Brand? IP-based or USB?
4. Who manages RzRz updates/maintenance? (User, brother, or external developer)
5. Can we get a dedicated **MenuLink user account** in RzRz with limited permissions?
6. Can we create a virtual **MenuLink counter** so online orders are visually distinct?
7. **Where is the office space to deploy the Bridge App test instance?**

### What We've Already Discovered

From earlier exploration of `D:\Samer\RZRZ-CODE`:

- ✅ Tech stack: .NET Framework 4.7.2 + EF + SQL Server
- ✅ Schema understood (Invoice, InvoiceDetails, KitichenOrderForPrint, Items)
- ✅ `InsertInvoice` stored procedure is our entry point
- ✅ ZATCA compliance is built-in (no extra work needed on our side)
- ✅ Multi-branch architecture (central + local syncing via flags)
- ⚠️ DB credentials in plain text in `.exe.config` (security debt for production)

Full reference: `references/rzrz-deep-dive.md`

## 🎨 Brand

- **Primary color:** [TBD]
- **Logo source:** [TBD]
- **Theme:** [TBD]
- **Menu source of truth:** Should be RzRz `Items` table (read once during onboarding, sync nightly)

## 📊 Performance (After Launch)

> Special metrics for this customer (because we're testing integration):
> - End-to-end order latency (PWA send → kitchen print)
> - Bridge App uptime %
> - Failed sync count per day
> - Manual interventions per week (target: 0)

## ⚠️ Quirks & Notes

- **This is a real running restaurant** — production load, can't break for long
- **Test orders must be clearly tagged** — use `OnlineCustomerID=999` and prefix names with "TEST_" 
- **Brother can debug from inside** — if integration breaks, he can manually intervene at the cashier
- **Real revenue depends on RzRz uptime** — never deploy our integration in a way that could break their existing workflow
- **Production-grade error handling needed** — fallback to WhatsApp if integration fails (don't drop orders)

## 🚧 Open Tasks (in order)

### Discovery Phase
- [ ] Get actual restaurant name and confirm slug
- [ ] Meeting with brother to walk through current RzRz setup
- [ ] Determine DB topology (central vs local) → drives Tier 1a vs Tier 1b
- [ ] Confirm physical setup, network topology, printer setup
- [ ] Get a copy of the menu (or read it from RzRz `Items` directly)
- [ ] Agree on pricing/free arrangement for this testbed

### Build Phase (if local-only → Bridge App)
- [ ] Spec the Bridge App (.NET 8 service or tray app)
- [ ] Build minimal Bridge App: connect to MenuLink cloud + write to local SQL
- [ ] Test Bridge App on a dev machine before deploying to the cashier
- [ ] Install Bridge App on cashier PC at the restaurant
- [ ] Run for a week as silent observer (logs only, no real orders)
- [ ] Enable for real orders, monitor closely

### Launch Phase
- [ ] Deploy MenuLink PWA for this restaurant
- [ ] Place test order → verify entire chain works
- [ ] Train brother and cashier on the new flow
- [ ] Run for 30 days, document every issue in `learnings.md`
- [ ] After 30 days clean: extract Bridge App as a product for other RzRz customers

## 📜 Activity Log

### 2026-05-18 · RzRz Exploration
- Accessed user's PC, explored `D:\Samer\RZRZ-CODE`
- Confirmed tech stack and discovered `InsertInvoice` stored procedure
- Read SQL scripts to understand schema
- Decided: this restaurant (where brother manages) is the right place to build & test Bridge App
- KO-KO is a separate paying customer (NOT this one) — they don't use RzRz

### YYYY-MM-DD · First Meeting with Brother (planned)
Topics:
- Confirm DB topology
- Walk through current order workflow
- Discuss free/discounted testbed arrangement with owner
- Schedule Bridge App deployment

---

## 🎯 Strategic Endgame

This restaurant's success enables a **massive product expansion:**

```
Today:        RzRz Bridge App (custom for this restaurant)
↓
3 months:     Bridge App as a paid add-on for OTHER RzRz customers
              (RzRz is sold to many restaurants by Punnelifosys)
↓
6 months:     "MenuLink for RzRz" → 50 SAR/month add-on to base MenuLink subscription
              Punnelifosys customers buy it because integration "just works"
↓
12 months:    Partnership with Punnelifosys?
              Becomes the official online ordering channel for all RzRz deployments
```

This is the long game. Brother's restaurant is **step 1** of a much larger play. Treat the integration work here with the seriousness of building a real product, not a one-off customer install.
