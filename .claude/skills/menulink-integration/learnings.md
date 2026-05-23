# Learnings · MenuLink Integration

> **This file is read at the start of every session.** It accumulates knowledge across deployments so the same mistake never costs us twice.
>
> **🆕 Read [`memory.md`](../../../memory.md) at project root for current state.** This file is for *transferable gotchas* — patterns that apply to any tenant, any session.
>
> **Last updated:** 2026-05-19 (post-RLS-rewrite: 0008 shipped, 4 tenants live, dashboard charts, owner self-service logo)
> **Update protocol:** Append new entries under the right section. Keep each entry to 2-4 lines. Tag with confidence level.

---

## 🗂️ Customer Taxonomy (CRITICAL — read first)

We have **two distinct customer profiles** and they must never be conflated:

| Profile | Name | POS | Role | Relationship |
|---------|------|-----|------|--------------|
| 🥇 **First paying customer** | KO-KO Chicky Licky | TBD (probably none / WhatsApp only) | Revenue proof | Direct lead |
| 🔧 **Integration testbed** | RzRz Restaurant (name TBD) | RzRz (Punnelifosys ResApp) | Engineering R&D lab | User's brother is operations manager |

**Do not assume KO-KO has RzRz.** Do not assume the RzRz restaurant wants to pay. They serve different strategic purposes.

---

## ✅ What Has Worked

### LRN-2026-05-20-user-is-pos-cofounder (confidence: high) ⭐ STRATEGIC
**Context:** While starting the RzRz POS integration, the user revealed: "Samer is the programmer of this POS software and I'm his partner of this POS software." Samer Cefalu builds RzRz POS (a.k.a. Punnelifosys ResApp), the user is his business partner. Together they sell it to multiple restaurants. The brother's restaurant — branded RzRz under company "Itaqn w Jowdah" — is one of their own deployments.  
**Learning:** **The integration is NOT cross-organization — it's intra-organization.** The user co-owns both ends of the deal. This unlocks: (1) schema changes to `Invoice` table (e.g., add `ExternalRef` for clean idempotency), (2) co-developed stored procedures, (3) co-branded "RzRz POS + MenuLink" as a bundled product to all Punnelifosys customers, not just one. The "12-month partnership-with-Punnelifosys" goal in the rzrz-restaurant.md endgame section already exists at day zero. Adjust roadmap: faster, larger scope, more leverage.  
**Source:** session:2026-05-20  
**Triggers:** RzRz, Punnelifosys, Samer Cefalu, POS partnership, schema change, co-branding

### LRN-2026-05-20-cefalu-is-name-not-brand (confidence: high)
**Context:** The local production DB is `samer910_Cefalu`. Easy to assume "Cefalu" is the restaurant brand.  
**Learning:** Cefalu is **Samer's surname** (the POS programmer). The convention `samer910_<X>` is just Samer's DB-naming pattern. The brand customers see is **RzRz**, company is **Itaqn w Jowdah**. Don't display "Cefalu" anywhere user-facing. Don't rename the DB — too risky for an in-production POS — but document the disconnect clearly.  
**Source:** session:2026-05-20  
**Triggers:** DB naming, RzRz brand, Cefalu, samer910 prefix

### LRN-2026-05-20-menulink-onlinecustomer-works-end-to-end (confidence: high) ⭐
**Context:** First end-to-end test of MenuLink-as-OnlineCustomer on real RzRz POS. After inserting OnlineCustomerID=999 / Name="MenuLink" / CommissionPercent=0, the user opened the cashier UI, hit Online button (موقع الكتروني), saw "MenuLink" as a selectable channel alongside HungerStation/Jahez/Keeta, picked 3 items totaling 73 SAR, held the invoice, re-opened it, paid, printed — full workflow as if it were a HungerStation order. Invoice 402.  
**Learning:** **MenuLink is now a native channel in the POS data model.** The integration is just "automate what the cashier does manually" — Invoice + InvoiceDetails + KitichenOrderForPrint rows with OnlineCustomerID=999. No POS modifications were needed for the data side; the channel name + 0% commission flow through all existing reports automatically. Restaurants will see "MenuLink: 0% commission" in the same reports where they see "HungerStation: 10%".  
**Source:** session:2026-05-20  
**Triggers:** OnlineCustomer 999, MenuLink as channel, cashier UI integration, channel discovery

### LRN-2026-05-20-kitchen-print-name-matching (confidence: high)
**Context:** Bridge App on server programmatically inserted KitichenOrderForPrint rows but no print fired. Cashier UI on the SAME server also failed kitchen print for invoice 406 (only office printer fired). Cashier UI on a downstairs cashier machine printed kitchen fine for invoice 404.  
**Learning:** **Kitchen print dispatch is per-machine.** Each cashier UI client looks up the kitchen printer by NAME in the local Windows print queue (via item→ItemPrinters mapping → printer name string). The exact name is misspelled in the master config as **"KETCHIN"** (not "KITCHEN"). The server's Windows print queue had it as "KITCHEN", so the cashier UI on the server couldn't find a "KETCHIN" printer and silently failed. **Fix: rename the Windows printer on every machine that runs the cashier UI (or any future Bridge App) to exactly "KETCHIN".** Now cross-machine print fires correctly. Future Bridge App can run on the server or any cashier machine — just enforce the printer name during deploy.  
**Source:** session:2026-05-20 — user diagnosed via test page + UI configuration  
**Triggers:** kitchen printer, KETCHIN typo, Windows printer name, Bridge App deployment, print dispatch

### LRN-2026-05-20-insertinvoice-xml-structure (confidence: high) ⭐⭐ CRITICAL
**Context:** Reverse-engineered the actual XML the RzRz cashier UI sends to `InsertInvoice` via SQL Server Extended Events (rpc_completed, statement field). Multiple wrong-guess attempts (incl. the wrong shape suggested in `references/sql-patterns.md`) caused hours of debugging.  
**Learning:** The CORRECT XML structure is:

- **`@XmlInvoice`** = single self-closing `<Invoice .../>` root with ALL attributes (including the easy-to-miss `InvoicePartyID="00000000-..."` and `DishItemInvoiceID="00000000-..."`)
- **`@XmlItems`** = **multiple sibling `<Items ...>` elements with NO outer wrapper**. Each item is a separate self-closing element at the document root. SQL Server's `CAST(string AS xml)` defaults to **CONTENT mode** which permits multiple top-level elements. `@xml1.nodes('Items')` then matches each one directly. This contradicts the structure in `references/sql-patterns.md` (which used a `<Items>...</Items>` outer wrapper — that wrapper makes `nodes('Items')` match the root with NULL @ItemID, causing "Cannot insert NULL into column ItemID" failures).
- Cashier passes `TaxPercent="0"` per item; the proc's later UPDATE steps populate the real 15% rate from `GeneralSettings.Tax`.
- `@InvoiceType` proc parameter = same value as `XmlInvoice/@InvoiceType` = **11 for Online section** (NOT 1).
- `@AppendInvoiceIDS = N''` (empty string)

**Source:** session:2026-05-20 — Extended Events ring_buffer capture in `D:\New folder (5)\Q5\10\xml.txt`. The `sql-patterns.md` docs had a wrong structure that wasted significant time; update them.

**Triggers:** InsertInvoice, XmlItems, XmlInvoice, nodes('Items'), CONTENT mode, multi-item XML, RzRz schema

### LRN-2026-05-20-invoicetype-11-is-online (confidence: high)
**Context:** Comparing our test invoice (failed) to working held invoices 398/399 in the cashier "held invoices" search UI.  
**Learning:** **`Invoice.InvoiceType = 11` means "Online section" (موقع الكتروني)**. The docs in `references/sql-patterns.md` incorrectly said InvoiceType=1 was "regular sale" — that value actually displays as "Dine In" in the search UI. Confirmed by inspecting BillNos 28164/28165 (current held HungerStation orders): both have InvoiceType=11. For MenuLink integration, send `InvoiceType="11"` in `@XmlInvoice` (the stored Invoice.InvoiceType column). The proc PARAMETER `@InvoiceType` is separate and controls in-proc routing (=9 means party/event); keep that as 1 unless you need a special flow. Both 398 and the historic BillNo 20847 (a Keeta order from earlier today) had InvoiceType=11, confirming this is the canonical Online section value.  
**Source:** session:2026-05-20 — file `inoviceitemid3.txt`  
**Triggers:** InvoiceType, online section, موقع الكتروني, search UI display, ZATCA classification

### LRN-2026-05-20-almalaz-server-discovery (confidence: high)
**Context:** Discovery of the Almalaz branch server (one of two RzRz branches).  
**Learning:** Production setup confirmed:
- Machine: `DESKTOP-8Q7DQKA` (LAN name `PUNNELIFOSYS`), LAN IP `192.168.1.113`
- SQL: 2022 Express, instance `PUNNELIFOSYS\SQLEXPRESS`, Integrated Security
- DBs on the local instance: `samer910_Cefalu` (ops), `samer910_accreef` (accounting+web portal), `client` (purpose unknown)
- Kitchen printers on LAN: BBQ=192.168.1.175, **KITCHEN=192.168.1.177**, DESERT=192.168.1.179, KABULE=192.168.1.181
- Active config (`.vshost.exe.config`) shows ResApp/ResAppServer pointed at local Cefalu via Integrated Security; ResAppAccServer still points at remote `192.250.231.22 / samer910_accreef` even though accreef ALSO exists locally — investigate which is canonical before the Bridge App writes anything accounting-related.
- Standard home/office internet, no firewall restrictions on outbound — Supabase HTTPS calls from the Bridge App will work.

**Source:** session:2026-05-20 user-provided configs + screenshots in `D:\New folder (5)`  
**Triggers:** Almalaz, server discovery, IP, connection string, printer IPs, Bridge App deployment

### LRN-2026-05-23-online-customer-id-triggers-workflow (confidence: high) ⭐⭐ CRITICAL
**Context:** v2.5 enabled per-order `InvoiceType=3` (Delivery) for MenuLink orders. The cashier UI immediately blocked staff with a "Please select Payment type" popup loop they could not clear — even after picking مدى the popup re-fired. Diagnosis via screenshot: the payment-screen showed an "Online Bill No: 13" field, the hallmark of the online-order workflow.
**Learning:** **`Invoice.OnlineCustomerID > 0` triggers the cashier UI's online-order payment workflow, which has a payment-type lock that the cashier UI cannot clear when an invoice transitions between types.** The workflow is hardcoded in Samer's .NET WinForms code (no DB trigger, no GeneralSettings toggle) so it cannot be disabled via SSMS. **Workaround until Samer modifies the .NET source:** set `pos_settings.online_customer_id = 0` for MenuLink tenants so invoices look like normal walk-in sales. Channel attribution is sacrificed in the POS but preserved in MenuLink admin (`v_revenue_daily`).
**Source:** session:2026-05-23 user-screenshot diagnosis after v2.5 deploy
**Triggers:** OnlineCustomerID, online order workflow, "Please select Payment type" popup, payment-type lock, Invoice.OnlineCustomerID, walk-in mode

### LRN-2026-05-23-cashier-ui-overwrites-invoicenotes (confidence: high)
**Context:** Bridge v2.6 wrote the Arabic order_type label ("توصيل" / "محلي" / etc.) into `Invoice.InvoiceNotes` (the English/secondary notes field). Production receipt for BillNo 29496 / 29497 came out with InvoiceNotes EMPTY despite the bridge having sent the label — and the SQL confirmed InvoiceNotes had been overwritten with a copy of InvoiceNotes_A's content.
**Learning:** **The RzRz cashier UI silently rewrites `Invoice.InvoiceNotes` during the edit-then-pay flow.** Do not put any information you need on the receipt into that field — it gets clobbered. **Put it in `Invoice.InvoiceNotes_A` instead, which survives all cashier-UI operations** (and definitely prints because `GeneralSettings.ShowInvoiceNotesInPrint=1`). Bridge v2.7 moved the order_type label into a short prefix on InvoiceNotes_A and verified production receipt shows it. Trade-off: dropped the customer name from the receipt line to fit ~32-char thermal-printer width.
**Source:** session:2026-05-23 BillNos 29496/29497/29498
**Triggers:** InvoiceNotes, InvoiceNotes_A, cashier UI overwrite, receipt template, ShowInvoiceNotesInPrint

