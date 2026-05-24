# Handoff — Session 2026-05-24

## 1. Goal
Refactor the customer PWA, activate the RzRz theme system, redesign the login/account flow for themed tenants, update the landing page, and apply the official SAMA SAR symbol across all customer pages.

## 2. Current State
- **Everything is deployed and live on Vercel.** Build passes, 0 errors.
- KO-KO (`/m/koko`) — unchanged default theme, working as before.
- RzRz (`/m/rzrz-bukhari`) — new dark-navy theme with Alexandria font, gold CTA, 5-item bottom nav.
- Landing page (`/`) — updated with all 12 features, pricing replaced with "contact us" CTA, WhatsApp `+966504744517` + email `id.menulink@gmail.com`.
- SAR symbol (official SAMA SVG) replaces all "ر.س" text across customer pages.
- VAT notice ("جميع الأسعار شاملة ضريبة القيمة المضافة") shown on every restaurant menu page.
- Table QR flow works: guest or Google, locked to dine_in, no issues.

## 3. Files Currently Being Worked On
- `apps/web/app/m/[slug]/menu-experience.tsx` — main menu page, now ~260 lines (was 800+)
- `apps/web/app/m/[slug]/customer-shell.tsx` — auth gate + order type gate + bottom nav
- `apps/web/app/m/[slug]/cart-drawer.tsx` — checkout with pre-selected order type, SAR symbol
- `apps/web/app/m/[slug]/account/account-client.tsx` — Google-linked card for google-first tenants
- `apps/web/lib/themes.ts` — theme registry (DEFAULT_THEME + RZRZ_THEME)
- `apps/web/app/page.tsx` — marketing landing page

## 4. Files Changed in This Session (10 commits, 30 files)

### New files created:
| File | Purpose |
|------|---------|
| `apps/web/lib/themes.ts` | Theme type, config registry, CSS var builder |
| `apps/web/lib/arabic.ts` | `toArabicDigits()` shared utility |
| `apps/web/app/m/[slug]/theme-context.tsx` | ThemeProvider + useTheme (created but unused — context approach replaced by prop drilling) |
| `apps/web/app/m/[slug]/cart-drawer.tsx` | Extracted from menu-experience |
| `apps/web/app/m/[slug]/closed-popup.tsx` | Extracted from menu-experience |
| `apps/web/app/m/[slug]/tracking-sheet.tsx` | Extracted from menu-experience |
| `apps/web/app/m/[slug]/order-type-gate.tsx` | Full-screen order type picker for google-first flow |
| `apps/web/app/m/[slug]/order-context.tsx` | OrderTypeProvider — passes pre-selected order type to CartDrawer |
| `apps/web/app/m/[slug]/sar-symbol.tsx` | Official SAMA Saudi Riyal SVG component |

### Modified files:
| File | What changed |
|------|-------------|
| `menu-experience.tsx` | Extracted components out, added theme prop, dark-navy header, gold cart bar, VAT notice, SAR symbol |
| `customer-shell.tsx` | Added theme prop, order type gate flow, OrderTypeProvider wrapper |
| `login-gate.tsx` | Added `googleOnly` prop (later removed), switched fonts to CSS vars |
| `bottom-nav.tsx` | Added `navItems` prop (3 or 5), extended tabs with rewards/about |
| `category-tabs.tsx` | Added `categoryStyle` prop (pills vs tabs), theme font |
| `menu-item.tsx` | SAR symbol, theme font |
| `cart-drawer.tsx` | Pre-selected order type from context, SAR symbol, theme fonts |
| `account/account-client.tsx` | GoogleLinkedCard, googleFirstFlow prop, SAR symbol |
| `orders/orders-client.tsx` | SAR symbol, theme fonts |
| All sub-pages (about, contact, orders, account, rewards, privacy, terms) | `buildCssVars()` replaces hardcoded CSS vars, fonts switched to `var(--font-display)` |
| `page.tsx` (landing) | 12 features, admin features list, pricing → contact CTA, WhatsApp + email |

