# Onboarding Playbook · New Restaurant Customer

> Read this when the user says "عندي مطعم جديد" or asks to onboard a new client.

## ⏱️ Time Budget

- **Discovery call:** 30 min (with restaurant owner)
- **Technical setup:** 30 min - 4 hours (depending on POS tier)
- **Test & verify:** 30 min
- **Total:** ~1 hour for simple cases, ~half-day for POS integration

If a customer is taking more than a day to onboard, something is wrong — go back to the playbook and check what step is unclear.

---

## Step 0 · Create The Customer File

```bash
cp customers/_template.md customers/<restaurant-slug>.md
```

The slug should be: lowercase, kebab-case, no Arabic. Examples:
- "كافيه روستري" → `roastery-cafe`
- "مطعم بوزهيرة" → `bo-zhera`
- "KO-KO Chicky Licky" → `koko-chicky-licky`

Fill in the file as you go through the discovery call.

---

## Step 1 · Discovery (Ask The Owner)

### Business basics
- [ ] Restaurant name (Arabic + English)
- [ ] City, district, branch count
- [ ] Average orders/day (this affects pricing tier later)
- [ ] Current order channels (Foodics? WhatsApp? Walk-in only?)
- [ ] Languages needed (Arabic only, or Arabic + English?)

### Pricing decision (memorize these — don't negotiate down)
- **59 SAR/month** (monthly plan)
- **499 SAR/year** (annual — saves them ~209 SAR)
- Free 14-day trial — credit card required to start
- First-customer discount: **20% off year 1** (max). Never deeper.

### Tech footprint
- [ ] Do they have a POS system? Which one?
- [ ] Do they have a kitchen printer? Brand?
- [ ] Do they have WiFi at the restaurant? Stable?
- [ ] Do they have a dedicated phone for WhatsApp orders?

### Brand assets to collect
- [ ] Logo (PNG with transparent background, min 512×512)
- [ ] Full menu (PDF, Excel, or photos of the printed menu)
- [ ] Brand colors (or "use my logo's colors")
- [ ] WhatsApp number for receiving orders (must be a Business account)
- [ ] Address + GPS coordinates of the restaurant

---

## Step 2 · Decide POS Integration Tier

Use this decision tree:

```
Does the customer have any POS at all?
├─ NO → Tier 0 (WhatsApp only)        — easiest, just configure MenuLink
│
├─ YES → Which POS?
   ├─ Foodics                          → Tier 2 (OAuth, 1-2 weeks build)
   ├─ Marn / Loyverse / Square         → Tier 2 (custom adapter, 1-2 weeks)
   ├─ RzRz (Punnelifosys)              → Tier 1 (we have full access)
   │  └─ Is their SQL DB on central or local?
   │     ├─ Central (192.250.231.22)   → Tier 1a (direct DB writes — FASTEST)
   │     └─ Local (.mdf on cashier PC) → Tier 1b (Bridge App needed)
   │
   ├─ Other POS with public API        → Tier 2 (custom adapter)
   ├─ Other POS without API            → Tier 3 (webhook hack) or Tier 4 (direct print)
   └─ Unknown / very old POS           → Tier 5 (Bridge App with screen automation)
```

**Important:** If integration would take > 2 weeks for a single customer, push back. Tell the owner: "We can launch with WhatsApp-only first (Tier 0), gather data for a month, then evaluate full integration." This is honest and protects your time.

---

## Step 3 · Tier 0 Setup (WhatsApp Only)

If no POS, this is what you do — should take ~1 hour:

1. **Create restaurant record in Supabase** (`restaurants` table)
   - slug, name_ar, theme colors, WhatsApp number, logo URL
2. **Set up menu** — either:
   - Manual entry through admin UI (if user has 30+ items, ask for an Excel/CSV)
   - Bulk import via SQL if menu is in a structured format
3. **Generate the PWA URL** — `https://<slug>.menulink.app`
4. **Create QR code** — owner prints and puts on tables
5. **Train the owner** (5 min walkthrough):
   - How to mark items as out-of-stock
   - How to receive WhatsApp orders
   - How to view daily orders dashboard
6. **Test order** — place a real order, confirm WhatsApp arrives, owner can read it clearly.

Done. Mark in customer file as "live since YYYY-MM-DD".

---

## Step 4 · Tier 1 Setup (RzRz Direct DB)