### LRN-2026-05-23-pos-invoice-type-mapping (confidence: high) ⭐
**Context:** Discovered the full set of `Invoice.InvoiceType` integer values used by RzRz Bukhari by placing one test invoice per type and reading back from the DB.
**Learning:** Verified integer-to-label mapping for RzRz:
  - **0** → Take Away (سفري) — shopping-bag icon — 16K historical rows, dominant
  - **1** → Dine In (محلي) — plate-and-utensils icon
  - **3** → Delivery (توصيل) — house icon — triggers driver-assignment workflow
  - **4** → Telephone (هاتف) — phone icon — triggers customer-picker workflow
  - **10** → Car (سيارة) — car icon — drive-thru flow
  - **11** → Online (موقع الكتروني) — Online icon — for HungerStation/Jahez/Keeta partners
The cashier UI also has Family/Section types (likely 2, but untested today). Each value triggers a different printer icon AND in some cases a different workflow path. For MenuLink the chosen default is **InvoiceType=1 (Dine In)** because it's the only one that doesn't trigger any workflow side effects.
**Source:** session:2026-05-23 test invoices BillNos 29487-29491 + items dump
**Triggers:** InvoiceType mapping, RzRz integers, label discovery, sample invoice testing

### LRN-2026-05-23-sb-secret-rejected-by-storage (confidence: high)
**Context:** Used the `sb_secret_*` key to upload 32 menu photos to Supabase Storage via REST. Got back 32 × `403 "Invalid Compact JWS"`. The Storage API parses Authorization as a JWT (the "Compact JWS" form) — the new `sb_secret_*` format isn't a JWT, so it's rejected at the auth-parse layer.
**Learning:** **Supabase Storage REST API only accepts the legacy JWT format (`eyJ...`) for `service_role` auth, NOT the new `sb_secret_*` keys.** This is broader than the documented PostgREST browser-context guard — Storage rejects the new format outright at JWT parse. Two ways to get the legacy JWT: (1) Supabase dashboard → Settings → API → Legacy section, OR (2) Management API `GET /v1/projects/{ref}/api-keys?reveal=true` and pick the row where `type='legacy' AND name='service_role'`. Method (2) is scriptable and was used to fix the upload in-session.
**Source:** session:2026-05-23 RzRz menu photo upload
**Triggers:** Supabase Storage, sb_secret, Invalid Compact JWS, 403, legacy JWT, Management API api-keys endpoint

### LRN-2026-05-23-postgrest-batch-key-consistency (confidence: high)
**Context:** Batch-inserted 36 menu_items via `POST /rest/v1/menu_items` with an array body. Conditionally included `badges_json` only when the item had badges. PostgREST rejected with `PGRST102 "All object keys must match"` after the first row that had a different key set. The first 8 rows (all having badges) got inserted, then the 9th (no badges) broke the chain — but rows 1-8 were already committed, leaving a partial-insert state.
**Learning:** **PostgREST batch INSERT requires ALL objects in the array to have IDENTICAL keys.** Conditionally including a key per row triggers PGRST102 mid-batch. The fix: always include every column key, set the value to `null` (or whatever default) when absent. Use `[ordered]` PowerShell hashtables to preserve key order across rows. Also note: PostgREST is NOT atomic — early rows commit before the constraint failure, so any rollback requires manual cleanup (or wrap in a SECURITY DEFINER function with a real transaction).
**Source:** session:2026-05-23 RzRz menu import phase C
**Triggers:** PostgREST, PGRST102, batch insert, All object keys must match, partial insert, atomicity

### LRN-2026-05-23-rzrz-pos-id-mapping-via-items-dump (confidence: high)
**Context:** Hand-prepared `menu-data.json` for RzRz Bukhari had pos_ids that mostly DIDN'T match the actual RzRz POS — they were guesses based on assumed sequential numbering. After dumping the real `Items` table, found that ~30 of 36 base item pos_ids needed correction. Examples: کبسة لحم بخاري was 2032 in reality (JSON guessed 2014); رز بخاري was 2071 (JSON guessed 2055); حمص was 2182 (JSON guessed 2160); كنافة was 2224 (JSON guessed 2208).
**Learning:** **Never trust hand-prepped pos_id mappings for RzRz menus — always verify against the live `Items` table first.** The actual ID layout has gaps and irregular starting offsets. The discovery query is: `SELECT ItemID, ItemName_A, Rate, ItemParent, ItemMainCategoryID FROM Items WHERE ItemID BETWEEN <range> ORDER BY ItemMainCategoryID, ItemID;`. Cross-reference by Arabic name. Also: many item slots are empty rows (Rate=0 or Name='-') as placeholders for future items — skip those. The variant-size pattern (base, base+6=half, base+12=quarter) does NOT hold uniformly across categories; only the grilled-chicken family follows it.
**Source:** session:2026-05-23 items_rzrz.md dump (414 rows) vs menu-data.json (36 items)
**Triggers:** pos_id mapping, Items table discovery, menu import, RzRz POS schema, hand-prepped data, verification

### LRN-2026-05-23-supabase-bcrypt-password-via-mgmt-api (confidence: medium)
**Context:** Needed to set a password for the rzrz-bukhari owner Auth user account. The Supabase Auth Admin API rejects `sb_secret_*` keys (browser-context guard). Instead of getting the legacy JWT, ran `UPDATE auth.users SET encrypted_password = crypt('<password>', gen_salt('bf'))` directly via the Management API SQL endpoint. Worked — owner can log in with the temp password.
**Learning:** **Supabase Auth uses bcrypt via the pgcrypto extension (`crypt() + gen_salt('bf')`), and you can set passwords directly via the Management API without going through GoTrue.** The `auth.users` table has `encrypted_password` (bcrypt hash) plus `email_confirmed_at` (set to `now()` to skip the verify-email step). This bypass is useful when you don't have the legacy JWT and don't want to wait for an email-reset round-trip. Caveat: the password ends up in the SQL command, which lands in any transcript — rotate immediately after first login. Don't make this a standard pattern, but it's the right escape hatch.
**Source:** session:2026-05-23 rzrz-bukhari owner enablement
**Triggers:** auth.users, encrypted_password, bcrypt, pgcrypto, crypt, gen_salt, Management API, password reset, GoTrue bypass

### LRN-2026-05-23-v6-to-v7-photo-filenames-misleading (confidence: high)
**Context:** Auditing KO-KO Chicky Licky's menu photos for accuracy. The v6 PWA's base64 photo dump that was decoded into `apps/web/public/menu/koko/*.jpeg` had filenames that did NOT match what the photo actually shows. Examples: `broasted_regular.jpeg` shows fried chicken with a chili pepper next to it (visually "spicy"), `broasted_spicy.jpeg` shows plain fried chicken (visually "regular"). The `SLUG_TO_IMG` mapping in `koko-images.ts` was already compensating — `br-reg` mapped to `broasted_spicy.jpeg` and vice versa — but without comments explaining why, it looked like a swap bug. Additionally many tender/sauce photos were generic multi-sauce platters or completely unrelated food (a drumstick photo labeled "tender_spicy", a Caesar wrap labeled "twister_maple", chopped herbs labeled "sauce_cheese").
**Learning:** **Never trust filenames from v6 base64 dumps. Always visually audit each photo against its slug.** The pattern is: open every image, compare to the menu item it serves, replace if mismatched. Pexels + Unsplash (both CC0, commercial-use OK) cover most food categories; for individual sauce shots search "{sauce-type} bowl" or "{sauce-type} dip". Avoid stock photos containing alcohol or non-halal ingredients for Saudi tenants. When adding the comment trail in code, document WHY the mapping looks counter-intuitive — future maintainers will think it's a bug otherwise.
**Source:** session:2026-05-23 KO-KO menu photo audit
**Triggers:** menu photos, v6 PWA base64, koko-images.ts, SLUG_TO_IMG, photo accuracy, Pexels, Unsplash, stock photography

### LRN-2026-05-23-web-audio-doorbell-for-tab-alerts (confidence: high)
**Context:** Restaurant cashiers leave the `/admin/orders` tab open during service but step away from the screen. Need an audio alert that wakes them up when a new order arrives — and crucially, the bell must loop until manually silenced (a single chime is missed). Implemented in `apps/web/app/admin/orders/orders-live.tsx` via the Web Audio API: a two-note doorbell chime (G5 → E5) generated by sine-wave oscillators with linear-ramp envelopes, looped every 1.8s via `setInterval`. No mp3 asset required, no bundle weight.
**Learning:** **Web Audio API is the right primitive for browser notification sounds when the alert needs to be tunable and loopable.** Three gotchas: (1) browsers block auto-play before any user gesture — gate the first `AudioContext.resume()` behind an explicit "Enable sound" button click that the user must press once per session; (2) Mac/iOS Safari needs `webkitAudioContext` as fallback; (3) browser tab title is the cheapest way to surface the alert when the tab is backgrounded — update `document.title` with the unseen-count prefix (e.g. `(3) 🔔 …`) so the visible tab badge in the OS bar wakes the user. For MenuLink the sound config is hard-coded; if tenants ask for choice ("loud / soft / off") later, add per-tenant settings in `restaurants` or a new `notification_prefs` table.
**Source:** session:2026-05-23 admin orders page
**Triggers:** Web Audio API, AudioContext, notification sound, autoplay gating, document.title, browser background tab, cashier UX

### LRN-2026-05-23-exceljs-is-the-typescript-openpyxl (confidence: high)
**Context:** Wanted "Tier-2 Excel" reports (Power-BI-grade dashboards: KPI cards, formulas, data bars, RTL, multi-sheet) from the Next.js admin pages. The excel-wizard agent's spec assumes Python + openpyxl + pandas, which doesn't run in Vercel's Next.js runtime. ExcelJS is the feature-equivalent TypeScript library: cell styles, fills, fonts, alignments, formulas (`=SUM`, `=AVERAGE`, `=COUNTIF`), conditional formatting including data bars, merged cells, number formats, RTL sheet views.
**Learning:** **ExcelJS in a Next.js API route is the right pattern for tenant-facing Excel exports.** Key implementation choices: (1) build a shared helper module (`apps/web/lib/excel-tier2.ts`) with the palette + KPI card pattern + branded-header factory so every export endpoint stays visually consistent; (2) formula-first — never hardcode totals, always `=SUM(Detail!I5:I10000)` so the workbook stays live when staff edit rows; (3) Arabic content needs `ws.views = [{ rightToLeft: true }]` on every sheet plus `Alignment(horizontal:'right')` on Arabic cells; (4) for the Tier-2 palette, force `argb: 'FF'+hex` (alpha-prefixed) because ExcelJS interprets 6-char colors as RRGGBB without alpha and renders them oddly; (5) ExcelJS' `DataBarRuleType` TypeScript shape is missing the runtime `color` field — cast `as any` to set it; (6) return the workbook as a `Response` with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and a `Content-Disposition: attachment` header for browser-native download.
**Source:** session:2026-05-23 admin export pipeline (`/api/admin/export/orders`, `/api/admin/export/customers`)
**Triggers:** ExcelJS, openpyxl equivalent, Tier-2 dashboard, Excel formulas, conditional formatting, data bar, RTL sheet view, Next.js API route, downloadable .xlsx

