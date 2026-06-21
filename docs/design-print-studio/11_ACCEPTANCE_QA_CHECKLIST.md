# Acceptance & QA Checklist · Brand & Print Studio

## Global guardrails

- [ ] Existing `/m/koko` still works.
- [ ] Existing tenant admin still works.
- [ ] Existing platform ops still works.
- [ ] Existing QR page still works.
- [ ] Existing table QR flow still works.
- [ ] No existing tenant data removed.
- [ ] No secrets printed.
- [ ] No unrelated code modified.
- [ ] Build passes.

## DS-1 migration checklist

- [ ] `brand_identity_templates` exists.
- [ ] `menu_page_templates` exists.
- [ ] `print_templates` exists.
- [ ] `qr_design_templates` exists.
- [ ] `restaurant_design_profiles` exists.
- [ ] `restaurant_print_profiles` exists.
- [ ] `restaurant_qr_profiles` exists.
- [ ] `qr_links` exists.
- [ ] `qr_exports` exists.
- [ ] `print_exports` exists.
- [ ] `promotions` exists.
- [ ] `promotion_items` exists.
- [ ] `qr_scan_events` exists.
- [ ] RLS enabled on all new tenant-sensitive tables.
- [ ] Indexes created.
- [ ] One published design profile per tenant rule exists or is planned.
- [ ] Seed script is idempotent.

## Seed checklist

- [ ] KO-KO Bold seeded.
- [ ] RzRz Navy seeded.
- [ ] Velora Premium seeded.
- [ ] Standard Clean seeded.
- [ ] Café Minimal seeded.
- [ ] Fast Food Grid seeded.
- [ ] Premium Lounge Grid seeded.
- [ ] A3 Full Menu seeded.
- [ ] A4 Full Menu seeded.
- [ ] Standard A4 QR seeded.
- [ ] Standard Table Tent QR seeded.
- [ ] KO-KO QR seeded.
- [ ] RzRz QR seeded.
- [ ] Velora QR seeded.

## QR QA

- [ ] Quiet zone preserved.
- [ ] QR code remains high contrast.
- [ ] QR has SVG path support.
- [ ] Logo overlay disabled or small by default.
- [ ] Dynamic QR links use `/q/{code}`.
- [ ] Scan events do not store raw IP by default.
- [ ] QR export records are tenant-scoped.

## Print QA

- [ ] A3 template supports landscape.
- [ ] A4 template supports portrait.
- [ ] VAT notice block is available.
- [ ] Calories block is available.
- [ ] Allergens block is available.
- [ ] QR block is available.
- [ ] Last updated block is available.
- [ ] Arabic RTL is supported.
- [ ] Print color adjustment CSS planned.

## Promotion QA

- [ ] Promotion belongs to one restaurant.
- [ ] Promotion item links are tenant-safe.
- [ ] Expired promotion should not appear.
- [ ] Active promotion can be included in print exports.
- [ ] Promotion can have QR target later.

## Design QA

- [ ] Customer PWA uses tenant brand colors.
- [ ] No hardcoded WhatsApp phone.
- [ ] Arabic-Indic numbers preserved in customer-facing prices.
- [ ] Ops remains dark cockpit.
- [ ] Tenant Admin remains light cockpit.
- [ ] Design follows `DESIGN.md`.

## Proof document checklist

Every phase proof must include:

- [ ] Goal
- [ ] Scope
- [ ] Files changed
- [ ] Commands run
- [ ] Results
- [ ] Screenshots if UI changed
- [ ] Database verification if migration changed
- [ ] Guardrails
- [ ] Known limitations
- [ ] Next phase
