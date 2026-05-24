# Proof: RzRz Bukhari Item Customizer Bottom Sheet

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/lib/menu-modifiers.ts` | Created | Typed modifier configuration (rice types, extras) scoped to rice-bearing categories |
| `apps/web/app/m/[slug]/types.ts` | Modified | Added `CartLineModifier` type and `modifiers`/`itemNote` fields to `CartLine` |
| `apps/web/app/m/[slug]/item-customizer-sheet.tsx` | Created | Bottom sheet component matching Stitch design |
| `apps/web/app/m/[slug]/menu-experience.tsx` | Modified | Wired customizer sheet, added `addToCartCustomized` with canonical line dedup |
| `apps/web/app/m/[slug]/menu-item.tsx` | Modified | Card tap opens sheet when `hasDetailSheet` is true; variant buttons preselect |
| `apps/web/app/m/[slug]/cart-drawer.tsx` | Modified | Displays modifier details under cart lines; includes modifiers+notes in WhatsApp message and order persistence |

## Behavior Implemented

1. Tapping a menu item card on `/m/rzrz-bukhari` opens a bottom sheet (gated by `theme.hasItemDetailSheet`)
2. Tapping a variant price button opens the sheet with that variant preselected
3. Rice type (single select) and extras (multi select) modifier groups with live price recalculation
4. Kitchen notes textarea with 200-char limit and Arabic-Indic live counter
5. Quantity stepper (min 1)
6. CTA button shows live total with SAR symbol
7. Cart lines with different modifiers or notes create separate entries (canonical dedup key)
8. Cart drawer displays modifier groups and item notes under each line
9. WhatsApp message includes modifier details and per-item notes
10. Order persistence: modifier summary and notes encoded into the `variant` text field (no migration needed)

## Data Model

- **No database migration** — modifiers are a typed config layer in `menu-modifiers.ts`
- Modifier selections are encoded into the existing `order_items.variant` free-form text column
- Cart line dedup uses a canonical key: `slug::variantKey::groupKey=selected|...::n:noteText`
- Same item + same variant + different modifiers/note = separate cart lines
- Same item + same variant + same modifiers + same note = quantity increment

## Theme Gating

- Bottom sheet only activates when `theme.hasItemDetailSheet === true`
- Currently only `RZRZ_THEME` has this set to `true`
- Default theme (KO-KO and others) has `false` — existing tap-to-add behavior unchanged

## Build Result

```
npm run build — PASSED (zero TypeScript errors)
tsc --noEmit — PASSED
```

## KO-KO Regression

- `/m/koko` uses default theme with `hasItemDetailSheet: false`
- Card tap behavior unchanged (variant buttons add directly to cart)
- No new props break existing component interface (all new props are optional)
- Build confirms no type errors across all routes

## Category Keyword Verification

Queried `menu_categories` for RzRz Bukhari from production DB:

| Category (name_ar) | Slug | Modifier Match? |
|---|---|---|
| الشواية | shawaya | YES ("شواية") |
| الفحم | fahem | YES ("فحم") |
| المضغوط والسليق | madghoot | YES ("مضغوط") |
| كبسة اللحم | kabsa | YES ("كبسة") |
| المشويات | mashawi | YES ("مشويات") |
| الأرز | rice | No (rice sides don't need rice modifiers) |
| المقبلات والسلطات | mezze | No (correct — no rice options) |
| الحلويات | sweets | No (correct — no rice options) |

5 of 8 categories match — all rice-bearing main dish categories. 3 excluded correctly (rice sides, mezze, sweets).

## Smoke Testing

Not performed in this session — recommend manual verification at `/m/rzrz-bukhari` before deploy:
- Open شواية بخاري and confirm modifier groups appear
- Verify default rice (رز شعبي) is pre-selected and price includes +2
- Select extras and verify total updates
- Add to cart and check cart drawer shows modifier details
- Send WhatsApp and confirm message includes options and notes

## Known Limitations

1. Modifier groups are config-driven (not database-backed) — scoped to RzRz rice-bearing categories only
2. Category matching uses Arabic name substring match (e.g., contains "مشويات" or "كبسة")
3. Item-level notes are encoded into the `variant` text field for persistence — may exceed thermal printer width for complex orders (but WhatsApp message is the primary customer-facing output)
4. No item image shown inside the sheet (matching the Stitch reference which also omits it)
5. Modifier prices are static config, not dynamically fetched from a database table