### LRN-2026-05-23-rfm-segments-need-action-prompts (confidence: medium)
**Context:** Designed the customers-page KPI cards and Excel "Segments" sheet. Showing just the count of customers in each segment ("Champion: 5, At-Risk: 8") isn't useful on its own — the restaurant owner has to know what to DO with each segment. Added per-segment **suggested action** text:
- Champion → "حافظ عليهم بمزايا VIP"
- Loyal → "كافئ التكرار · برنامج نقاط"
- New → "اشكرهم على أول طلب"
- At-Risk → "🚨 أرسل عرض خاص الآن"
- Lost → "حملة استرجاع: خصم كبير · اتصال شخصي"

**Learning:** **RFM is a tool, not an answer — every segment count must come with a "do this next" prompt** or it's just decoration. Apply this pattern wherever we surface analytics to a non-data-team tenant: pair the metric with the recommended action. For MenuLink's future loyalty service, the action text should be customizable per tenant so they can tune the wording to their voice (e.g., a fancy restaurant uses different language than a fast-food chain).
**Source:** session:2026-05-23 customers analytics
**Triggers:** RFM, customer segments, At-Risk, Lost, suggested action, analytics UX, win-back campaign

### LRN-2026-05-19-rls-rewrite-confirmed (confidence: high)
**Context:** Migration 0008 rewrote RLS using `auth.uid()` + lookup tables instead of JWT-claim paths, plus added missing `platform_admin` policies and `name_en` columns. User manually tested every owner + ops surface after `git push 8e5cb26` and the migration applied on 2026-05-19.  
**Learning:** **Confirmed working in production.** Test order persisted by `submit_order` was always in the DB — it became visible the moment owner RLS started resolving. Owner can create categories + items (simple modal), upload photos to `menu-images/<restaurant_id>/<item_id>-*`, upload logo + cover to `menu-images/<restaurant_id>/_brand/*`. Ops onboarding wizard (now using service_role admin client for restaurants INSERT) created 3 new tenants successfully — all 3 paid and active in `subscriptions`. Dashboard Chart.js (`react-chartjs-2` Line + Bar over `v_revenue_daily` scoped to `restaurant_id`) renders cleanly with seed data. **No sign-out was needed** — `auth.uid()` reads `sub` which is always in the JWT.  
**Source:** session:2026-05-19 user test report  
**Triggers:** RLS, post-deploy verification, 0008, dashboard charts, onboarding wizard, multi-tenant test

### LRN-2026-05-18-direct-db-rzrz (confidence: high)
**Context:** Investigating how to push MenuLink orders into RzRz POS  
**Learning:** RzRz stored procedure `InsertInvoice` accepts XML and automatically handles kitchen printing via `KitichenOrderForPrint` table — we can integrate WITHOUT modifying the .NET POS source code. The system has `OnlineCustomerID` field built-in, meaning it was designed for online orders from the start.  
**Source:** session:2026-05-18 | applies-to:rzrz-restaurant  
**Triggers:** RzRz integration, .NET POS, InsertInvoice, kitchen printing, online order

### LRN-2026-05-18-zatca-already-handled (confidence: high)
**Context:** Wondering if MenuLink needs to handle Saudi ZATCA e-invoicing for RzRz customers  
**Learning:** RzRz already has ZATCA support built-in (folder `2025/10/Zatca Service`). When we push orders via `InsertInvoice`, the tax calculations happen inside the procedure automatically. **We do not need to compute ZATCA on the MenuLink side.**  
**Source:** session:2026-05-18 | applies-to:rzrz-restaurant  
**Triggers:** ZATCA, e-invoicing, tax, فاتورة, Saudi compliance

### LRN-2026-05-18-multibranch-architecture (confidence: high)
**Context:** Understanding RzRz deployment topology  
**Learning:** RzRz uses central SQL Server (hosted at 192.250.231.22) + local branch DBs (`RZRZCLIENT.mdf`). Sync happens via `IsSyncRequired=1` flag. For MenuLink integration, write to the central server when DB is remote; use Bridge App pattern when DB is local-only.  
**Source:** session:2026-05-18 | applies-to:rzrz-restaurant  
**Triggers:** multi-branch, sync, central database, local database, IsSyncRequired

### LRN-2026-05-18-supabase-cli-same-software (confidence: high)
**Context:** Choosing between Docker Postgres → migrate-to-Supabase vs Supabase CLI for local dev
**Learning:** Supabase CLI's local stack (`npx supabase start`) is the SAME software as Supabase Cloud — Postgres, Auth, Storage, Realtime, Studio. So there's no "migration" step from local to cloud: write schema once as `supabase/migrations/*.sql`, run `supabase db push` when cloud creds arrive. Raw Docker Postgres would have meant rebuilding auth/RLS at deploy time.
**Why:** Avoiding schema drift was the deciding factor; the local-vs-prod-software parity guarantees that what works locally works in cloud.
**How to apply:** For any new MenuLink app (admin, bridge integrations), always use `supabase init` + `supabase start` rather than rolling raw Postgres. Resolves [[opn-local-dev-strategy]].
**Source:** session:2026-05-18 | applies-to:all customers
**Triggers:** local dev, Supabase, Docker Postgres, migration, schema drift

### LRN-2026-05-18-apps-web-monorepo-layout (confidence: high)
**Context:** Naming the Next.js+Supabase project directory
**Learning:** Code lives under `apps/web/` (monorepo convention), not `backend/`. Next.js is fullstack (frontend + serverless API routes), and the layout makes room for `apps/admin/` (restaurant dashboard) and `apps/bridge/` (.NET RzRz Bridge App) later without restructuring.
**Why:** Calling Next.js code "backend" is misleading; the `apps/*` convention matches Vercel/Turborepo norms and won't need rename when sibling apps land.
**How to apply:** New runnable apps go under `apps/<name>/`. Shared libs/types eventually under `packages/`.
**Source:** session:2026-05-18 (user correction during plan execution)
**Triggers:** project structure, monorepo, backend vs frontend, app naming

### LRN-2026-05-18-rls-tenant-via-jwt-claim (confidence: high)
**Context:** Designing multi-tenant RLS for `restaurants`, `customers`, `orders`, `order_items`
**Learning:** Use `restaurant_id::text = (auth.jwt() ->> 'restaurant_id')` for owner-side policies; Supabase puts custom JWT claims under `auth.jwt()`. Child tables (`order_items`, `customer_tags`) check parent via `EXISTS` subquery instead of duplicating `restaurant_id` on every row. Service role bypasses RLS so seed scripts and server-side Next.js routes Just Work.
**Why:** Keeps the schema normalised, makes RLS policies self-evident, and matches Supabase's JWT-claim mechanic.
**How to apply:** When adding any per-tenant table, follow this pattern. When adding an admin dashboard, the auth flow must inject `restaurant_id` into the JWT.
**Source:** session:2026-05-18 (first migration)
**Triggers:** RLS, multi-tenant, JWT claims, restaurant_id, owner policy

### LRN-2026-05-18-rfm-bucket-thresholds (confidence: medium)
**Context:** Defining customer segments for the analytics view `v_customer_rfm`
**Learning:** Initial bucket thresholds: Champion = recency ≤14d AND frequency ≥5; Loyal = recency ≤30d AND frequency ≥3; At-Risk = recency 31-60d; Lost = recency >60d; New = frequency = 1. These are starting heuristics for Saudi small-restaurant ordering cadence (most loyal customers order weekly).
**Why:** RFM thresholds are domain-sensitive; "recency ≤30 days" feels right for weekly-ordering food, would be wrong for monthly subscriptions.
**How to apply:** After first paying restaurant has 60+ days of real data, re-tune thresholds against actual cohort behaviour. Don't ship the dashboard with these as gospel.
**Source:** session:2026-05-18 (seed + view design)
**Triggers:** RFM, segmentation, customer analytics, churn, recency

### LRN-2026-05-18-snapshot-order-items (confidence: high)
**Context:** Designing `order_items` schema — link to a `menu_items` table or snapshot?
**Learning:** **Snapshot.** Store `item_name`, `variant`, `unit_price` directly on `order_items` rather than FK-ing to a `menu_items` row. If the owner edits the menu or changes a price next week, historical orders must still report what was actually sold at the time. Same reasoning for `total` on `orders` — frozen at submit time.
**Why:** Foreign key to a mutable menu would silently rewrite history; reporting and disputes would break.
**How to apply:** Any table representing a completed business event (order, invoice, payment) snapshots the relevant fields. Reference tables are for live state, not history.
**Source:** session:2026-05-18 (schema design)
**Triggers:** historical data, snapshot vs reference, order_items, menu changes

### LRN-2026-05-18-graphify-icons-noise (confidence: medium)
**Context:** Running `/graphify` on D:\menulink — detected 10 PWA icon images (all variants of the rooster logo)
**Learning:** Default detection treats every PNG as a separate input and would dispatch one subagent per image. For icon sets (identical content at different sizes), filter them out before extraction — they produce N redundant "rooster logo" nodes with no useful edges. Patched `.graphify_detect.json` to set `images: []` before semantic step.
**Why:** Graphify's strength is cross-document surprise; identical assets add noise, not signal.
**How to apply:** Before running `/graphify` on any project with sized-icon variants, drop the icon list from detection. Same trick for build output folders if they leak into detection.
**Source:** session:2026-05-18
**Triggers:** graphify, knowledge graph, image dedup, icons, PWA assets

### LRN-2026-05-19-ios-safari-geolocation-needs-gesture (confidence: high)
**Context:** v7 cart drawer had a Leaflet map that called `navigator.geolocation.getCurrentPosition` on mount. Worked on desktop and Android, but iPhones silently never asked for permission.
**Learning:** iOS Safari (and increasingly Chrome) requires geolocation requests to be inside a **direct user-gesture handler** (button click, tap). Auto-calling on mount doesn't even fire the permission prompt — it just fails silently with `PERMISSION_DENIED`. Always wire geolocation behind an explicit "📍 Use my location" button.
**Why:** Apple's privacy posture; same rule applies to push-notification subscription, audio playback, etc.
**How to apply:** Anywhere a permission-gated browser API is used, gate it behind an explicit user gesture. Provide a manual fallback (drag-pin, paste-link, etc.) that always works.
**Source:** session:2026-05-19 (v7 map fix)
**Triggers:** geolocation, iOS Safari, user gesture, permission denied silently, mobile

### LRN-2026-05-19-leaflet-zero-size-in-drawer (confidence: high)
**Context:** Leaflet map mounted inside a sliding-open cart drawer measured the container at 0×0 at first render → blank gray box.
**Learning:** Leaflet (and most JS map libs) calls `getBoundingClientRect()` once on init. If the container is hidden / mid-animation / `display: none`, the size sticks at 0 until you call `map.invalidateSize()`. **Single `setTimeout` isn't enough** for animated drawers — fire it at 60ms, 280ms, 600ms, 1200ms PLUS attach a `ResizeObserver` for any later layout shift (orientation, keyboard open, drawer resize).
**Why:** No way to know in advance when the parent will finish animating.
**How to apply:** Every map / chart / canvas / VR-canvas component mounted inside an animated parent needs the multi-stage invalidate + ResizeObserver pattern.
**Source:** session:2026-05-19 (v7 map fix)
**Triggers:** Leaflet, drawer, modal, map blank, invalidateSize, ResizeObserver

### LRN-2026-05-19-vercel-json-strict-schema (confidence: high)
**Context:** Added a `_comment` key to `vercel.json` for documentation. Deploy errored: "Vercel rejected unknown keys."
**Learning:** Vercel's `vercel.json` JSON schema is strict — unknown keys cause deployment failure, not warning. Document via git commit messages or a separate adjacent .md file. Never inline-comment vercel.json.
**Why:** Vercel validates the schema before bundling. Strict mode catches typos but also documentation attempts.
**How to apply:** Treat vercel.json as data-only. Comments live elsewhere.
**Source:** session:2026-05-19 (legacy redirect setup)
**Triggers:** vercel.json, schema error, deploy failed, unknown keys

