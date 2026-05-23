---
name: tenant-deployment
description: End-to-end deployment of a new MenuLink tenant from zero to live. Use this skill whenever onboarding a new restaurant client, setting up a new tenant, running the go-live checklist, or when the user mentions "new client", "new restaurant", "onboard", "deploy tenant", "go live", or any of the steps involved (owner account, subscription, QR codes, table setup, loyalty config). This skill produces a tracked checklist that ensures nothing is missed across the multi-step deployment. Also use when resuming a partially-completed tenant setup from a previous session.
---

# Tenant Deployment Skill

Deploy a new MenuLink tenant from zero to live in one session. This is the master checklist that orchestrates the other skills (menu-onboarding, nutrition-audit) and ensures every step is completed before the restaurant goes public.

---

## Before You Start

1. **Read `menulink-integration/learnings.md`** — the integration skill holds cross-cutting gotchas
2. **Read `menulink-integration/customers/<slug>.md`** if the customer file already exists
3. **Gather minimum info** from the user:
   - Restaurant name (Arabic)
   - Slug (Latin, lowercase, 3-32 chars)
   - Owner email
   - WhatsApp number
   - City + address
   - Plan: monthly (59 SAR) or yearly (499 SAR)
   - Payment amount received (or "pending")
   - POS type: none / RzRz / Foodics / other
   - Number of tables (if dine-in)

---

## The Deployment Pipeline

### Phase 1: Tenant Creation (Ops)

**Action:** `/ops/tenants/new` wizard OR Management API SQL

Steps:
1. Create the restaurant row (slug, name, whatsapp, city, address)
2. Create the owner Auth user (email + generated password)
3. Link owner via `restaurant_owners`
4. Create subscription (plan, amount, status=pending_payment unless already paid)
5. Auto-seed default addons (tables_qr + excel_export via is_default=true)

**Verify:**
- [ ] Restaurant appears in `/ops` tenant list
- [ ] Owner can sign in at `/admin/login` with generated credentials
- [ ] Subscription banner shows correct status

**Hand to owner:** Share credentials via WhatsApp (not email — Saudi operators prefer WhatsApp). Tell them to change password after first login.

### Phase 2: Design (Ops)

**Action:** `/ops/tenants/[id]` design panel

