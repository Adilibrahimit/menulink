# QR Design System · MenuLink

## Purpose

QR Design Templates create professional QR outputs that match each restaurant identity while preserving scan reliability.

QR styling must never reduce scannability.

## QR payload versus QR design

| Layer | Meaning |
|---|---|
| QR Payload | The destination: menu, table, offer, category, item |
| QR Design Template | The visual design around the QR code |

Example:

- Payload: `/q/abc123` redirects to `/m/koko?table=5`
- Design: KO-KO Bold Table Tent QR

## QR target types

| Target | Example destination |
|---|---|
| menu | `/m/koko` |
| table | `/m/koko?type=dine_in&table=12` |
| offer | `/m/koko/offers/offer-id` |
| category | `/m/koko#broasted` |
| item | `/m/koko/items/item-id` |

## Dynamic QR links

Use internal short links:

```text
/q/{code}
```

This allows changing destination without reprinting the physical QR.

## Required QR outputs

| Output | Size | Format |
|---|---|---|
| A4 QR Poster | A4 portrait | PDF, PNG |
| A3 QR Poster | A3 portrait or landscape | PDF, PNG |
| Table Tent QR | Custom folded size | PDF |
| QR Sticker | Square | SVG, PNG |
| Offer QR | A5 or square | PDF, PNG |
| Premium QR Card | A5 or square | PDF, PNG |

## Scannability rules

### Mandatory

- Keep a clear quiet zone around the QR code.
- Use high contrast between QR modules and background.
- Keep QR on a plain light surface unless tested.
- Prefer SVG for print.
- QR must be large enough for intended scanning distance.
- Any logo overlay must be small and centered.
- Use high error correction if logo overlay is enabled.
- Test scan on at least three devices before approving a template.

### Banned

- Cropping the quiet zone.
- Placing the QR directly on textured food photos.
- Using low contrast gold-on-black as the actual QR modules.
- Heavy shadows crossing the QR.
- Large logos covering finder patterns.
- Decorative icons inside the QR itself unless scan-tested.
- JPEG-only QR output for print.

## Recommended rendering model

```text
QR link data
   ↓
QR SVG generator
   ↓
Template composition
   ↓
Preview
   ↓
Export PDF/PNG/SVG
   ↓
Scan test
```

## Template examples

### Standard Clean QR

- White background
- Restaurant logo top
- Main text: `امسح المنيو`
- Large QR
- Phone or WhatsApp
- Powered by MenuLink without sparkle icons

### KO-KO Bold QR

- Cream background
- Red accents
- Rooster logo
- QR in white card
- Short CTA
- Designed for fast food

### RzRz Navy QR

- Dark navy header
- White QR card
- Gold CTA
- Branch name
- Table number when applicable

### Velora Premium QR

- Dark premium frame
- Gold border
- Cream QR area
- Minimal text
- Works for restaurant, café, lounge

### Offer QR

- Offer image or product image
- Offer title
- End date if available
- QR opens offer directly

## Required UI fields

In QR tab:

- Purpose: menu, table, offer, category, item
- Template selection
- Target selector
- CTA text
- Show logo
- Show phone
- Show address
- Show table number
- Export format
- Preview
- Download
- Regenerate

## Data hash

QR export hash should include:

- QR link code
- Destination URL
- Template key
- Custom tokens
- Restaurant logo URL
- Restaurant name
- CTA text
- Output type
- Paper size

## Scan tracking

`qr_scan_events` should store:

- Restaurant ID
- QR link ID
- Scanned at
- User agent
- Referrer
- Source type
- Optional hashed IP

Do not store exact IP unless there is a privacy policy and legal review.

## First phase QR templates

Seed these:

```text
qr-standard-a4-poster-v1
qr-standard-table-tent-v1
qr-koko-bold-poster-v1
qr-rzrz-navy-table-v1
qr-velora-premium-card-v1
```

## Proof requirements

- QR route resolves.
- QR link is dynamic.
- QR quiet zone preserved.
- PNG export works.
- Existing `/admin/qr` still works.
- Existing table QR flow still works.