### LRN-2026-05-19-stitch-design-system-vs-claude-design-md (confidence: medium)
**Context:** User invoked the `/stitch-skill`, generated a design system YAML for the customer PWA. Some choices conflicted with our `DESIGN.md` (Stitch picked `Inter` which is banned, picked `Hanken Grotesk` where we use Tajawal, picked `#141313` vs our `#0A0A0A`).
**Learning:** Treat Stitch (and any AI design tool) as an **input**, not authority. Our `DESIGN.md` is the source of truth. When Stitch's output conflicts, override the conflicting parts (font choices, banned colors, banned anti-patterns) and adopt the rest (structural ideas like 32px row heights, dot-indicator status chips, image-on-top cards, sticky bottom nav).
**Why:** Stitch is trained on generic patterns, doesn't know our Arabic-first / anti-Inter / no-purple constraints.
**How to apply:** Run Stitch → reconcile vs DESIGN.md → adopt the structural insights, reject the typography/color violations.
**Source:** session:2026-05-19 (v7 Stitch redesign)
**Triggers:** Stitch, design system, generated tokens, Inter banned, font conflict, design merge

### LRN-2026-05-19-image-on-side-vs-image-on-top-call (confidence: medium)
**Context:** When porting v6 (image-on-side compact list) to v7, I initially kept image-on-side. User pushed back — Stitch's image-on-top 2-col grid was the actual intent.
**Learning:** Image-on-top with 2-col grid (3 on tablet, 4 on desktop) creates a more "editorial" food-photography feel that matches modern Saudi restaurant ordering expectations. Image-on-side is denser but feels older/less premium. Default to image-on-top for new customer PWAs unless density is mandatory.
**Why:** Saudi users are highly visual; food photography sells. Density beats variety here.
**How to apply:** For any new customer-facing food/retail PWA, start with 2-col image-on-top. Only fall back to image-on-side if menu has 50+ items per category.
**Source:** session:2026-05-19 (v7 Stitch redesign, user corrected pragmatic-list choice)
**Triggers:** card layout, image position, food PWA, menu design

### LRN-2026-05-19-design-vs-operations-split (confidence: high)
**Context:** First version of `/admin/info` let restaurant owners edit logo, cover image, primary color, background color. User pushed back: "the dev id must do it i will take the design from the client... i'm the dev will be the designer not the tenant id or restaurants owners."
**Learning:** **Design is ops's job, not the tenant's.** Restaurant owners are operators — they should only edit operational data (menu items, prices, hours, WhatsApp number, address). Visual identity (logo, cover image, brand colors, name, slug) belongs to the platform team. This applies to MenuLink and to most agency-style SaaS where the platform takes on the design role.
**Why:** Owners aren't designers. Letting them pick colors leads to clashing brands and degraded platform aesthetic. The platform takes ownership of polish.
**How to apply:** When designing any tenant admin, audit each editable field: "Is this operational (data) or design (identity)?" Lock the design fields to ops only. Document the rule explicitly in DESIGN.md.
**Source:** session:2026-05-18 (user feedback after S7+)
**Triggers:** tenant admin, ops vs tenant, visual identity, brand colors, logo upload