## 5. What Was Tried
- Extracted menu-experience.tsx into 6 focused modules — worked cleanly.
- Created theme system with getTheme/buildCssVars — working across all pages.
- Initially forced Google-only login on RzRz — user rejected this, changed to guest-first with optional Google linking on account page.
- Added order type gate after login for google-first tenants — working.
- Replaced all hardcoded `fontFamily: "Tajawal"` with `var(--font-display)` CSS var — working.
- Created SarSymbol component from SAMA official SVG paths — working.

## 6. What Failed
- First attempt at `LoginGate` rewrite had `\u{1FA91}` Unicode escape in JSX text content (not in a JS expression) — caused build error. Fixed by wrapping in `{"\u{1FA91}"}`.
- User initially wanted forced Google sign-in on RzRz, then changed mind — wanted guest as fallback, Google linking optional on account page. Required undoing the `googleOnly` prop.

## 7. Known Issues
- `theme-context.tsx` (ThemeProvider/useTheme) was created but is **not used anywhere** — theme is passed via props instead. Can be deleted or kept for future use.
- The `loginFlow: "google-first"` flag in ThemeConfig still controls order-type-gate and account page behavior, even though Google is no longer forced at login. The name is slightly misleading now.
- WhatsApp order messages still use "ر.س" text (correct — WhatsApp can't render SVG).
- The build shows a non-fatal `Cannot read properties of undefined (reading 'kind')` warning on exit but all pages compile and generate correctly.
- `rewards/rewards-client.tsx` and other deeper sub-pages may still have hardcoded `fontFamily: "Tajawal"` — not checked in this session.

## 8. Important Assumptions
- Theme is determined by slug match in `lib/themes.ts` — no database column for theme yet.
- Google Fonts (Alexandria for RzRz) are loaded via `<link>` tag in each page's render, not in a layout.tsx. This means each sub-page loads the font independently.
- The order type selected in the gate is stored in `localStorage` per restaurant.
- Guest flow: phone + name stored in `localStorage` as `menulink:guest`.
- Customer record is created on first order, not at login time (for google-first tenants).

## 9. Guardrails
- Build must remain 0 errors. Currently passes.
- KO-KO customer experience must not change — it uses DEFAULT_THEME.
- WhatsApp order messages must remain plain text (no SVG/HTML).
- Do not remove the guest login option from any tenant.
- Do not force Google sign-in — it's always optional.
- RTL + Arabic-first across all customer pages.
- SAR symbol must use the official SAMA SVG paths, not "ر.س" text.

## 10. Exact Next Steps
1. Read this handoff.
2. Verify build passes: `cd apps/web && npx next build`.
3. Consider creating a shared `layout.tsx` for `/m/[slug]` to load Google Fonts once instead of per-page.
4. Audit remaining sub-pages (`rewards/rewards-client.tsx`, etc.) for hardcoded `Tajawal` fonts.
5. Consider deleting unused `theme-context.tsx` or wiring it up.
6. Consider renaming `loginFlow: "google-first"` to something more accurate like `"enhanced"` since Google is no longer forced.
7. Next feature work per user priorities: POS Integration (RzRz Bridge App), Payment Gateway (Moyasar), or additional tenant onboarding.

## 11. Verification Commands
```bash
cd apps/web
npx next build
```
Check live:
- https://menulink-admin-five.vercel.app/ (landing)
- https://menulink-admin-five.vercel.app/m/koko (KO-KO, default theme)
- https://menulink-admin-five.vercel.app/m/rzrz-bukhari (RzRz, navy theme)

## 12. Final Status
**Status: PASS**

All 10 commits deployed to production. Build compiles, all 27 static pages generate, both tenant pages work with their respective themes. Landing page updated with full features and contact CTAs. SAR symbol and VAT notice applied globally.
