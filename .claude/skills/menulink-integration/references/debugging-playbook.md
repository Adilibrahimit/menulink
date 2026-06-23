# Debugging Playbook · When Things Break

> Read when the user says something like "ما اشتغل", "في مشكلة", "الطلب ما وصل", "POS مش يطبع"

## 🧭 The First 3 Questions To Ask

Before diving in, ALWAYS ask these. They eliminate 80% of guesswork:

1. **Which customer?** (Brother's restaurant, or someone else?)
2. **Which step failed?** "Customer clicked send" → "Order saved in Supabase" → "Edge function fired" → "InsertInvoice succeeded" → "Kitchen printed" → "POS UI shows it"
3. **When did it last work?** (Today, yesterday, never worked?)

If the user says "I don't know" to step 2, walk through it methodically — see "End-to-End Test" below.

---

## 🧪 End-to-End Test Procedure

The reference test order. Run this whenever someone says integration is broken:

### Step 1: Place a test order
- Open the customer's PWA: `https://<slug>.menulink.app`
- Add 1 cheap item (e.g., a soda) to cart
- Submit with:
  - Name: "اختبار MenuLink"
  - Phone: 0500000000
  - Notes: "TEST_ORDER_<timestamp> — IGNORE"

### Step 2: Verify each layer
| Layer | What to check | Where |
|-------|---------------|-------|
| 1. Supabase saved order | Row in `orders` table | Supabase dashboard → Table editor |
| 2. Edge function fired | Log entry in `function_logs` | Supabase → Functions → Logs |
| 3. SQL insert worked | Row in `Invoice` table with `OnlineCustomerID=999` | SSMS or any SQL client |
| 4. Kitchen got it | Row in `KitichenOrderForPrint` | Same |
| 5. Printer fired | Owner confirms paper came out | Phone the owner |
| 6. POS shows order | Open POS UI, look for new order | TeamViewer / on-site |

The FIRST failure is where the bug is. Don't keep checking later layers if an earlier one failed.

---

## 🚨 Top 10 Issues Catalog

Add to this list as new issues come up. Each entry: symptom → cause → fix.

### Issue #1: Order saves but never reaches POS

**Symptom:** Supabase has the order, POS doesn't.

**Likely causes (in order of probability):**
1. Edge function didn't fire (check `function_logs`)
2. Edge function fired but timed out (>10s) — check function execution time
3. SQL connection failed (check function logs for connection errors)
4. SQL insert succeeded but POS doesn't refresh (RzRz polls vs realtime?)

**Quick check:**
```sql
SELECT TOP 5 InvoiceID, InvoiceDate, InvoiceAmount, OnlineCustomerID
FROM Invoice
WHERE OnlineCustomerID > 0
ORDER BY InvoiceDate DESC;
```
If the order is there → POS-side issue (refresh, network).  
If the order is NOT there → integration side (Edge function or SQL).

---

### Issue #2: SQL says "Cannot find ItemID X"

**Symptom:** Edge function logs show foreign key error on `InvoiceDetails.ItemID`.

**Cause:** A menu item in MenuLink doesn't have a corresponding `pos_item_id` mapped to a real RzRz `Items.ItemID`.

**Fix:**
1. Find the unmapped item in MenuLink's `menu_items` table where `pos_item_id IS NULL`
2. Run on RzRz DB:
   ```sql
   -- columns are ItemName_E / ItemName_A (NOT Item_A); real items: ItemParent <> 0 AND ItemName_A <> '-'
   SELECT ItemID, ItemName_A FROM Items WHERE ItemName_A LIKE N'%<item-name>%' AND ItemParent <> 0 AND ItemName_A <> '-';
   ```
3. Update `menu_items.pos_item_id` with the correct ID
4. **Add to learnings.md** — was there a sync gap? Document it.

---

### Issue #3: Kitchen prints garbage characters

**Symptom:** Printer fires but Arabic text comes out as `???` or `□□□`.

**Cause:** Encoding mismatch — usually the Arabic text in `Notes_A` is UTF-8 but the printer expects Windows-1256.

**Fix:** Check that:
- `Notes_A` is being written with `NVarChar` (NOT `VarChar`)
- The XML uses `nvarchar(max)` per the proc signature
- The Edge function does NOT escape Arabic characters with `\u` sequences

If still broken, the bug is on the POS print job side, not in our integration. Tell the user to check `Printers & Scanners` settings on the cashier PC.

---

### Issue #4: Order shows but with wrong prices

**Symptom:** Customer paid X SAR, POS shows different total.

**Likely causes:**
1. Menu prices in MenuLink ≠ prices in RzRz (sync drift)
2. Tax calculation difference (MenuLink has tax inclusive, RzRz applies tax)
3. Discount applied at wrong level

**Fix:**
- Read `Items.Rate` from RzRz for each item in the order
- Compare with `menu_items.price` in MenuLink
- If they differ, decide: which is the source of truth? (Almost always: RzRz)
- Re-sync the menu

**Long-term fix:** Schedule a nightly sync that pulls prices from RzRz → MenuLink.

---

### Issue #5: Edge function works locally but times out on Supabase

**Symptom:** `supabase functions serve` succeeds, but in production the function times out.

**Likely cause:** Supabase Edge Functions have a 10-second hard timeout. SQL connection over the internet to a SQL Server can be slow.

**Fix options:**
1. Reduce SQL roundtrips (one call to `InsertInvoice`, not 5 small calls)
2. Use a connection pool (e.g., Supavisor or pg-bouncer alternative)
3. Move the connection logic to a long-running serverless function (e.g., Cloudflare Workers with longer timeout)
4. Last resort: add a queue (Supabase Realtime → bridge service polls)

---

### Issue #6: Customer's RzRz is on local DB only

**Symptom:** Can't reach the customer's SQL Server from the cloud.

**Cause:** Their `.exe.config` points to `localhost` or `127.0.0.1` or a `.\SQLEXPRESS` instance.

**Fix:** You need a Bridge App. See `references/adapter-pattern.md` for the implementation pattern. There's no shortcut — direct cloud-to-local SQL is not feasible for production.

---

### Issue #7: Customer says "the app is slow"

**Symptom:** PWA takes >3 seconds to load the menu.

**Likely causes (in order):**
1. Images not optimized (>200KB each)
2. Customer has slow internet in their area
3. Supabase region too far (we should be on Frankfurt for Saudi proximity)
4. Menu has >100 items and no pagination

**Quick fix:** Run Lighthouse on `<slug>.menulink.app` — aim for performance score >85.

If images are the issue, run them through `tinypng.com` or use Supabase's image transformations.

---

### Issue #8: Order placed but customer never got confirmation

**Symptom:** Customer says "I clicked send but didn't get a WhatsApp reply."

**Cause:** This is by design — our PWA opens WhatsApp with a pre-filled message; the customer SENDS it themselves. If they didn't tap send, no message goes out.

**Fix:** This is a UX issue, not a bug. Make the "tap to send" instruction clearer on the PWA confirmation screen.

If the customer DID tap send and the restaurant didn't receive it → check restaurant's WhatsApp number is correct, and that they have the WhatsApp Business app installed (regular WhatsApp may not show notifications well).

---

### Issue #9: New customer reports "items missing from menu"

**Symptom:** Owner says "We have item X, but I don't see it on the link."

**Likely cause:** Menu wasn't fully imported during onboarding, or item is marked inactive.

**Fix:**
1. Check `menu_items.is_active` in Supabase
2. If syncing from RzRz: ensure the item is a real sellable row in RzRz `Items` (`ItemParent <> 0 AND ItemName_A <> '-'`) — there is no verified `IsActive` column; empty/placeholder slots have `Rate=0` or `ItemName_A='-'`
3. Re-run the menu sync if needed

---

### Issue #10: The Edge Function logs show "connection refused" intermittently

**Symptom:** Random failures, maybe 1 in 20 orders.

**Likely cause:** The customer's SQL Server is dropping idle connections, or there's an intermittent network issue between Supabase and the SQL Server.

**Fix:**
1. Add retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
2. Send the customer a WhatsApp alert if all 3 retries fail: "طلب رقم X ما وصل للنظام — راجع يدوياً"
3. Log the failure in a `failed_syncs` table for manual review later

---

## 🔍 Diagnostic Commands Cheat Sheet

### Check Edge function logs (last 100 invocations)
```
Supabase Dashboard → Edge Functions → sync-order-to-rzrz → Invocations
```

### Tail SQL Server activity (slow queries)
```sql
SELECT TOP 10 
  total_elapsed_time / 1000 AS duration_ms,
  text
FROM sys.dm_exec_query_stats s
CROSS APPLY sys.dm_exec_sql_text(s.sql_handle)
ORDER BY total_elapsed_time DESC;
```

### Check if InsertInvoice itself has changed (someone modified it?)
```sql
SELECT modify_date 
FROM sys.objects 
WHERE name = 'InsertInvoice';
```
If `modify_date` is recent and the user didn't expect it, someone updated the proc — flag this.

### List all today's failed orders (after we add the failed_syncs table)
```sql
SELECT * FROM failed_syncs 
WHERE created_at >= CURRENT_DATE 
ORDER BY created_at DESC;
```

---

## 📝 After Fixing An Issue

Every fix is a learning. After resolving anything in this playbook:

1. Was the issue NEW (not in this file)? → Add it to "Top 10" with full symptom/cause/fix
2. Was the fix non-obvious? → Add the learning to `learnings.md`
3. Could other customers hit this? → Mention in their customer file under "potential issues"
4. Should we proactively check for this in onboarding? → Update `onboarding-playbook.md`

The goal: this file should keep growing so the next session never starts from scratch on the same issue.
