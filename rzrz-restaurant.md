# Customer · [RzRz Restaurant — Name TBD]

> **Slug:** `rzrz-restaurant` *(temporary — rename when actual name confirmed)*  
> **Status:** **strategic partner** (not yet a paying customer)  
> **Onboarded:** TBD  
> **Plan:** TBD (likely free/discounted in exchange for being integration testbed)  
> **Strategic role:** 🔧 **POS INTEGRATION R&D LAB** — where we build & validate Bridge App

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

- **Restaurant name (AR):** [TBD]
- **Restaurant name (EN):** [TBD]
- **Owner name:** [TBD — different from operations manager]
- **Operations manager:** **User's brother** ⭐
- **Brother's phone:** [TBD — primary contact]
- **City / District:** [TBD]
- **Branch count:** [TBD]
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

- **POS system:** ✅ **RzRz (Punnelifosys ResApp)** — full version
- **Integration tier:** **Tier 1b (Bridge App)** — local DB likely
- **Status:** in design (POC not yet built)
- **DB topology:** [TBD — confirm with brother]
  - If central (`192.250.231.22`): direct integration possible
  - If local-only (`.mdf` on cashier PC): Bridge App required
- **Likely answer:** Local-only (this is why we need a Bridge App pattern)
- **PunnelifosysResAppServer.exe location:** [TBD — confirm with brother]
- **DB credentials:** in `.exe.config` on the central machine (already discovered via D:\Samer\RZRZ-CODE)

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
