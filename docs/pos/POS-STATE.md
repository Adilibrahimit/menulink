# POS State — RzRz / Punnelifosys (optional layer)

> Split out of root `memory.md` (Phase 3b). This is the canonical **current POS state** for the
> optional POS layer. MenuLink Core works without any of this. For Core state see `/memory.md`.
> Credential values are redacted to placeholders — see [`../security/credential-rotation-plan.md`](../security/credential-rotation-plan.md).

## 🔧 Parallel workstream — Samer's POS (Punnelifosys ResApp / RZRZ)

Separate from the MenuLink SaaS platform: we co-develop **Samer's RZRZ POS** (the .NET WinForms POS
behind the RzRz tenants). As of **2026-06-07** it's fully decompiled, graphed, **schema-verified**
against the live DB, and its runtime flows (sale / delivery / dine-in) are **trace-captured**. Four
skills cover it (`punnelifosys-pos`, `punnelifosys-feature-dev`, `punnelifosys-pos-operate`, enriched
`menulink-integration`). Note: the `punnelifosys-*` skill trees are gitignored (local-only — they
carry dev creds; see the rotation plan).

➡️ **Full handoff: `D:\Samer\research-output\SAMER-POS-HANDOFF.md`** (skills, verified facts, live env
`DESKTOP-KUT35C6` / DB `client` / admin·`<POS_PIN>`, the InsertInvoice + InsertPaymentDetails
contracts, the input-injection constraint, and the ranked next-task list — top candidate = **full
MenuLink integration**). Also in auto-memory `samer-pos-decompile-skills-graph.md`. Mandate: **extend
the app + full MenuLink integration**, NOT a rewrite.

### ✅ Shipped feature — Digital Invoice → WhatsApp (2026-06-08)
First feature built INTO the POS. Cashier picks a **Payment Action** on `frmPayment` (سداد وطباعة /
**سداد وإرسال** / سداد وطباعة + إرسال); send modes render the **Arabic** invoice as a PNG (+QR), copy
it to the clipboard, open **WhatsApp Desktop** (`whatsapp://`) with a full itemized RTL caption, and
the touch cashier **long-presses → Paste → Send** (no keyboard). Added a **duplicate-payment guard**
and **print/send/both tracking** (`dbo.DigitalInvoiceLog` + view `dbo.vw_DigitalInvoiceModeCounts`).
Built with **no Visual Studio + no dnSpy** — a greenfield helper DLL
(`PunnelifosysResApp.DigitalInvoice.dll`) + a reusable **scripted `dnlib` patcher** that edits
`frmPayment.btnSave_Click` in-place. Tooling/source at `C:\RZRZ-CODE\Branch-RES\DigitalInvoiceHelper\`.
**Live-tested on the laptop clone**, flag `EnableDigitalInvoiceSend=1`; backups + manifest at
`_backup_pre-digital-invoice_*`. Full detail + gotchas: auto-memory [[digital-invoice-whatsapp-1b]] +
`learnings.md` (LRN-2026-06-07/08). The **background** (zero-touch) successor is tracked in
[`digital-invoice-background/STATUS.md`](digital-invoice-background/STATUS.md). **Remaining =
production rollout to the real tills.**

## 🔌 RzRz POS Integration — Phase 1 Results (2026-05-20)

**Restaurant:** RZRZ BUKHARI / رزرز بخاري · Company: Itaqn w Jowdah (إتقان وجودة) · 2 branches (Alazizah, Almalaz).

**Strategic context:** the user is Samer Cefalu's BUSINESS PARTNER in the POS software venture (Punnelifosys ResApp / RzRz POS). Schema changes + proc modifications are on the table. Co-branded "RzRz POS + MenuLink" rollout to all Punnelifosys customers is the endgame, achievable in months not years.

**Almalaz branch infra:**
- Server: `DESKTOP-8Q7DQKA` (LAN `PUNNELIFOSYS`), LAN IP `192.168.1.113`
- SQL Server 2022 Express, **DB name `client`** (not `samer910_Cefalu` — that was a stale config). Integrated Security + `<LOCAL_SQL_USER>` both available.
- Accounting DB: `samer910_accreef` (local + synced to central `192.250.231.22`)
- Kitchen printers (LAN): KETCHIN `192.168.1.177` (master), BBQ `192.168.1.175`, DESERT `192.168.1.179`, KABULE `192.168.1.181`. **Note typo in DB: printer name is `KETCHIN` not `KITCHEN`** — Windows printer must use the typo.

**What was proven (full chain):**
1. Inserted MenuLink as `OnlineCustomerID = 999, CommissionPercent = 0.00`
2. The new MenuLink row shows up in the cashier UI's Online customer picker alongside HungerStation/Jahez/Keeta
3. Cashier can manually create + pay a MenuLink order — works end to end with kitchen print
4. Direct `EXEC InsertInvoice` from SQL produces identical DB state — same `InvoiceType=11`, same `OnlineCommission=0.00`, same `InvoiceDetails` rows, same `KitichenOrderForPrint` rows
5. Held → Finalize transition works via re-EXEC with same InvoiceID + IsHold=0
6. Kitchen printers fire correctly when the Windows printer name is `KETCHIN` (the typo)
7. Print routing is fully data-driven via `ItemPrinters(ItemID, Printer, InvoiceTypeID)` — the Bridge App doesn't need to implement print routing, just write `InvoiceDetails` + `KitichenOrderForPrint`

**Verified XML structure for InsertInvoice** (see `.claude/skills/menulink-integration/references/sql-patterns.md` for full reference): single self-closing `<Invoice ... />` for header, multiple sibling `<Items ... />` elements (NO outer wrapper) for line items.

**Phase 2 (Bridge App) — in progress:**
- `pos_outbox` + `pos_item_map` tables in Supabase (migration 0009)
- .NET 10 Windows Service running on the cashier (primary) and server (monitor)
- Realtime subscription primary + polling fallback
- Multi-branch deployment via per-branch `appsettings.json`

## Read next (POS)
- [`digital-invoice-background/ARCHITECTURE.md`](digital-invoice-background/ARCHITECTURE.md) → [`STATUS.md`](digital-invoice-background/STATUS.md) → [`GO_LIVE_RUNBOOK.md`](digital-invoice-background/GO_LIVE_RUNBOOK.md)
- [`ai_memory/`](ai_memory/) — RzRz POS knowledge store (DB tables, workflows, safety guardrails)
- `bridge-app/README.md` (.NET Bridge) · `services/whatsapp-invoice-gateway/` (Cloudflare Worker + D1)
- Seam migrations: `apps/web/supabase/migrations/0009_*` (pos_outbox) + `0072_*` (digital_invoice_send_queue)
- `.claude/skills/menulink-integration/learnings.md` — read before any customer/POS work
