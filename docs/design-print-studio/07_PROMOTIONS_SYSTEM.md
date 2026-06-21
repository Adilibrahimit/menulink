# Promotions System · Offers, Cards, QR, Print

## Purpose

Promotions are structured data, not static images.

A promotion should be able to appear:

- At the top of the digital menu
- Inside A3/A4 print menus
- As a standalone offer card
- As a QR destination
- Later as a Remotion video

## Promotion types

| Type | Example |
|---|---|
| Daily offer | عرض اليوم |
| New item | جديد |
| Bundle | كومبو خاص |
| Seasonal | رمضان, العيد |
| Time limited | عرض الغداء |
| Category offer | مشروبات, بروستد |
| Single item | صنف جديد |

## UX placement

Digital menu:

```text
Hero
Promotions rail
Category tabs
Menu items
```

Print menu:

```text
Header
Featured offer card
Menu categories
Compliance blocks
Footer
```

QR:

```text
Offer QR card opens the active promotion directly
```

## Promotion data rules

- Promotion must belong to one restaurant.
- Promotion can link to zero or more menu items.
- Promotion can have old price, new price, or bundle price.
- Promotion can be active without a discount, for example `جديد`.
- Promotion must support start and end dates.
- Priority controls display order.
- Inactive promotions must not appear publicly.

## Validation rules

Before publishing a promotion:

- Title exists.
- Restaurant exists.
- Linked menu items belong to the same restaurant.
- Dates are valid.
- If price fields exist, new price must be lower than old price unless it is a bundle.
- If image is used, source must be storage or existing menu image.
- If show in print is enabled, image quality should be acceptable.

## UI requirements

In Ops or Tenant Admin later:

- Create promotion
- Edit promotion
- Activate/deactivate
- Set dates
- Select linked items
- Choose template
- Preview digital card
- Preview print card
- Generate QR for promotion

## DS-1 handling

Only create schema and seed one basic promotion template concept if needed.

Do not redesign customer PWA yet.

## DS-5 handling

Implement active promotions in:

- `/m/[slug]`
- Print routes
- QR links
- Export hash

## Copy rules

Arabic copy should be short.

Examples:

```text
عرض اليوم
جديد
لفترة محدودة
وجبة مميزة
امسح العرض
```

Avoid:

```text
تجربة لا تُنسى
نكهات تأخذك لعالم آخر
عرض لا يقاوم
```

## Promotions and pricing

Promotions must not silently change POS prices.

For now:

- Promotions are display and marketing.
- Order pricing must use approved menu item variants unless explicit bundle pricing is implemented safely.
- Bundle pricing requires order calculation changes and should be a separate phase.
