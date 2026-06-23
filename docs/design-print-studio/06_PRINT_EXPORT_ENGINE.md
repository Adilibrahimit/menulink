# Print Export Engine · PDF, PNG, SVG

## Purpose

The Print Export Engine generates print-ready outputs from the same MenuLink data used by the digital menu.

It must avoid manual re-design after price changes.

## Output types

| Output | Description |
|---|---|
| Full Menu A3 | Complete menu for wall/table display |
| Full Menu A4 | Smaller printable menu |
| Single Category | One category only |
| Single Item Card | One product card |
| Offer Card | Promotion PDF/PNG |
| QR Poster | QR with identity design |
| Table Tent | Foldable table QR |

## Recommended architecture

Use dedicated print preview routes:

```text
/admin/print
/admin/print/full-menu/a3
/admin/print/full-menu/a4
/admin/print/category/[id]
/admin/print/item/[id]
/admin/print/offer/[id]
/admin/print/qr/[profileId]
```

Then use a server-side export action to render PDF/PNG.

## Why HTML/CSS first

Use HTML/CSS print pages as the first rendering path.

Benefits:

- Reuses React components.
- Easier visual QA.
- Easy browser preview.
- Easier RTL debugging.
- Easier A3/A4 layout testing.
- Compatible with Puppeteer PDF rendering.

## Export engine flow

```text
Operator clicks Generate
   ↓
Load restaurant + menu + template + design tokens
   ↓
Compute data_hash
   ↓
If unchanged, return existing export unless forced
   ↓
Open print route in headless renderer
   ↓
Generate PDF or PNG
   ↓
Upload to storage
   ↓
Save export row
   ↓
Show download link
```

## Data hash inputs

For full menu:

- Restaurant identity
- Logo URL
- Cover URL
- Contact info
- Branch info
- Categories
- Menu items
- Item variants
- Prices
- Images
- Calories
- Allergens
- Active promotions included in print
- Print template key
- Design tokens
- Paper size
- Orientation

## Print CSS requirements

- Use `@page`.
- Use exact page size.
- Use print-safe margins.
- Use `print-color-adjust: exact`.
- Use `-webkit-print-color-adjust: exact`.
- Avoid external unstable images.
- Make images deterministic.
- Use Arabic RTL carefully.
- Do not rely on hover states.
- Avoid sticky UI in print pages.

## Example CSS baseline

```css
@page {
  size: A4 portrait;
  margin: 8mm;
}

html {
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

body {
  direction: rtl;
  background: #ffffff;
}
```

## Storage paths

Recommended:

```text
exports/{restaurant_id}/print/{export_id}.pdf
exports/{restaurant_id}/print/{export_id}.png
exports/{restaurant_id}/qr/{export_id}.svg
exports/{restaurant_id}/qr/{export_id}.png
```

## Export statuses

```text
queued
rendered
failed
outdated
```

## Outdated detection

When source data changes:

- Menu item price
- Menu item image
- Menu item name
- Category name
- Promotion
- Logo
- Cover
- Template tokens
- Contact info

Then the generated export hash should differ.

UI should show:

```text
هذا الملف قديم بسبب تغييرات في المنيو أو التصميم. أعد التوليد.
```

## Compliance blocks

Every full menu print template should support:

- VAT notice
- Calories
- Allergens
- QR code
- Contact info
- Last updated date
- Daily calorie guidance block
- Source note if required

## Phase guidance

Do not implement PDF generation in DS-1.

Implement schema and seeds first.

PDF starts in DS-4 after:

- Templates exist
- Design profile exists
- QR templates exist
- Customer PWA template resolution is stable