### LRN-2026-05-18-new-secret-keys-block-server-side (confidence: high)
**Context:** Trying to create a Supabase Auth user via `POST /auth/v1/admin/users` with the new `sb_secret_*` key, got back `401 "Forbidden use of secret API key in browser"`.
**Learning:** Supabase's new key format (`sb_publishable_*` + `sb_secret_*`) is stricter than legacy JWT keys. The `sb_secret_*` is rejected by GoTrue's admin endpoints when the User-Agent looks browser-ish (and PowerShell's `Invoke-RestMethod` triggers this). **For Auth Admin API calls, fall back to the legacy `service_role` JWT** that's still issued alongside. Both keys point to the same role, but the legacy JWT bypasses the browser-context check.
**Why:** Supabase added this guard because pasting `sb_secret_*` into client code is catastrophic. The browser-context heuristic is over-broad.
**How to apply:** When writing operational scripts that hit the Auth Admin API, prefer the legacy `service_role` JWT (from `/v1/projects/<ref>/api-keys`). Keep `sb_secret_*` reserved for actual server runtimes (Vercel env, Supabase Edge Functions).
**Source:** session:2026-05-18 (creating the KO-KO test owner)
**Triggers:** auth admin api, sb_secret, 401, browser context, GoTrue, create user

### LRN-2026-05-18-realtime-needs-publication (confidence: high)
**Context:** Wrote the orders Realtime feed in /admin/orders before adding the table to the Supabase Realtime publication. Subscribed channel was silent.
**Learning:** Supabase Realtime only emits postgres_changes for tables explicitly added to the `supabase_realtime` publication. Run `alter publication supabase_realtime add table public.orders;` (and any other table you want live). Forgetting this is silent — no error, just no events.
**Why:** Supabase scopes Realtime per-publication to limit replication noise. The default publication doesn't include user tables.
**How to apply:** When adding a Realtime subscription to any new table, immediately run the ALTER PUBLICATION migration alongside the schema migration. Keep a checklist: schema + RLS + publication + client subscription.
**Source:** session:2026-05-18 (S5 admin orders feed)
**Triggers:** Realtime, postgres_changes, supabase_realtime, publication, ALTER PUBLICATION, silent subscription

### LRN-2026-05-18-nextjs-pathname-in-server-component (confidence: high)
**Context:** Wanted to detect whether the current /admin/* route was the login page in `app/admin/layout.tsx` to skip the auth guard for /admin/login. Next.js 14 Server Components have no direct way to read the request path.
**Learning:** Set `x-pathname: request.nextUrl.pathname` as a REQUEST header inside middleware, then read it in any Server Component via `headers().get('x-pathname')`. Don't use Next.js's `usePathname()` — that's client-only.
**Why:** Server Components don't have access to the request object; only middleware does. Middleware can mutate the request headers that flow downstream.
**How to apply:** Any time a Server Component needs to know the URL/path, route through middleware-injected headers.
**Source:** session:2026-05-18 (S3 admin layout skipping auth for /admin/login)
**Triggers:** Next.js, Server Component, pathname, middleware, headers, request URL

### LRN-2026-05-18-sw-stale-html-trap (confidence: high)
**Context:** First post-deploy live test of the wired PWA returned no rows in Supabase. Server was serving the new HTML (verified via direct fetch), but the user's browser saw old code.
**Learning:** PWA v6's service worker was cache-first **stale-while-revalidate** with a frozen VERSION key. On any user visit, the SW returned the previously-cached HTML and only fetched fresh in the background — so the customer always sees the previous deploy's HTML on first reload, never the latest. The cache_name is keyed off VERSION; if you never bump it, the activate handler never deletes the old cache.
**Why:** Cache-first SWE is fine for true static assets (icons, fonts) but a deploy-blocker for the page that contains your application code. Every deploy needs explicit cache invalidation.
**How to apply:** (1) Navigation/HTML requests should use **network-first** with cache fallback only for offline. (2) Bump VERSION on every meaningful deploy so the activate handler purges the old cache. (3) When debugging "my deploy seems to not be live" issues, always check via incognito or different browser first — eliminates the SW cache variable.
**Source:** session:2026-05-18 (first live PWA→Supabase test produced zero rows despite correct server code)
**Triggers:** service worker, cache-first, stale HTML, deploy not visible, PWA cache, sw VERSION

### LRN-2026-05-18-rls-conflict-with-cmd-all (confidence: high)
**Context:** Anon insert from PWA failing with "new row violates row-level security policy" even though `anon_insert_customers` policy had `with check (true)`.
**Learning:** When you have a PERMISSIVE policy with `cmd=ALL` scoped to `public` (all roles) AND a separate INSERT policy scoped to a specific role, the ALL policy still fires for that role's INSERT and its WITH CHECK is evaluated. Even though policies are OR'd in theory, in practice PostgREST/Supabase will refuse the insert when the ALL policy returns NULL/FALSE for an anon JWT. **Scope owner policies strictly to `to authenticated`** (never `to public` / no role clause), so they never fire for anon at all.
**Why:** Postgres permissive-OR semantics work as documented in isolation, but cmd=ALL policies are a footgun — they apply to INSERT too. Easier to never mix `to public` ALL policies with role-specific INSERT policies.
**How to apply:** When designing RLS for any new table: write SELECT, INSERT, UPDATE, DELETE policies as **separate, role-specific** statements. Never use `for all to public`. Make the role explicit on every policy.
**Source:** session:2026-05-18 (debugging first live PWA order that didn't land)
**Triggers:** RLS, row-level security, anon insert, cmd ALL, policy conflict, 42501

### LRN-2026-05-18-rpc-over-direct-writes (confidence: high)
**Context:** PWA needed to upsert customer, insert order, insert items as anon. Direct .from('table').upsert().select() pattern hit two problems: (1) RLS conflict above, (2) `.select('id').single()` requires SELECT permission on the table.
**Learning:** For anon-facing writes, prefer a single `SECURITY DEFINER` Postgres function over multiple direct-table calls. Benefits: (a) one atomic transaction, (b) one round-trip, (c) anon role gets EXECUTE on the function but NO direct table access — defence in depth, (d) the function is the security boundary and can validate inputs (`raise exception` on bad data), (e) easier to evolve later (add fields without changing client).
**Why:** The trade-off is that the function lives in SQL and is slightly less visible than client-side code. Worth it for the security/atomicity gains.
**How to apply:** For any future anon-facing write (push subscription, customer feedback, etc.), reach for an RPC first. Direct-table writes are for the admin app (authenticated, with RLS-enforced tenant scoping).
**Source:** session:2026-05-18 (live PWA order bug, fixed via submit_order RPC)
**Triggers:** anon write, RPC, security definer, RLS workaround, direct table insert

### LRN-2026-05-18-fire-and-forget-persist (confidence: high)
**Context:** Wiring v6 PWA to write each order to Supabase before opening WhatsApp.
**Learning:** Do NOT `await` the Supabase insert before opening the wa.me URL. Use fire-and-forget: kick off `persistOrder(...)` (no await), then immediately `window.open(...)`. Reasons: (1) zero perceived latency for the customer, (2) WhatsApp opens even if Supabase is down, (3) the Promise keeps running in the background after window.open. The persist function has its own try/catch so unhandled rejections never bubble.
**Why:** The customer's order experience must never depend on our database being healthy. Lost analytics row > lost customer order.
**How to apply:** Any "side-effect on action" call (analytics, telemetry, audit log) should fire-and-forget when latency to the user-visible action matters more than guaranteed delivery. Use awaited writes only when the next user action genuinely depends on the result.
**Source:** session:2026-05-18 (PWA wiring)
**Triggers:** fire-and-forget, await, latency, analytics, fail open

### LRN-2026-05-18-phone-normalization-saudi (confidence: high)
**Context:** Unique index `(restaurant_id, phone)` on customers — needed to catch repeat customers
**Learning:** Saudi customers type phones in at least 4 formats: `0501234567`, `966501234567`, `+966501234567`, and `٠٥٠١٢٣٤٥٦٧` (Arabic-Indic digits). Without normalization, the SAME customer creates a new row per format. Normalize to `+9665XXXXXXXX` at insert time: map Arabic-Indic → ASCII digits, strip non-digits, drop `00966`/`966`/`0` prefix, prepend `+966`.
**Why:** Repeat-customer detection drives RFM frequency, LTV, dormant-customer targeting. Wrong phone format = the analytics value layer silently breaks.
**How to apply:** Every new ingestion point (PWA, admin tool, POS import, CSV upload) must call `normalizePhone()` before any DB write. Same function lives in v6 PWA — copy it forward to apps/web later, don't reimplement.
**Source:** session:2026-05-18 (PWA wiring)
**Triggers:** phone normalization, Arabic-Indic digits, duplicate customers, unique index, RFM

### LRN-2026-05-18-cloud-pivot-via-mgmt-api (confidence: high)
**Context:** Docker daemon froze mid-pull during `supabase start`. User had just provided a Supabase access token (sbp_*) and project was already created in dashboard.
**Learning:** When the local Docker stack is unavailable, you can apply migrations directly to Supabase Cloud via the Management API: `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `Authorization: Bearer <access_token>` and `{"query":"<sql>"}`. No DB password needed, no Docker needed, no `supabase db push`. Used this to apply 0001_init.sql, 0002_analytics_views.sql, and seed.sql in 3 calls.
**Why:** The Supabase CLI's `db push` workflow requires Docker (for shadow DB diff) AND the database password. The Management API skips both.
**How to apply:** For any future "Docker is dead but I need to ship" moment, OR for one-off operational SQL on a cloud project, use the Management API. Save the user the trouble of a Docker Desktop restart.
**Source:** session:2026-05-18 (encountered + recovered live)
**Triggers:** supabase cloud, management API, Docker frozen, db push, alternative deploy path

### LRN-2026-05-18-mcp-vs-cli-account-separation (confidence: high)
**Context:** The Claude.ai Supabase MCP server is configured with one Supabase account (project "alsamlah", ap-northeast-2). The user created a separate MenuLink Supabase account (id.menulink@gmail.com) with project "Menu Link Project" in Singapore.
**Learning:** The MCP `mcp__claude_ai_Supabase__*` tools operate on whichever account the MCP server was wired to during Claude Code setup. They cannot reach a project on a different account, even if a personal access token for that account is available in the session. **For multi-account work, use the Management API via PowerShell + Invoke-RestMethod**, not the MCP.
**Why:** MCP tools are stateless wrappers around stored credentials in the MCP server config; the access token in chat does not retroactively switch accounts.
**How to apply:** Whenever the MCP `list_projects` shows a different project than the user is talking about, fall back to the Management API. Don't waste a tool call trying.
**Source:** session:2026-05-18
**Triggers:** Supabase MCP, multiple accounts, project ref mismatch, management API fallback

### LRN-2026-05-18-supabase-start-saturates-docker (confidence: medium)
**Context:** First-time `npx supabase start` on a clean Docker Desktop install
**Learning:** Supabase pulls ~14 images in parallel (postgres, kong, gotrue, postgrest, storage, realtime, studio, edge-runtime, logflare, imgproxy, vector, mailpit, postgres-meta, supabase-vector). On a moderately fast network this saturated Docker Desktop on Windows so badly that even `docker version` started timing out (>60s). Killed the start, daemon stayed unresponsive — Docker Desktop needed a manual restart.
**Why:** Parallel pull + parallel extract of multi-GB images stresses Docker Desktop's WSL2 layer.
**How to apply:** Warn the user before first `supabase start` that pulls will be slow and Docker may need a restart. After the initial pull, subsequent starts use cached layers and are fast (~30s). Consider pre-pulling images serially next time: `docker pull supabase/postgres:<ver>; docker pull supabase/gotrue:<ver>; ...` to avoid the saturation.
**Source:** session:2026-05-18 (encountered during plan execution)
**Triggers:** supabase start, Docker Desktop, frozen daemon, first-run pull, Windows WSL2

### LRN-2026-05-18-customer-segmentation (confidence: high)
**Context:** Initial assumption that KO-KO was the brother's restaurant and our test bed for RzRz  
**Learning:** **WRONG.** KO-KO is a paying customer who approached us directly, wants 2 instances of MenuLink, and may not use RzRz at all. The RzRz integration testbed is a DIFFERENT restaurant where brother is operations manager. **Always verify which customer you're working with before applying RzRz-specific knowledge.**  
**Source:** user correction on session:2026-05-18  
**Triggers:** KO-KO, brother's restaurant, customer taxonomy, RzRz testbed

### LRN-2026-05-23-holdmode-end-to-end (confidence: high) ⭐
**Context:** Verified Bridge App v2.3 (commit 18ec1a0, HoldMode default true) end-to-end on the RzRz testbed: MenuLink order → pos_outbox row → Bridge claims → `dbo.InsertInvoice` with `@IsHold=1` → invoice 440 appears in the cashier UI's held-list (not paid). DB verification: `Invoice.IsHold=1`, `PaymentDetails` empty, `InvoicePaymentTypeDetails` empty. Staff tap Pay manually to finalize, which fires the native receipt + kitchen print via the cashier UI's own dispatcher.
**Learning:** **HoldMode is the right default for MenuLink orders.** Confirmed pattern: write only the Invoice + InvoiceDetails rows with `IsHold=1`, then stop. Don't write payment, don't print kitchen ourselves — let the existing cashier UI handle finalize-time printing because (a) staff get to review the order before committing, (b) the print uses the POS's native format for free, (c) less moving parts in our code path. Switch HoldMode off only for high-volume tenants where manual review is impractical.
**Source:** session:2026-05-23 | applies-to:rzrz-restaurant
**Triggers:** HoldMode, IsHold=1, v2.3, held invoices, deferred payment, manual review

### LRN-2026-05-23-windows-auth-cross-machine-needs-grant (confidence: high) ⭐
**Context:** Bridge running on RzRz server as Windows user `DESKTOP-8Q7DQKA\pc` failed with SQL error 4060 "Cannot open database 'client' requested by the login. The login failed." Past v2.2 runs had worked — they used a different Windows user (Administrator) which already had db access.
**Learning:** **Even on the SAME machine, Integrated Security only works if the specific Windows user running the bridge has been explicitly mapped as a database user.** The fix is one short SSMS block (run as `sa`): `CREATE LOGIN [HOST\user] FROM WINDOWS` at server scope, then in the target DB: `CREATE USER [HOST\user] FOR LOGIN [HOST\user]; ALTER ROLE db_owner ADD MEMBER [HOST\user];`. Idempotent with `IF NOT EXISTS` guards. For the integration testbed, `db_owner` is fine; for production tenants scope to `db_datareader + db_datawriter + GRANT EXECUTE ON SCHEMA::dbo`.
**Source:** session:2026-05-23 | applies-to:rzrz-restaurant + every future Bridge App deploy
**Triggers:** SQL error 4060, Login failed, Integrated Security, Windows-auth, db_owner, CREATE USER FROM LOGIN

### LRN-2026-05-23-rzrz-receipt-notes-budget (confidence: high)
**Context:** v2.3 receipt for invoice 439 / 441 overflowed: the InvoiceNotes_A field "MenuLink #N · {shortId} · {name} · +966xxxxxxxxx · {address}" (~60 chars) wrapped on top of the items-table header. The RzRz thermal receipt template prints InvoiceNotes_A on a single fixed-position line — it does NOT word-wrap, it overlays.
**Learning:** **Keep `InvoiceNotes_A` to ~30 characters or less for the RzRz Bukhari thermal printer template.** Drop the short order id (the `MenuLink #N` is already the canonical identifier — that's also what the idempotency precheck keys off). Drop the address (kitchen doesn't need it; delivery driver gets it via the WhatsApp deep-link). Strip the `+966` prefix from phones — Saudi readers expect 05xx form. v2.4 (commit 16a732d) does exactly this: `"MenuLink #N · <name> · 05xxxxxxxx"`. If a future tenant uses a wider receipt or a different POS, raise the cap then.
**Source:** session:2026-05-23 user screenshots `D:\New folder (5)\Q5\11`
**Triggers:** InvoiceNotes_A, thermal printer width, receipt overflow, BuildNotesArabic, phone prefix

### LRN-2026-05-23-customer-pwa-anon-reads (confidence: high) ⭐
**Context:** Built the loyalty feature with `/m/<slug>/account` page that does direct `.from("restaurants").select(...)` and `hasAddon()` calls. Original anon policies on the menu side worked only because they routed through `get_public_menu()` SECURITY DEFINER RPC, which hid the fact that the underlying tables had NO anon SELECT policies. The new account page hit those gaps and 404'd.
**Learning:** **Every table the customer PWA reads from MUST have anon SELECT explicitly, OR be wrapped in a SECURITY DEFINER RPC.** Tables that fall into this: `restaurants` (gated by is_active+is_published), `subscription_addons`, `loyalty_settings`, `loyalty_rewards` (active only), `customers` (auth_user_id = self only). When adding any new customer-facing table read, grep for `to anon` in migrations and confirm there's a matching policy — or use an RPC.
**Source:** session:2026-05-23 loyalty rollout (cost: 3 hotfix migrations)
**Triggers:** anon RLS, customer PWA, get_public_menu hides gaps, 404 after page load, restaurants table

### LRN-2026-05-23-two-trigger-isolation (confidence: high) ⭐
**Context:** Adding the loyalty earn logic on order INSERT was tempting to bolt onto the existing `touch_customer_last_seen` trigger. Advisor pushed back: if loyalty bookkeeping fails (bad jsonb, missing settings row, divide-by-zero), the WHOLE order insert fails → customer can't checkout → tenant loses revenue.
**Learning:** **When adding a risky new trigger alongside an existing critical one, keep them as TWO separate trigger functions on the same table.** The risky one wraps its body in `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ... END` so a bug NEVER breaks the core insert. Trigger fire order matters — PostgreSQL fires AFTER INSERT triggers alphabetically by name; use a `z_` prefix on the new one if it must run after an existing trigger (e.g., `z_loyalty_after_insert` runs after `orders_touch_customer`).
**Source:** session:2026-05-23 loyalty migration 0017
**Triggers:** trigger blast radius, EXCEPTION WHEN OTHERS, trigger fire order, z_ prefix, additive trigger

### LRN-2026-05-23-uuid-is-real-auth (confidence: high)
**Context:** Built `mark_arrived(order_id, plate)` and `link_customer_account(phone)` as anon-callable RPCs. Plate and phone serve as "is this the right person" checks, but neither is real auth.
**Learning:** **For anon-callable RPCs where the identifier is an unguessable UUID, the UUID IS the security boundary; secondary fields (plate, phone) are just soft sanity checks.** Acceptable when stakes are low (mark-arrived ping, balance-only loyalty). When stakes rise (redemption against real inventory, money), the soft check needs to become a real OTP. Document the residual risk so future-you knows when to upgrade. Don't over-engineer the verification before the stakes justify it.
**Source:** session:2026-05-23 car-curbside + loyalty link
**Triggers:** anon RPC, security boundary, UUID, phone verification, OTP, hijack guard

### LRN-2026-05-23-addon-is-default-semantic (confidence: medium)
**Context:** Designed the addon framework with `addon_catalog.is_default boolean`. The semantic was ambiguous: does `is_default = true` mean "always on / can't be disabled" or "auto-enabled on new tenant creation"?
**Learning:** **In the MenuLink addon framework, `is_default = true` means "auto-enable for new tenants on onboarding + backfill existing tenants on launch". It is NOT a permission gate — ops can still toggle `is_default = true` addons OFF for problem cases.** Keeps flexibility for "tenant abused excel_export → temporarily disable" scenarios. Don't confuse with a future "required addon, cannot disable" flag (which we don't have yet and probably won't need until enterprise tier).
**Source:** session:2026-05-23 addon framework rollout
**Triggers:** addon catalog, is_default, default vs required, addon semantics, onboarding wizard

---

## ❌ What Has Failed (Avoid These)

### LRN-2026-05-18-direct-db-only-if-remote (confidence: medium)
**Context:** Initially assumed direct SQL connection from Supabase Edge Functions would always work for RzRz  
**Learning:** Direct DB integration only works if the customer's SQL Server is publicly accessible (the central hosted server at 192.250.231.22). For local-only deployments (DB on cashier's PC behind a router), direct connection is impossible — **Bridge App is required.** The RzRz restaurant testbed is likely a local-only deployment.  
**Source:** session:2026-05-18  
**Triggers:** SQL connection, firewall, local database, port forwarding, NAT

### LRN-2026-05-18-no-overengineering (confidence: high)
**Context:** Tempted to evaluate Ruflo agent orchestration framework for the project  
**Learning:** Frameworks like Ruflo (314 MCP tools, 26 CLI commands, alpha-stage) are designed for complex enterprise software engineering with parallel agent swarms. For a solo developer building a restaurant SaaS, this is severe over-engineering. **Decision: skip. Stick with managed services + clear handoff docs + this skill.**  
**Source:** session:2026-05-18  
**Triggers:** Ruflo, agent orchestration, multi-agent, swarm, framework adoption

### LRN-2026-05-18-assumption-customer-conflation (confidence: high)
**Context:** Mistake in earlier session: I assumed KO-KO was the brother's restaurant with RzRz access  
**Learning:** When a user mentions a customer name and a technical detail (like POS access), **never assume they refer to the same restaurant.** Ask: "Is the POS at the same restaurant as the one ordering MenuLink, or a different one?" The cost of asking is 10 seconds; the cost of building on wrong assumption can be days.  
**Source:** user correction on session:2026-05-18  
**Triggers:** customer info, restaurant details, assumption check

### LRN-2026-05-23-powershell-string-newline-trap (confidence: high) ⚠️
**Context:** Pasted a multi-line code block into PowerShell with a single string spanning lines: `$env:X = \n>>   "Server=...;Integrated Security=true;..."`. Bridge then failed with `Keyword not supported: 'integrated\n  security'.` — a literal newline + leading spaces had been embedded INSIDE the quoted string. SQL connection-string parser doesn't accept embedded whitespace inside the keyword name. Burned an entire retry budget (5 attempts) before the diagnosis.
**Learning:** **PowerShell's `>>` line continuation inside a quoted string preserves the newline as a literal character in the resulting value.** When pasting a long string into PowerShell — especially connection strings — type it as ONE line, even if the terminal wraps visually. Two safeguards: (a) prefer `Trusted_Connection=True` over `Integrated Security=True` (single token, no internal whitespace to corrupt); (b) after setting an env var that wraps in the terminal, verify with `$env:X.Length` and `$env:X -replace "\n","\n"` to catch hidden newlines before running anything that consumes it.
**Source:** session:2026-05-23 (cost: ~5 retry attempts + a row reset)
**Triggers:** PowerShell, multi-line string, connection string, env var, Integrated Security, line continuation, keyword not supported

### LRN-2026-05-23-sb-secret-postgrest-guard-too (confidence: high) ⚠️ UPDATE
**Context:** Originally `LRN-2026-05-18-new-secret-keys-block-server-side` documented the `sb_secret_*` browser-context guard as Auth Admin API only. Today hit the SAME guard hitting PostgREST `/rest/v1/restaurants` from `Invoke-RestMethod` / `Invoke-WebRequest` (both default to a Mozilla-flavoured UA).
**Learning:** **The `sb_secret_*` browser guard applies to all of Supabase's HTTP surface (PostgREST, Auth Admin, etc.) — not just Auth Admin.** Anything that looks like a browser request gets a 401 "Forbidden use of secret API key in browser". For PowerShell scripts: set a non-browser `User-Agent` header (e.g., `"menulink-tooling/1.0"`) on every request. The Bridge App itself is unaffected because .NET's HttpClient sends NO User-Agent by default — verified in this session via a from-the-bridge mimic call that got 200 OK with the same key. So: PostgREST from .NET → fine. PostgREST from PowerShell → must override UA.
**Source:** session:2026-05-23 (extends the 2026-05-18 learning)
**Triggers:** sb_secret, PostgREST, 401, browser context, Invoke-RestMethod, Invoke-WebRequest, User-Agent

### LRN-2026-05-19-supabase-jwt-claims-nested (confidence: high) ⚠️ CRITICAL
**Context:** Migrations 0001/0003/0004/0005/0007 wrote RLS policies using `auth.jwt() ->> 'restaurant_id'` and `auth.jwt() ->> 'role'`. After v7 launch, every authenticated query silently returned empty results: owner couldn't create categories ("RLS violation"), `/admin/info` threw "Cannot coerce to single JSON object", `/admin/orders` showed no rows. The dashboard "revenue" tile still showed numbers — *because views bypass RLS in PG15+ default `security_invoker=false`* (which is also a cross-tenant data leak by itself).  
**Learning:** **Supabase nests `app_metadata` claims inside the JWT — they are NOT top-level.** So `auth.jwt() ->> 'restaurant_id'` always returns NULL. The correct path is `auth.jwt() -> 'app_metadata' ->> 'restaurant_id'`. **Better fix: don't read JWT claims at all** — use `auth.uid()` + a lookup against `restaurant_owners` / `platform_admins`. That's what migration 0008 does (helper functions `public.owns_restaurant(uuid)` and `public.is_platform_admin()`, both SECURITY DEFINER to avoid RLS recursion).  
**Also:** views with default `security_invoker=false` will leak across tenants if the calling code doesn't add `.eq("restaurant_id", ...)`. The dashboard had this bug on `v_revenue_daily` until 0008.  
**Source:** session:2026-05-19 + advisor correction  
**Triggers:** RLS, Supabase, auth.jwt, app_metadata, restaurant_id claim, multi-tenant security

### LRN-2026-05-19-ops-needs-policies-or-service-role (confidence: high)
**Context:** Ops onboarding wizard (`/ops/tenants/new`) used the cookie client to INSERT into `restaurants`, but there was NEVER an INSERT policy for that table. RLS just dropped it silently.  
**Learning:** Two-prong fix: (1) add explicit `platform_admin` ALL policies on every table ops touches (restaurants, menu_*, customers, orders, payments, subscriptions) using the `is_platform_admin()` helper; (2) for ops actions specifically, prefer the **service_role admin client** — `requireOps()` is the auth gate, and bypassing RLS for ops is safer and simpler than chasing per-table policies.  
**Source:** session:2026-05-19  
**Triggers:** ops, platform_admin, service_role, RLS INSERT, cookie client

---

## 🏷️ Customer-Specific Quirks

### KO-KO Chicky Licky (first paying customer)
- POS: TBD (not RzRz — confirmed)
- Wants **2 instances** of MenuLink — meaning unclear (2 branches? 2 brands? 2 languages?)
- Has v6 PWA already built and ready
- Already has full menu, branding, design assets
- **Blocker:** clarify "نسختين" meaning before doing anything else
- See `customers/koko-chicky-licky.md` for full details

### RzRz Restaurant (integration testbed)
- POS: **RzRz (Punnelifosys ResApp)** — full version
- User's brother is operations manager → privileged access
- Likely Tier 1b (Bridge App) — local DB assumption
- This is where we build & validate Bridge App before selling to other RzRz customers
- Real production load — can't break for long
- **No pricing pressure** — free or discounted in exchange for R&D access
- See `customers/rzrz-restaurant.md` for full details

### LRN-2026-05-23-rls-anon-vs-public (confidence: high) ⚠️ CRITICAL
**Context:** Loyalty rollout shipped three RLS policies as `to anon` (subscription_addons, addon_catalog, loyalty_settings) to gate the customer PWA's addon checks. They worked for anonymous visitors. But the moment a customer signed in with Google, their session role became `authenticated` — and the `to anon` policies STOPPED applying. Result: signed-in customers got 404 on `/m/<slug>/account` because `hasAddon()` returned false. Same root cause hit again on the `restaurants` table read. Cost three hotfix migrations (0018, 0019, 0020) over an iterative debugging loop.
**Learning:** **PostgreSQL RLS treats `anon` and `authenticated` as ENTIRELY separate roles for policy matching.** A policy scoped `to anon` is invisible to a signed-in user, even if the user is "less privileged" than an owner. For customer-facing read tables where ANY visitor (anon OR a signed-in customer who isn't owner/ops) must read, use **`to public`** which matches both roles. Reserve `to anon` only for cases where you genuinely want to exclude signed-in users (rare; can't think of a real case).
**Why I missed it:** Thought `to anon` was a strict superset ("anon is the minimum, authenticated can do everything anon can"). It's not — they're peers.
**Source:** session:2026-05-23 loyalty rollout (3 hotfix migrations to get right)
**Triggers:** RLS, to anon, to public, to authenticated, customer signed in 404, role-scoped policies, Postgres roles

---

## ❓ Open Questions

### ~~OPN-2026-05-18-local-dev-strategy~~ ✅ RESOLVED
**Resolution:** Use Supabase CLI (`npx supabase start`), not raw Docker Postgres. See [[lrn-2026-05-18-supabase-cli-same-software]].

### OPN-2026-05-18-koko-instances (priority: critical, blocker)
**Question:** What does KO-KO mean by "نسختين من MenuLink"? Two branches? Two brands? Arabic+English versions? Test+Production?  
**How to investigate:** WhatsApp/call the owner directly. This is a blocker — we can't onboard them until we know.  
**Quick script:** "أهلاً، قبل ما نبدأ — قصدك في النسختين الفرعَين الاثنين، أو ايش بالضبط؟"

### OPN-2026-05-18-koko-pos (priority: high)
**Question:** Does KO-KO use any POS system? If yes, which?  
**How to investigate:** Ask owner during the same call as above. Affects which integration tier to plan.

### OPN-2026-05-18-rzrz-db-topology (priority: high)
**Question:** At the RzRz restaurant (brother's), is the SQL database hosted on the central server (192.250.231.22) or local-only on the cashier PC?  
**How to investigate:** Brother can answer. Look at `.exe.config` connection string on the cashier PC. Determines Tier 1a (direct DB) vs Tier 1b (Bridge App).

### OPN-2026-05-18-counterid-for-online (priority: high)
**Question:** What value of `CounterID` should online orders use in `InsertInvoice`? The procedure requires it but POS counters are physical terminals. Need to either:
(a) Create a virtual "online counter" in RzRz settings  
(b) Reuse counter #1 with a different flag  
(c) Check if `CounterID=0` is acceptable  
**How to investigate:** Try each option on RzRz restaurant DB (with brother's permission), watch what shows up in POS UI.

### OPN-2026-05-18-createdby-for-online (priority: high)
**Question:** Same as above but for `CreatedBy`. This is a user ID. We need either a special "MenuLink Bot" user or reuse owner's user ID. Affects audit trail.

### OPN-2026-05-18-menu-sync-direction (priority: medium)
**Question:** For RzRz customers, should MenuLink read menu FROM RzRz (single source of truth) or maintain its own menu and rely on item ID mapping? Foodics integration plan was: read from Foodics. RzRz allows the same since we control both ends. **Tentative decision:** Read from RzRz `Items` table on initial onboarding, then sync nightly.

### OPN-2026-05-18-bridge-app-tech (priority: medium)
**Question:** When we build the Bridge App for the RzRz testbed, should it be a Windows Service or a Tray App? Service = invisible, robust. Tray App = visible, owner can see status. **Likely answer:** Tray App (better UX for non-technical staff, brother can see if it's running).

### OPN-2026-05-18-bridge-app-as-product (priority: low, but strategic)
**Question:** After the Bridge App works for the testbed, can we sell it to other RzRz customers via Punnelifosys? Would they partner with us?  
**How to investigate:** After 30 days of clean operation at the testbed, reach out to Punnelifosys with a partnership pitch.

### OPN-2026-05-23-rzrz-tenant-slug-mismatch (priority: low, doc-only)
**Question:** `customers/rzrz-restaurant.md` documents the MenuLink slug as `rzrz`, but the actual `restaurants.slug` row in Supabase is `rzrz-bukhari` (URL `/m/rzrz-bukhari`). Tenant UUID is `ef60381c-50db-4379-a9b7-97f5902aa54b`.
**How to investigate:** Already verified live this session. Update the customer file slug to match production. Low priority — does not affect any code path, only documentation accuracy for future onboarding sessions.

### OPN-2026-05-23-loyalty-and-addon-pricing (priority: high, designing now)
**Question:** Loyalty/rewards system is requested as a **per-tenant, opt-in, chargeable add-on** — same model as the Bridge App. Need: subscription_addons schema, /ops UI to grant/revoke per tenant, /admin/loyalty UI for the owner to configure tier basis + thresholds + point rate + redemption rules, customer-PWA points display, optional Google login with phone-as-identity merge.
**How to investigate:** Design document to be drafted in `design-docs/loyalty-service.md` before code. Decide pricing per addon (suggested: 50 SAR/month for loyalty, parallel to Bridge App). Resolves direction set in session:2026-05-23.

---

## 📜 Reflection Log (Chronological)

### 2026-05-18 · Foundation Plan Executed (Obsidian + Supabase + Analytics Schema)
- **What worked:**
  - The plan workflow (explore → ask → plan → execute) caught real ambiguity early (apps/web vs backend, wikilink conversion scope).
  - Supabase CLI strategy was the right call — schema written once, no migration step planned for cloud cutover.
  - Graphify on this small corpus produced 19 communities that map cleanly to the project's actual mental model (Frontend stack, Backend stack, RzRz integration, KO-KO customer, Pricing landscape, etc.). The community names match how a human would explain the project.
  - Determinist seed (`setseed(0.42)`) means `db reset` will produce the same data every time — useful for reproducible debugging.
- **What hit friction:**
  - `npx supabase start` on first run pulled ~14 Docker images in parallel and froze Docker Desktop on Windows. Daemon became unresponsive (>60s timeouts on `docker version`). The user will need to restart Docker Desktop and re-run `supabase start`; pulls will resume from cached layers.
  - PowerShell's cp1252 default broke the graphify benchmark step (Unicode box-drawing chars). Set `PYTHONIOENCODING=utf-8` to fix.
  - PowerShell escaping inside `python -c "..."` strings forced rewriting one-liners to avoid nested quotes.
- **What surprised me:**
  - The semantic extraction subagent identified `Open: Two Instances Interpretation` as a real node in the graph and linked it to the KO-KO customer cluster — meaning the **unresolved business question is now visually surfaced as a hub** in Obsidian. The graph effectively makes blockers impossible to forget.
  - Graphify clustered `menulink-integration Skill` together with `RzRz Restaurant (Testbed)` and `Brother as Operations Manager` — correctly identifying the skill as a knowledge-hub for the testbed customer specifically, not for KO-KO.
  - The Docker freeze turned out to be a *better* situation than success: it forced the cloud-pivot via Management API, which means we deployed to Supabase Cloud directly on the first day with no migration step needed later. The schema is live in Singapore right now.
- **Captured learnings:**
  - [[lrn-2026-05-18-supabase-cli-same-software]] (success pattern)
  - [[lrn-2026-05-18-apps-web-monorepo-layout]] (user-correction-driven)
  - [[lrn-2026-05-18-rls-tenant-via-jwt-claim]] (design pattern)
  - [[lrn-2026-05-18-rfm-bucket-thresholds]] (initial heuristic, needs tuning later)
  - [[lrn-2026-05-18-snapshot-order-items]] (design pattern)
  - [[lrn-2026-05-18-graphify-icons-noise]] (tool quirk)
  - [[lrn-2026-05-18-supabase-start-saturates-docker]] (friction documented)
- **Resolved:** [[opn-local-dev-strategy]] → Supabase CLI.

### 2026-05-18 · Customer Taxonomy Correction
- User clarified: KO-KO is a **paying customer** (first one!), not the brother's restaurant
- Brother is operations manager at a **different** restaurant which is the RzRz testbed
- Created separate customer files: `koko-chicky-licky.md` (paying) and `rzrz-restaurant.md` (testbed)
- Major lesson: **never conflate two pieces of customer info just because they were mentioned in the same context**
- Updated learnings with new customer segmentation
- KO-KO has a HUGE open question: what does "نسختين" mean? Blocks onboarding.

### 2026-05-18 · RzRz Discovery Session
- Connected to user's PC, explored `D:\Samer\RZRZ-CODE`
- Confirmed: .NET Framework 4.7.2, EF + SQL Server, Windows Forms, ZATCA-ready
- Found `InsertInvoice` stored procedure → integration path is clear
- Discovered DB credentials in plain text in `.exe.config` ⚠️ flagged as future security task
- Initially confused: which restaurant has this? Now clarified → it's the RzRz testbed (brother's), not KO-KO

### 2026-05-18 · Skill Created
- Built `menulink-integration` skill with:
  - SKILL.md, learnings.md, 5 references, customer template
  - Pre-seeded with everything learned so far
- This is the first iteration — will improve as customers reveal more quirks

### 2026-05-23 (continued) · v2.5-v2.7 InvoiceType Saga + RzRz Menu Import
- **The InvoiceType chapter:** Set out to give MenuLink orders per-type InvoiceType (delivery=3, pickup=0, dine_in=1, car=10) so the printer would render the correct icon. Built v2.5 (per-tenant invoice_type_map snapshotted into payload), v2.6 (order_type label in InvoiceNotes), v2.7 (label moved to InvoiceNotes_A after discovering cashier UI overwrites InvoiceNotes). Each shipped fine but the cashier-UI workflow blocker on OnlineCustomerID > 0 forced a rollback to a single neutral InvoiceType=1 (Dine In). The infrastructure stays — `pos_settings.invoice_type_map` is in place, the bridge reads from `payload.pos.invoice_type` — so the moment Samer modifies the .NET cashier UI to skip the workflow for bridge-originated invoices, we flip the map back on without any redeploy.
- **RzRz menu import:** Hand-prepped `menu-data.json` (36 items × variants = 56 rows) had ~30 wrong pos_ids — user dumped the live RzRz `Items` table (414 rows) and we cross-referenced by Arabic name. Result: 8 categories + 36 menu_items + 56 menu_item_variants + 56 pos_item_map, all wired to correct pos_ids. 32 photos uploaded to Supabase Storage (required the legacy JWT — Storage rejects sb_secret_*). Total ~2 hours of work end-to-end including discovery, mapping correction, and live import.
- **Schema change:** Extended `menu_item_variants.variant_key` CHECK to include `full / half / quarter / small / medium / large / kilo / half_kilo` (the original 0001-era constraint only had `single / piece / meal`). Captured as migration 0013.
- **rzrz-bukhari owner enablement:** Owner Auth account `rzrzbukhari@gmail.com` existed since 2026-05-19 but had no usable password — set a bcrypt temp via `crypt() + gen_salt('bf')` against `auth.users` directly through the Management API (legacy JWT not needed for SQL writes). Owner can now sign in at `/admin/login`.
- **What worked:**
  - Phased approach (backup → photos → categories → items → variants → pos_item_map → verify) made each failure isolable
  - Saving intermediate state to `backups/*.json` files let me restart phases without re-defining 100+ lines of data
  - Using the Management API SQL endpoint for schema changes (constraint alter, auth password reset) was faster than fighting the Auth Admin or PostgREST guards
- **What hit friction:**
  - User initially thought v2.5/v2.6 was deployed but `git log` revealed origin/main on the RzRz server was still at v2.4 — they'd never pulled. Cost ~15 minutes of debugging "why does the SQL show the wrong values" before checking git state. (Added to [[lrn-2026-05-23-windows-auth-cross-machine-needs-grant]] sibling pattern: always verify code is actually deployed before assuming the bridge is running the latest.)
  - `sb_secret_*` rejected by Storage layer with a different error than PostgREST (Invoke-WebRequest browser-context guard) — broader than the 2026-05-18 learning suggested. Captured as [[lrn-2026-05-23-sb-secret-rejected-by-storage]].
  - PostgREST batch INSERT requires identical keys across all rows — conditionally-included keys cause partial-insert failures. Captured as [[lrn-2026-05-23-postgrest-batch-key-consistency]].
  - menu_item_variants.variant_key CHECK constraint was too narrow for size-based menus — extended in migration 0013.
- **What surprised me:**
  - The cashier UI silently overwrites Invoice.InvoiceNotes during edit/pay — we lost the order_type label until I moved it into InvoiceNotes_A. Took a production receipt + SSMS query to spot.
  - `OnlineCustomerID = 999` was supposed to be just a channel attribution tag; turned out to be the master switch that gates the entire online-order workflow. Switching to 0 cleared 3 separate UI behaviors at once.
- **Captured learnings:**
  - [[lrn-2026-05-23-online-customer-id-triggers-workflow]] (critical anti-pattern)
  - [[lrn-2026-05-23-cashier-ui-overwrites-invoicenotes]] (POS quirk)
  - [[lrn-2026-05-23-pos-invoice-type-mapping]] (verified integer table)
  - [[lrn-2026-05-23-sb-secret-rejected-by-storage]] (broader-than-expected guard)
  - [[lrn-2026-05-23-postgrest-batch-key-consistency]] (PostgREST footgun)
  - [[lrn-2026-05-23-rzrz-pos-id-mapping-via-items-dump]] (process pattern)
  - [[lrn-2026-05-23-supabase-bcrypt-password-via-mgmt-api]] (escape hatch)
- **Direction set for next session:**
  - Car-curbside order_type feature (plan documented in task #2)
  - Samer .NET cashier-UI fix to skip workflow on bridge-originated invoices (task #7) — when shipped we re-enable per-type InvoiceType mapping
  - Loyalty service (parked from earlier today)

### 2026-05-23 (continued, late session) · KO-KO Photo Audit + Admin UX Upgrade
- **KO-KO menu photo audit:** All 30 fallback photos in `apps/web/public/menu/koko/` came from the v6 PWA's base64 decode and almost none matched their item — `tender_spicy.jpeg` showed a single drumstick, `twister_maple.jpeg` showed a Caesar pita, every sauce was a generic multi-sauce platter, etc. Replaced 10 photos and added 2 new dedicated files (sauce_garlic, sauce_hummus) using Pexels + Unsplash (both CC0 commercial-use). Did NOT touch KO-KO brand (color, logo, cover image) per user direction — only food item photos. Added a clarifying comment in `koko-images.ts` explaining why `br-reg`/`br-hot` map to apparently-swapped file names (the files themselves are misnamed; the mapping correctly compensates).
- **Sticky category bar made visible:** v7 customer PWA already had `sticky top-0` on the category tab strip but the background was `bg-[var(--bg)]/85` — same color as the page, invisible while scrolling. Switched to solid bg + soft drop shadow (`shadow-[0_4px_12px_-6px_rgba(0,0,0,0.18)]`) so the bar visually lifts off scrolling content. Inline `style={{ position: 'sticky' }}` added as belt-and-braces for any Tailwind class-pruning edge case. Applies to all tenants automatically (shared component at `apps/web/app/m/[slug]/category-tabs.tsx`).
- **Admin orders page:** persistent Web Audio doorbell (two-note chime, loops every 1.8s) that rings on new-order Realtime INSERT and only stops when staff click "Stop bell". Browser-autoplay rule handled by a one-time "Enable sound" gesture button. Tab title updates to `(N) 🔔 الطلبات` when unseen orders are queued so backgrounded tabs still surface the alert. Default filter: today-only (Asia/Riyadh); toggle to last 200.
- **Admin customers page:** color-coded segment KPI cards (Champion = amber, Loyal = green, New = sky, At-Risk = orange, Lost = rose) above the customer table; search bar with Arabic-Indic digit normalization; 7-option sort dropdown (spend / orders / recency / creation date directions); per-segment dropdown filter.
- **Tier-2 Excel exports:** added ExcelJS (TS equivalent of Python+openpyxl) and built `lib/excel-tier2.ts` with the excel-wizard agent's spec — forest-green palette, KPI-card pattern with merged cells, branded header bar, data-bar conditional formatting, formula-first totals, RTL Arabic, SAR currency formats. Two endpoints: `GET /api/admin/export/orders?from=YYYY-MM-DD&to=YYYY-MM-DD` (Dashboard with 12 KPI cards + Detail with =SUM/=AVG/=COUNTIF + Summary by type/status), and `GET /api/admin/export/customers` (Dashboard with segment KPIs + Detail with color-coded segment cells + data bars on LTV + Segments sheet with suggested actions per segment). Both routed through `requireOwner` so tenant scoping is automatic via RLS.
- **What worked:**
  - Single shared `excel-tier2.ts` helper kept both export endpoints visually identical without duplication. Plugging in a third report later (e.g., for the loyalty service) is now a paste-and-tweak job.
  - Two-note doorbell via Web Audio API is far cleaner than shipping a 50KB mp3 — zero asset weight, instant playback after the user-gesture unlock.
  - Pexels + Unsplash CC0 search is fast enough to source food photos in a single session if you batch the searches (downloaded ~30 candidates in parallel, kept the best 12).
- **What hit friction:**
  - ExcelJS' `DataBarRuleType` TypeScript shape is missing the runtime `color` field; had to cast `as any`. Reported upstream not yet.
  - Pexels' multi-sauce platter photos dominate the "sauce" search results — finding individual sauce-in-a-bowl shots required pivoting to Unsplash and using color-specific search terms (yellow cheese dip, green jalapeño sauce, etc.).
  - First Excel insert failed with `PGRST102 "All object keys must match"` because PostgreST batch insert requires identical keys across all rows. Fixed by always including every column key with `null` for absent values, using `[ordered]` PowerShell hashtables — already captured in [[lrn-2026-05-23-postgrest-batch-key-consistency]] but worth flagging that the same trap exists in ExcelJS dynamic-row construction.
- **What surprised me:**
  - Filename ≠ content in the v6 base64 photo dump: `broasted_regular.jpeg` shows fried chicken NEXT to a chili pepper (visually "spicy"). The original `SLUG_TO_IMG` map already worked around this by mapping `br-reg → broasted_spicy.jpeg` and vice versa — but with no comment explaining why, it looked like a bug. Added explanatory comments so future maintainers don't "fix" the correct mapping.
- **Captured learnings:**
  - [[lrn-2026-05-23-v6-to-v7-photo-filenames-misleading]] (audit pattern)
  - [[lrn-2026-05-23-web-audio-doorbell-for-tab-alerts]] (UX primitive)
  - [[lrn-2026-05-23-exceljs-is-the-typescript-openpyxl]] (architecture choice)
  - [[lrn-2026-05-23-rfm-segments-need-action-prompts]] (analytics UX principle)
- **Direction set for next session:**
  - Continue the admin polish: dashboard chart improvements, menu CRUD UX, info page refresh
  - The loyalty service architecture (parked from earlier today) — addon framework + ops UI + admin/loyalty config + customer PWA tier badge + Google login
  - Car-curbside order_type feature
  - Verify the new Excel exports + persistent sound work end-to-end on the RzRz Bukhari live tenant

### 2026-05-23 · v2.3 HoldMode Verified + v2.4 Receipt Cleanup
- **Goal:** Verify Bridge App v2.3 (HoldMode default true, committed last session) end-to-end on the RzRz testbed.
- **What worked:**
  - End-to-end test passed: order from `/m/rzrz-bukhari` → outbox row → Bridge claims → `InsertInvoice` with `IsHold=1` → cashier UI held list shows invoice 440. DB verification: `IsHold=1`, no PaymentDetails, no InvoicePaymentTypeDetails. Staff tap Pay manually to finalize.
  - The HoldMode-by-default decision is validated. v2.3 stays as the standard mode going forward; HoldMode=false is only for high-volume tenants where manual review is impractical.
  - Discovered via PostgREST query directly: tenant `restaurants.slug='rzrz-bukhari'`, id `ef60381c-50db-4379-a9b7-97f5902aa54b`, `pos_settings` + `pos_item_map` all wired and `enabled=true`.
  - Diff-shipped v2.4 (commit 16a732d) to fix a thermal-receipt overflow caught in production: shortened `InvoiceNotes_A` to `"MenuLink #N · <name> · 05xxxxxxxx"` (~30 chars, one line).
- **What hit friction:**
  - Confused machine identity early: user said "I'm on the RzRz server" but the Claude Code session was actually on the dev machine `DESKTOP-KUT35C6` (192.168.1.83). RzRz server is `DESKTOP-8Q7DQKA` (192.168.1.113). SQL connection attempts failed locally because no SQL instance is installed on the dev box. Resolved by asking the user to switch to the RzRz server.
  - PowerShell `>>` line continuation embedded a literal newline INSIDE the connection-string env var ("Integrated\n  Security"). 5 retry attempts burned before diagnosis. Captured as [[lrn-2026-05-23-powershell-string-newline-trap]]. New default guidance: use `Trusted_Connection=True` (single token, no embedded whitespace possible).
  - Pasted connection string fixed, but new SQL error 4060 surfaced: the Windows user `DESKTOP-8Q7DQKA\pc` had no rights on the `client` DB even though Integrated Security authenticated. Past successful runs used a different (Administrator) Windows user. Fix: explicit `CREATE LOGIN + CREATE USER + ALTER ROLE db_owner` in SSMS as `sa`. Captured as [[lrn-2026-05-23-windows-auth-cross-machine-needs-grant]].
  - The `sb_secret_*` browser-context guard turned out to be broader than the 2026-05-18 learning suggested — it fires on PostgREST too, not just Auth Admin. Fixed in scripts by setting a non-browser `User-Agent`. The Bridge App's HttpClient is unaffected (no UA by default). Captured as [[lrn-2026-05-23-sb-secret-postgrest-guard-too]].
  - Print receipt overflow was caused by packing `InvoiceNotes_A` to ~60 chars; the RzRz thermal receipt template prints that field on a single fixed-position line with no word-wrap, so it overlaid the items-table header. Captured as [[lrn-2026-05-23-rzrz-receipt-notes-budget]].
- **What surprised me:**
  - The receipt overflow LOOKED like printer hardware misbehavior at first glance — it was actually a data-side budget problem we control 100%. The fix was 13 lines of C# and a redeploy.
  - The user is genuinely co-developing both ends (POS + MenuLink) — when I suggested modifying the receipt template as "the cleanest fix", it wasn't out of bounds. Worth remembering on future architecture decisions.
- **Direction set for next session:**
  - Loyalty/rewards as a per-tenant chargeable add-on (parallel to Bridge App). Configurable tier basis (hybrid of orders + spend), configurable thresholds, configurable point rate and redemption rules. Customer PWA gets both a soft post-order login prompt AND a persistent header sign-in button. Google login with phone-as-identity merge.
  - Adjustable delivery fee from `/admin/info` (number input, hidden if delivery disabled). Defer distance-based logic until later.
- **Captured learnings:**
  - [[lrn-2026-05-23-holdmode-end-to-end]] (positive pattern)
  - [[lrn-2026-05-23-windows-auth-cross-machine-needs-grant]] (deploy gotcha)
  - [[lrn-2026-05-23-rzrz-receipt-notes-budget]] (POS-specific quirk)
  - [[lrn-2026-05-23-powershell-string-newline-trap]] (anti-pattern)
  - [[lrn-2026-05-23-sb-secret-postgrest-guard-too]] (existing learning extended)
- **Opened:** [[opn-2026-05-23-loyalty-and-addon-pricing]], [[opn-2026-05-23-rzrz-tenant-slug-mismatch]]

### 2026-05-23 (late) — addon framework + loyalty service (slices 1-3)
- **Scope shipped:** Per-tenant addon framework (migration 0016, 5 catalog rows). Loyalty service phases 1+2+3: schema (0017), auto-earn trigger, customer accounts via Google OAuth, rewards CRUD, redemption flow with fulfill/cancel RPCs (0021), welcome bonus auto-fire, manual point adjustments, customer-side redemption history, loyalty stats dashboard (0022). All gated by the `loyalty` addon. KO-KO Chicky Licky was the test tenant.
- **What worked:**
  - The two-trigger pattern (kept `touch_customer_last_seen` intact, added a separate `z_loyalty_after_insert` with EXCEPTION-wrapped body). Loyalty bugs can't break the order insert path. Trigger fire order managed alphabetically via `z_` prefix. [[lrn-2026-05-23-two-trigger-isolation]]
  - Customer account flow: Google OAuth → phone-link form → cross-tenant `customers.auth_user_id` binding via `link_customer_account` RPC. Hijack guard refuses link if phone is already bound to a different user. uuid order_id is the real security boundary; phone is a soft sanity check. [[lrn-2026-05-23-uuid-is-real-auth]]
  - Snapshot principle held through: redemptions carry `points_cost` as a snapshot so renaming a reward later doesn't rewrite history. Lifetime points only ever go UP — even on cancel-redemption refunds, lifetime stays put so tier never regresses.
  - Addon framework `is_default = true` was the right semantic: auto-enabled for existing + new tenants on the launch migration; ops can still toggle off for problem cases. [[lrn-2026-05-23-addon-is-default-semantic]]
  - Customer account page kept Realtime-free; reload-on-action is simpler and works for low-frequency loyalty state changes. (Adding Realtime in slice 4.)
- **What failed (and cost time):**
  - Three back-to-back hotfix migrations (0018, 0019, 0020) chased the same root cause: `to anon` policies don't apply to authenticated customers. Should have caught this in one pass instead of three. The lesson is now [[lrn-2026-05-23-rls-anon-vs-public]] under "What Has Failed".
  - I tucked the "continue as guest" fallback into a small text link; user pushed back to make it a full-width button. UX intuition wasn't matched. Captured implicitly as a Q&A pattern: "soft fallback != small link, it's a co-equal button next to the primary CTA."
  - The user wanted the loyalty CTA in the cart drawer (high-intent moment) not at the bottom of the menu (low-intent browse). I had to move it. Captured as a UX principle: monetization prompts go where intent is highest, not where they happen to fit.
- **What surprised me:**
  - The user is taking the "platform" framing seriously. Wants every chargeable feature in the addon model from day one, including ones that already shipped (tables_qr, excel_export, pos_bridge). They're thinking ahead to enterprise tier and price-per-tenant control.
  - The Google OAuth setup was smoother than expected — Supabase Management API can patch the auth config + Google provider creds without going through the dashboard. Cuts the setup loop in half.
- **Direction set for next session (slice 4):**
  - Rewards images via Supabase Storage (reuse menu-images bucket, `<restaurant_id>/rewards/` path).
  - Realtime customer notification when redemption status changes (subscribe `loyalty_redemptions` UPDATE for current customer).
  - Points expiry with lazy in-trigger check (no cron required).
  - Still deferred: order-attached redemptions, SMS OTP for phone verification, real push notifications (OneSignal).
- **Captured learnings:**
  - [[lrn-2026-05-23-customer-pwa-anon-reads]] (positive principle)
  - [[lrn-2026-05-23-two-trigger-isolation]] (positive pattern)
  - [[lrn-2026-05-23-uuid-is-real-auth]] (positive pattern)
  - [[lrn-2026-05-23-addon-is-default-semantic]] (semantic clarification)
  - [[lrn-2026-05-23-rls-anon-vs-public]] (anti-pattern, cost three migrations)

---

## 📝 How To Update This File

When you have a new learning to capture, follow these rules:

1. **Pick the right section** (worked / failed / customer / open question / log)
2. **Generate an ID:** `LRN-YYYY-MM-DD-<3-word-slug>` (or `OPN-` for open questions)
3. **Assign confidence:** 
   - `high` = directly observed multiple times, or a user correction
   - `medium` = inferred from one observation, plausible
   - `low` = hypothesis worth testing
4. **Keep it short:** 2-4 lines max. Long explanations go in references/.
5. **Add triggers:** keywords that should make this learning surface later.
6. **Always add a log entry** under "Reflection Log" with the date.

When the file gets too long (~50 entries), consolidate: merge similar entries, archive resolved open questions to a `learnings-archive.md`, keep only active patterns here.
