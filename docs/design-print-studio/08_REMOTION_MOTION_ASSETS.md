# Remotion Motion Assets · Future Scope

## Purpose

Remotion is for generated motion assets, not for the main customer menu runtime.

Use Remotion later to generate:

- Item promo videos
- Offer stories
- Animated QR videos
- New restaurant launch videos
- Motion covers
- Short social media assets

## Strategic placement

```text
MenuLink Brand & Print Studio
   ↓
Static assets first
   ↓
PDF and QR
   ↓
Promotions
   ↓
Remotion motion assets
```

## Do not use Remotion for

- Main `/m/[slug]` page rendering
- Normal digital menu cards
- PDF generation first phase
- Every save action
- Runtime customer browsing

## Use Remotion for

| Output | Example |
|---|---|
| Item video | New burger promo |
| Offer video | Ramadan offer story |
| QR animation | Animated scan-to-order clip |
| Launch video | New tenant launch |
| Premium lounge video | Velora-style cinematic story |

## Recommended package layout later

```text
packages/
├── design-templates/
└── remotion-renderer/
    ├── compositions/
    ├── components/
    ├── data/
    └── render.ts
```

## Render workflow later

```text
Promotion or item data
   ↓
Motion template
   ↓
Remotion render job
   ↓
MP4 or WebM output
   ↓
Storage
   ↓
Download or social sharing
```

## DS-1 instruction

Do not install or implement Remotion in DS-1.

Only leave architecture space for future motion outputs.

## Future database extension

Later add:

```sql
motion_templates
restaurant_motion_profiles
motion_exports
```

## Guardrails

- Rendering must be async.
- Do not render videos during normal page requests.
- Do not block the customer PWA.
- Store output files.
- Add render status.
- Add retry and failure state.
- Validate commercial licensing before selling Remotion-based video generation as a paid automated service.