Steps:
1. Get logo from owner (PNG/JPG, ideally square, transparent background)
2. Get cover photo (wide landscape, food/restaurant interior)
3. Upload both via the design panel
4. Set primary color (ask owner or extract from logo)
5. Set background color (default #fff8f6 works for most)
6. Set slug if not already final

**Verify:**
- [ ] `/m/<slug>` shows correct logo, cover, and brand colors
- [ ] Name renders correctly in Arabic on the hero

### Phase 3: Menu Import

**Delegate to:** `menu-onboarding` skill

This is the biggest phase. Follow the menu-onboarding pipeline:
1. Receive menu from owner (photos, PDF, WhatsApp list, or verbal)
2. Parse into categories + items + variants
3. Estimate calories (SFDA)
4. Assign allergens
5. Upload photos
6. Insert to DB
7. Verify on customer PWA

**Verify:**
- [ ] All categories visible in correct order
- [ ] All items with correct prices
- [ ] Photos load
- [ ] Calorie badges render
- [ ] Allergen text shows

### Phase 4: Nutrition Audit

**Delegate to:** `nutrition-audit` skill

Run the compliance check to catch any gaps from the menu import.

### Phase 5: QR Codes

**Action:** `/admin/qr` (owner can self-serve) or `/ops/tenants/[id]` QR section

Steps:
1. Generate menu-wide QR poster
2. Download and share with owner for printing

If the restaurant has dine-in tables:
1. Enable the `tables_qr` addon (already default-on)
2. Owner adds tables via `/admin/tables`
3. Download per-table QR posters
4. Owner prints and places on tables

**Verify:**
- [ ] Scanning the QR opens the correct `/m/<slug>` URL
- [ ] Table QRs lock to dine-in with correct table label

### Phase 6: Addon Configuration (Ops)

**Action:** `/ops/tenants/[id]` services section

Review which addons to enable for this tenant:

| Addon | Default | Enable if... |
|-------|---------|-------------|
| tables_qr | ON | Restaurant has physical tables |
| excel_export | ON | Always (base feature) |
| pos_bridge | OFF | Tenant has POS + requests integration |
| loyalty | OFF | Tenant wants loyalty program (49 SAR addon) |
| push_marketing | OFF | Tenant wants push notifications (29 SAR addon) |

If enabling loyalty:
1. Toggle loyalty addon ON
2. Create loyalty_settings (defaults are fine for start)
3. Owner configures earn rate + tier thresholds from `/admin/loyalty`

If enabling POS bridge:
1. Toggle addon ON
2. Create pos_settings row (pos_kind, branch_id, etc.)
3. Follow `menulink-integration` skill for POS setup

### Phase 7: Go-Live

**Action:** Toggle `is_published = true` from `/ops/tenants/[id]` actions

Pre-flight checklist:
- [ ] Menu complete and verified
- [ ] Nutrition data SFDA-compliant (run nutrition-audit)
- [ ] Logo + cover uploaded
- [ ] Brand colors set
- [ ] WhatsApp number verified (send a test message to it)
- [ ] Owner has logged in at least once
- [ ] Owner knows how to check orders at `/admin/orders`
- [ ] Owner has enabled sound notifications
- [ ] QR poster downloaded and ready to print
- [ ] All enabled addons configured
- [ ] Subscription status is active (or pending_payment with grace)

**The toggle:** From ops tenant detail page, click "Publish". Customer PWA becomes accessible.

**Post-launch:**
- [ ] Place a test order via the customer PWA
- [ ] Verify it appears in `/admin/orders` with bell
- [ ] Verify WhatsApp message opens correctly
- [ ] If POS: verify order syncs to cashier

### Phase 8: Documentation

1. Create or update `menulink-integration/customers/<slug>.md` from the template
2. Record: restaurant info, POS type, integration tier, any quirks discovered
3. If new learnings: append to `menulink-integration/learnings.md`

---

## Master Checklist Template

Copy this for each deployment:

```
# Tenant Deployment: [Name] ([slug])
Date: YYYY-MM-DD

## Phase 1: Creation
- [ ] Restaurant row created
- [ ] Owner account created (email: ___)
- [ ] Credentials shared via WhatsApp
- [ ] Subscription created (plan: ___, amount: ___)

## Phase 2: Design
- [ ] Logo uploaded
- [ ] Cover photo uploaded
- [ ] Brand colors set (primary: #___)

## Phase 3: Menu
- [ ] Menu received (format: ___)
- [ ] Categories: ___ | Items: ___ | Variants: ___
- [ ] Photos uploaded: ___/___
- [ ] Calories set for all items
- [ ] Allergens tagged

## Phase 4: Nutrition Audit
- [ ] Audit passed (score: ___%)

## Phase 5: QR
- [ ] Menu QR generated
- [ ] Table QRs generated (if applicable): ___ tables

## Phase 6: Addons
- [ ] tables_qr: ___
- [ ] excel_export: ___
- [ ] pos_bridge: ___
- [ ] loyalty: ___

## Phase 7: Go-Live
- [ ] is_published = true
- [ ] Test order placed and verified
- [ ] WhatsApp flow confirmed
- [ ] Owner trained on /admin

## Phase 8: Documentation
- [ ] Customer file created/updated
- [ ] Learnings captured (if any)
```

---

## Timing Estimate

| Phase | Typical duration |
|-------|-----------------|
| Creation | 10 min |
| Design | 15 min (waiting for assets from owner) |
| Menu Import | 1-3 hours (depends on menu size) |
| Nutrition | 15 min |
| QR | 5 min |
| Addons | 5 min |
| Go-Live | 10 min |
| Documentation | 10 min |
| **Total** | **2-4 hours** |