Only do this if:
- Customer uses RzRz POS
- Their DB is reachable from Supabase (central or VPN'd)
- You have admin DB credentials

Steps:

1. **Get DB connection string** from customer (or from `.exe.config` if you can access their PC)
2. **Add to Supabase secrets** as `RZRZ_DB_CONNECTION` (never to git)
3. **Add restaurant config** in `restaurants` table:
   ```sql
   pos_type = 'rzrz'
   pos_config = { "db_secret": "RZRZ_DB_CONNECTION", "counter_id": 999, "created_by": 999, "online_customer_id": 999 }
   ```
4. **Get menu item mapping** — read `Items` from RzRz, map each to MenuLink products:
   ```sql
   -- columns are ItemName_E / ItemName_A (NOT ItemName); no verified IsActive — filter real items thus:
   SELECT ItemID, ItemName_E, ItemName_A, Rate FROM Items WHERE ItemParent <> 0 AND ItemName_A <> '-'
   ```
   Store the mapping in `menu_items.pos_item_id` field.
5. **Deploy Edge Function** `sync-order-to-rzrz` — see `sql-patterns.md` for code
6. **Configure trigger** — Supabase trigger on `orders` INSERT calls the Edge Function
7. **Test with a 1 SAR fake order** — see `debugging-playbook.md` for the test procedure
8. **Verify on RzRz side:**
   - Invoice appeared in `Invoice` table ✓
   - Items appeared in `InvoiceDetails` ✓
   - `KitichenOrderForPrint` got entries ✓
   - Kitchen printer printed the ticket ✓
   - Owner sees order in POS UI ✓

If ANY of these 5 verifications fail, stop and debug. Don't proceed to launch.

---

## Step 5 · Tier 1b Setup (RzRz Bridge App)

Only when customer's RzRz DB is local-only. **This is more work — 1-2 days.**

Build steps (TODO — flesh out after first deployment):
1. Build Bridge App (.NET 8 Windows service or tray app)
2. Customer installs `.exe` on cashier PC
3. App opens SignalR connection to MenuLink cloud
4. App receives orders, calls local `InsertInvoice`
5. Heartbeat every 30s so we know it's online

Will add detailed steps after we build the first Bridge App for a real customer.

---

## Step 6 · Tier 2 Setup (Foodics)

Stub — to be written when we get the first Foodics customer.

Outline:
1. OAuth flow → get access token
2. Read menu from Foodics → import to MenuLink
3. Confirm menu with owner
4. Configure webhook for order push
5. Test order → verify in Foodics
6. Subscribe to status webhooks (order accepted/cancelled)

---

## Step 7 · Train The Owner

Regardless of tier, the owner needs to understand:

### What they should do daily
- Check the MenuLink admin dashboard (mark items out-of-stock)
- Respond to customer messages on WhatsApp
- Update menu/prices through admin UI (or POS, if integrated)

### What they should NOT do
- Don't share their MenuLink admin password
- Don't try to "fix" things by editing the database directly
- Don't move the laptop running RzRz to a different network (breaks integration)

### Who to call if something breaks
- Tier 1 support: WhatsApp YOU (during business hours)
- Tier 2 support: SMS YOU (after hours, emergency only)
- Document the SLA expectations clearly upfront

---

## Step 8 · Run The Reflection

**This is the most important step.** After onboarding completes, ask yourself:

1. Did anything take longer than expected? Why?
2. Did the owner ask any question that wasn't in our docs? Add it to learnings.md.
3. Was there a POS quirk we didn't know about? Document it in the customer file AND in learnings.md if it might apply to other customers.
4. Did we make any promises (e.g., "we'll add feature X by next week")? Track them in a TODO file.

Then update `learnings.md` with whatever was new. **Do not skip this step.**

---

## Checklist Summary (For Quick Reference)

- [ ] Customer file created from template
- [ ] Discovery call completed
- [ ] Pricing tier confirmed (59 mo / 499 yr)
- [ ] Brand assets collected (logo, menu, colors, WhatsApp)
- [ ] POS integration tier decided
- [ ] Tier-specific steps completed (0/1a/1b/2/3/4)
- [ ] End-to-end test passed (real order through entire flow)
- [ ] Owner trained
- [ ] Reflection completed and learnings.md updated
- [ ] Customer marked as "live" in customers/<slug>.md
