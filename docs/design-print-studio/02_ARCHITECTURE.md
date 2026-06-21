# Architecture · MenuLink Brand & Print Studio

## Architectural goal

Create a reusable design and output layer that sits above existing tenant data and below generated customer-facing surfaces.

Do not rebuild existing menu, order, customer, loyalty, or admin systems.

## Proposed modules

```text
MenuLink Brand & Print Studio
├── Template Registry
│   ├── Brand Identity Templates
│   ├── Menu Page Templates
│   ├── Print Templates
│   ├── QR Design Templates
│   └── Promotion Templates
│
├── Tenant Design Profile
│   ├── Draft profile
│   ├── Published profile
│   ├── Archived versions
│   └── Custom design tokens
│
├── Runtime Renderer
│   ├── Customer PWA theme resolver
│   ├── Menu page template resolver
│   ├── Print route resolver
│   └── QR template resolver
│
├── Export Engine
│   ├── HTML print pages
│   ├── PDF generation
│   ├── PNG generation
│   ├── SVG QR generation
│   └── Export history
│
├── Promotion System
│   ├── Active offer cards
│   ├── Offer linked items
│   ├── Digital display
│   ├── Print inclusion
│   └── QR deep links
│
└── Motion Assets later
    ├── Remotion templates
    ├── Item promo videos
    ├── Offer stories
    └── Animated QR videos
```

## Existing surfaces affected

| Surface | Change type |
|---|---|
| `/ops/tenants/[id]` | Major enhancement, new tabs |
| `/m/[slug]` | Controlled enhancement, reads published design profile |
| `/admin/qr` | Enhance or later unify with QR templates |
| `/admin/menu` | No major change, source data remains authoritative |
| Supabase migrations | Add tables and policies |
| Storage | Add generated export assets |

## Data flow

```text
Menu data + restaurant data
       ↓
Published design profile
       ↓
Template resolver
       ↓
Output target
       ├── Customer PWA
       ├── Print preview route
       ├── PDF export
       ├── QR export
       └── Motion asset later
```

## Runtime principle

The customer PWA must remain fast.

Do not render heavy print logic or video logic in the normal `/m/[slug]` experience.

## Export principle

Use generated exports for downloadable assets.

- PDF exports should use dedicated print routes.
- QR exports should support SVG and PNG.
- Generated files should be saved to storage.
- Each export must carry a data hash.
- If source data changes, mark export as outdated or regenerate.

## Separation of concerns

| Concern | Table or code area |
|---|---|
| Restaurant identity | `restaurants` plus design profile |
| Reusable templates | `brand_identity_templates`, `menu_page_templates`, `print_templates`, `qr_design_templates` |
| Tenant customization | `restaurant_design_profiles`, `restaurant_print_profiles`, `restaurant_qr_profiles` |
| Promotions | `promotions`, `promotion_items` |
| Exports | `print_exports`, `qr_exports` |
| Dynamic QR destination | `qr_links` |
| Scan events | `qr_scan_events` |

## Integration with current theme code

Existing theme-related code should be treated as the bridge, not the final registry.

Recommended helper structure:

```text
apps/web/lib/design/
├── tokens.ts
├── templates.ts
├── resolver.ts
├── hashing.ts
├── validation.ts
└── qr.ts
```

## Rules

- Keep current tenants working.
- Avoid breaking DB functions used by `/m/[slug]`.
- Additive migrations first.
- No destructive migration in early phases.
- Seed templates must be idempotent.
- Use `key` fields for templates to avoid depending on UUIDs in code.
