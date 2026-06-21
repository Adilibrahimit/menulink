# Template Taxonomy · Brand, Page, Print, QR, Offers

## Purpose

The template system must prevent design chaos.

Each template type has a specific responsibility.

## Template type overview

| Template type | Purpose | Example |
|---|---|---|
| Brand Identity Template | Defines brand atmosphere and tokens | KO-KO Bold, RzRz Navy, Velora Premium |
| Menu Page Template | Defines digital menu layout | Fast Food Grid, Premium Lounge Grid |
| Print Template | Defines print layout | A3 Full Menu, A4 Full Menu |
| QR Design Template | Defines QR poster/card/sticker layout | Table Tent QR, Premium QR Card |
| Promotion Template | Defines offer card layout | عرض اليوم, New Item, Combo |

## Brand Identity Template

Controls:

- Brand colors
- Typography stack
- Surface tone
- Card style
- Button radius
- Border behavior
- Mood
- Image treatment
- Accent usage

Does not control:

- Menu data
- Item prices
- Item availability
- QR destination
- Print paper size

## Menu Page Template

Controls:

- Header style
- Category navigation
- Item cards
- Promotions placement
- Cart CTA style
- Mobile layout
- Desktop layout if needed

Does not control:

- Primary brand colors directly
- Menu item data
- QR design

## Print Template

Controls:

- Paper size
- Orientation
- Print layout
- Category grouping
- Header, footer, QR placement
- Compliance blocks
- Output density

Does not control:

- Digital menu layout
- Restaurant data itself
- Dynamic QR link logic

## QR Design Template

Controls:

- QR visual container
- Poster/table/sticker/card format
- Logo placement
- CTA copy
- Contact info placement
- Print-safe color handling

Does not control:

- The link destination
- Menu item data
- Offer validity logic

## Promotion Template

Controls:

- Offer card layout
- Badge style
- Date placement
- Image treatment
- Print inclusion style

Does not control:

- Actual discount logic
- POS pricing
- Order calculation

## Template keys

Use stable keys:

```text
koko-bold-v1
rzrz-navy-v1
velora-premium-v1
fast-food-grid-v1
premium-lounge-grid-v1
a3-full-menu-bold-v1
a4-full-menu-clean-v1
qr-table-tent-standard-v1
qr-premium-card-v1
offer-card-standard-v1
```

## Token model

Tokens must be JSON-serializable.

Example:

```json
{
  "colors": {
    "background": "#0F0E0D",
    "surface": "#1C1A17",
    "primary": "#C8A15A",
    "text": "#F3EBDD",
    "muted": "#A79A86",
    "accent": "#6B1E1E"
  },
  "typography": {
    "heading": "Tajawal",
    "body": "Cairo",
    "latin": "Geist"
  },
  "layout": {
    "cardRadius": "18px",
    "imageRadius": "16px",
    "density": "comfortable"
  }
}
```

## Override rules

Priority order:

```text
System defaults
   ↓
Template defaults
   ↓
Restaurant design profile tokens
   ↓
Output-specific custom tokens
```

## Save as template

If a tenant design is customized and approved, allow ops to save it as:

- Private tenant template
- Global reusable template
- Archived draft

Do not allow tenant owners to publish global templates.

## Versioning

All published design profiles should carry:

- `version_number`
- `status`
- `published_at`

When publishing a new profile:

- Archive old published profile.
- Publish new profile.
- Keep old export history for audit.

## Starter template set

Phase DS-1 should seed:

- KO-KO Bold
- RzRz Navy
- Velora Premium
- Standard Clean
- Café Minimal
