# 05 - Bilingual Language Service Plan

## 1. Goal

MenuLink must support Arabic and English across the full application:

- Customer PWA.
- Tenant Admin.
- Platform OPS.
- Menu item screens.
- Cart and checkout.
- Orders.
- Tables.
- Drivers.
- Reports.
- Add-ons and billing.
- Error messages.
- Empty states.
- Notifications.

This must not be handled as random inline translation. MenuLink needs a proper language service.

## 2. Core Decision

```text
Arabic + English support is a platform-level requirement.
Arabic must be native, accurate, and culturally correct.
English must be clean and professional.
Arabic UI must be RTL.
English UI must be LTR.
```

## 3. Scope

### Customer PWA

Must support Arabic and English menu browsing, item names/descriptions, order type labels, cart, checkout, delivery, pickup, table, driver status copy, cancellation reasons, account pages, and RTL/LTR layout switching.

### Tenant Admin

Must support Arabic and English dashboard, order management, menu management, reports, branch management, drivers, tables, and accounting labels.

### Platform OPS

Must support Arabic and English tenant management, add-on catalog, billing status, service toggles, and system messages.

## 4. Language Service Requirements

The system should provide a reusable service such as:

```text
getLocale()
setLocale(locale)
t(key, params)
dir(locale)
formatNumber(value, locale)
formatCurrency(value, locale)
formatDate(value, locale)
```

## 5. Translation Key Strategy

Do not hardcode user-facing text inside components.

Use structured keys:

```text
customer.order.delivery
customer.order.pickup
customer.cart.add_to_cart
admin.orders.new_order
ops.addons.multi_branch
errors.delivery_out_of_range
```

## 6. Arabic Quality Rules

Arabic copy must be native Arabic, not machine-like translation, suitable for Saudi restaurant operations, clear for customers and staff, short enough for mobile, and consistent across screens.

Examples:

| English | Arabic |
|---|---|
| Add to cart | أضف للسلة |
| Delivery is not available for this address | التوصيل غير متاح لهذا العنوان |
| Select pickup branch | اختر فرع الاستلام |
| Driver returned with order | عاد السائق بالطلب |
| Business day | يوم التشغيل |
| Branch accounting | حسابات الفروع |

## 7. RTL Rules

When locale is Arabic:

```text
html dir="rtl" lang="ar"
```

Required: right alignment where appropriate, RTL layout direction, mirrored directional icons, direction-safe price and SAR symbol, phone numbers LTR, URLs LTR, codes/IDs LTR, and readable RTL tables.

## 8. LTR Rules

When locale is English:

```text
html dir="ltr" lang="en"
```

Required: left alignment where appropriate, LTR layout direction, correct directional icons, and no Arabic-only typography assumptions that break English.

## 9. Numerals

Arabic customer UI should use Arabic-Indic digits where appropriate, for example `٢٤ ريال` and `طلب رقم ٠٤٥`.

Admin/OPS dense dashboards may use Latin numerals if this improves readability, but the decision must be consistent and documented.

## 10. Data Model Localization

Tenant-managed database content should support Arabic and English where needed:

```text
name_ar
name_en
description_ar
description_en
label_ar
label_en
```

## 11. Fallback Rules

If English text is missing, Arabic can be shown as fallback. If Arabic text is missing, this is a content quality issue because Arabic is primary for Saudi restaurant customers.

## 12. QA Requirements

Every bilingual feature must be tested in Arabic RTL, English LTR, mobile width 390px, desktop admin width, long labels, price display, empty states, and error states.

## 13. Anti-Pattern List

Avoid hardcoded Arabic/English strings in React components, manual sentence splitting, mixed direction without controls, CSS hacks instead of proper `dir`, treating Arabic as translated English UI, and ignoring RTL in admin tables.

## 14. Implementation Recommendation

Start with a lightweight internal language service:

```text
apps/web/lib/i18n/
├── index.ts
├── locales.ts
├── ar.ts
├── en.ts
├── format.ts
└── rtl.ts
```
