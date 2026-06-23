# Design System · MenuLink

> Source-of-truth for prompting Google Stitch (or any AI screen generator) to produce new screens that match the existing MenuLink language. Every rule below is enforced in the live UI today — deviations are bugs.

---

## 0. Surface Map

MenuLink ships **three distinct surfaces**, each with its own atmosphere. When prompting Stitch, always declare which surface you're generating for.

| Surface | URL pattern | Atmosphere |
|---|---|---|
| **Customer PWA** | `menulink-eight.vercel.app/`, future `koko.menulink.app` | Warm, food-app, brand-driven, Arabic-first. **Per-tenant brand colors** override the defaults at runtime. |
| **Tenant Admin** | `menulink-admin-five.vercel.app/admin/*` | Clean editorial software. Light theme. The owner's operations cockpit. |
| **Platform Ops** | `menulink-admin-five.vercel.app/ops/*` | Dark professional cockpit. Distinct on purpose — visually communicates "you are now in the platform layer, not the tenant layer." |
| **Marketing** | `menulink-admin-five.vercel.app/` (root) | Editorial landing. Same palette family as the Customer PWA. |

The Customer PWA is consumer-facing — design budget goes here first. The two admins are interaction-cost optimized — clarity beats cleverness.

---

## 1. Visual Theme & Atmosphere

**Density: 4** (Daily App Balanced). Generous padding. Cards breathe. The customer is on a phone in a car park ordering for delivery — they need to scan the menu in five seconds.

**Variance: 5** (Offset Asymmetric). Heroes are **never** centered. Use split-screen, left-aligned with imagery to the right, or asymmetric whitespace. Feature grids are **2-column Zig-Zag** or asymmetric tiles, never the AI-default "3 equal cards in a row."

**Motion: 4** (Fluid CSS). Spring physics on every interactive element. Cart drawer slides with overshoot. Menu items hover-lift 2px. Order-status updates animate via Realtime, not page refresh. **No cinematic page transitions** — this is a utility app, not a portfolio.

Phrase to keep in mind when designing: *"A relaxed Riyadh evening — confident, warm, never frantic."*

---

## 2. Color Palette & Roles

### Customer PWA / Marketing (Light surface)
- **Cream Canvas** (`#FAF6EE`) — Primary background. Warmer than pure neutral; signals "food, hospitality."
- **Pure Surface** (`#FFFFFF`) — Card fill, header strip, drawer body.
- **Charcoal Ink** (`#18181B`) — Primary text, prices, item names. Never pure black.
- **Muted Steel** (`#71717A`) — Secondary text, descriptions, "ر.س" suffix.
- **Whisper Border** (`#E5E7EB`) — 1px structural lines, card outlines.
- **Brand Primary** (per-tenant, default `#D32027`) — CTAs, active tab indicator, badge fills, logo feather. Loaded at runtime from `restaurants.primary_color`.
- **Hot Chili** (`#EF4444`) — "حار" badge (heat indicator). Static — independent of tenant brand.
- **Saudi Green** (`#22C55E`) — "متاح الآن" / live status pill. Used sparingly.

### Tenant Admin (Light surface)
Same base as Customer PWA. The admin reuses **Cream Canvas** as its bg-brand-bg, white cards, brand-primary CTAs, but adds:
- **Banner Amber** (`#FEF3C7` bg, `#92400E` text) — `pending_payment` subscription state.
- **Banner Red** (`#FEE2E2` bg, `#991B1B` text) — `overdue` / `cancelled` subscription state.

### Platform Ops (Dark surface)
- **Charcoal Floor** (`#0A0A0A`) — Page background.
- **Carbon Surface** (`#171717`) — Card fill (`bg-neutral-900`).
- **Carbon Edge** (`#262626`) — Card borders (`border-neutral-800`).
- **Bone Text** (`#F5F5F5`) — Primary text (`text-neutral-100`).
- **Smoke Text** (`#A3A3A3`) — Secondary text (`text-neutral-400`).
- **Inverted CTA** (`#F5F5F5` fill, `#171717` text) — Ops's primary action is white-on-dark. Visually distinct from the tenant admin's red CTA.

### Hard color rules
- **Maximum 1 accent per surface.** Brand primary is the only saturated hue.
- **No purple/neon.** No `#A855F7`, no `#8B5CF6`, no `#06B6D4` neon, no rainbow gradient text.
- **No pure black** (`#000`). Use `#0A0A0A` minimum.
- **No saturation > 80%.** The brand red `#D32027` measures 73% — within budget.
- **No oversaturated gradient texts** on headlines. Single color, weight-driven hierarchy.

---

## 3. Typography Rules

### Arabic (primary)
- **Display headlines:** `Tajawal` 700–900. Tracking tight (`-0.02em`). Lines short.
- **Body / UI:** `Cairo` 400/600. Line-height 1.6. Max line ~65 characters.
- Both already loaded via Google Fonts in the PWA and Next.js app.

### Latin (for Admin/Ops, secondary in marketing)
- **Display:** `Geist` 700/900 or `Cabinet Grotesk` 700.
- **Body / UI:** `Geist` 400/500.
- **Mono / numbers in high-density tables:** `Geist Mono` or `JetBrains Mono`.

### Banned
- ❌ `Inter` (overused, AI-default look)
- ❌ Generic serifs: `Times New Roman`, `Georgia`, `Garamond`, `Palatino`
- ❌ Any serif inside `/admin/*` or `/ops/*` (dashboards = sans only)
- ❌ Tracking-loose display headlines (Apple-keynote-look). Tracking-tight or 0.
- ❌ Hierarchy through size alone — combine **weight + color + size**.

### Numeric specifics
- Prices in Customer PWA use **Arabic-Indic numerals** (٢٤ ر.س), not Latin (24).
- Numbers inside ops dashboards (counts, IDs, currency) use Latin numerals + Mono font for column alignment.
- Phone numbers always rendered LTR even inside RTL containers (`dir="ltr"` on the element).

---

## 4. Component Stylings

### Buttons
- **Primary (filled):** Brand primary fill, white text, `rounded-md`, `px-6 py-3 font-semibold`, `hover:opacity-90`. On `active:translate-y-px` for tactile push. No outer glow. No box-shadow rings.
- **Secondary (outline):** `border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50`.
- **Ghost (small actions):** `bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs`. Used inside admin tables.
- **Destructive:** `bg-red-50 text-red-700 hover:bg-red-100` (light surfaces); `bg-red-900/40 border border-red-800 text-red-300` (ops dark).
- **Ops primary inversion:** `bg-neutral-100 text-neutral-900 hover:bg-white` — white-on-dark to differentiate ops's authority visually from tenant admin's red CTAs.

### Cards
- **Customer PWA menu item:** `bg-white border border-neutral-200 rounded-xl p-4`, soft elevation. Image left, content right (RTL). Variant pills inline.
- **Admin cards:** Same shape. `rounded-xl` not `rounded-2xl` — these are utility containers, not marketing hero blocks.
- **Marketing pricing cards:** `rounded-2xl border-2 border-brand-primary` on the highlighted plan, `border border-neutral-200` on the standard. The highlight uses **border + small "الأكثر طلباً" pill**, never a glow.

### Inputs
- Label above (`text-xs text-neutral-600`), input fills width, helper text below if needed.
- `rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary` — no thick focus rings, no glow.
- Inline price editors (admin/menu): tiny `w-16` inputs sitting flush with text. Numeric step `0.5`.

### Badges
- **Hot (`حار`):** `bg-red-100 text-red-700` + 🌶️ emoji. The chili emoji is the ONE allowed emoji in UI chrome because it's category-meaningful, not decorative.
- **Premium (`مميز`):** `bg-amber-100 text-amber-800` + ✨ emoji. Same rule — meaningful, not decorative.
- **RFM segments:** Champion = amber, Loyal = green, At-Risk = orange, Lost = red, New = blue, Prospect = neutral. Color-coded for scanability in the customers table.

### Loaders
- **Skeletal loaders** matching layout dimensions. Use Tailwind's `animate-pulse` on a `bg-neutral-200 rounded-md` block of the same size as the content.
- **Never** circular spinners. Never the AI-default "3 bouncing dots."

### Empty states
- **Composed sentence** describing the next step, not just "No data." Examples already in code:
  - Orders empty: "لا توجد طلبات بعد."
  - Categories empty: "لا توجد فئات بعد. اضغط 'إضافة فئة' للبدء."
- Add a soft, sketched-style icon above the text if generated by Stitch — never a generic exclamation circle.

### Toast / inline messages
- Inline above the form, not floating bottom-right corner.
- Three states with already-defined styles:
  - **Success:** `bg-green-50 text-green-700 p-3 rounded-md` (light) / `bg-green-900/40 border border-green-800 text-green-300` (ops dark)
  - **Error:** swap green for red
  - **Warning:** swap green for amber

---

## 5. Layout Principles

- **RTL-first everywhere.** All containers default to `dir="rtl"`. LTR is the override (used for numerics, phone fields).
- **Mobile-first.** Multi-column desktop layouts collapse to single column under `768px`. No exceptions.
- **Max-width containment.** Marketing/Admin contained at `max-w-5xl` (1024px) or `max-w-6xl` (1152px). Customer PWA fills the device.
- **Hero never centered** for the marketing landing. Use asymmetric heading on the left, illustration/photo on the right; or top-stacked with an off-axis micro-detail.
- **Feature grid:** 2-column on `md`, 3-column on `lg` ONLY for the 6-feature card group. Never plain 3-column on `md`.
- **Customer PWA:** Two-column on tablets (`md`), single column on phone. The whole experience is designed for the phone in hand.
- **No overlapping elements.** Every element occupies its own spatial zone. Map widgets and image carousels excluded.
- **`min-h-[100dvh]` for full-height pages.** Never `h-screen` — iOS Safari has the URL-bar jump bug.
- **CSS Grid over flexbox math.** Never `calc()` percentage hacks for column widths.

---

## 6. Motion & Interaction

### Spring physics (default for new components)
- `stiffness: 100, damping: 20` if using Framer Motion.
- No `ease-linear`. No 1s+ duration easings — feels sluggish.

### Already in the codebase
- **Order feed** in `/admin/orders` — Supabase Realtime pushes new orders to the top; the new row should mount with a subtle 200ms slide-down + opacity-fade-in.
- **Cart drawer** in Customer PWA — slides in from the right (LTR) / left (RTL) with overshoot.
- **Add-to-cart toast** — 1.8s auto-dismiss, slide up from bottom on mobile.

### Perpetual micro-loops (use sparingly)
- **"Live" status pill** on `/admin/orders` while the Realtime subscription is open — soft pulse on a green dot.
- **Subscription banner** when `pending_payment` — no animation. Static. The amber color is the signal.

### Performance non-negotiables
- Animate `transform` and `opacity` only. Never `top`, `left`, `width`, `height`.
- No grain/noise SVG filters on top-level containers — only on isolated decorative pseudo-elements if needed.
- Mark heavy-animation components as Client Components (`"use client"`) so the rest of the page can be server-rendered.

---

## 7. Anti-Patterns (Banned)

### Visual clichés (AI tells)
- ❌ `Inter` font anywhere
- ❌ Generic serif (Times, Georgia, Garamond) — distinctive modern serifs only if creative need arises
- ❌ Pure black (`#000`) — minimum `#0A0A0A`
- ❌ Purple / cyan neon — banned globally
- ❌ Neon outer-glow shadows on buttons, cards, headings
- ❌ Rainbow / gradient text on headlines
- ❌ Saturated accents > 80%
- ❌ Custom mouse cursors
- ❌ Overlapping text and images (use side-by-side or stacked, not stacked-with-z-index)
- ❌ 3-column equal-card feature grids (use 2-col zig-zag or asymmetric)
- ❌ Centered Hero with a giant headline and "Scroll to explore" arrow

### Saudi-stereotype clichés (specific to this market)
- ❌ Palm tree silhouettes in heroes
- ❌ Generic Gulf landmark vector art (Kingdom Tower, Burj Khalifa, Riyadh skyline)
- ❌ Falcon / sword / coffee-pot icons as decorative chrome
- ❌ Gold gradient text "luxury" filters
- ❌ "Authentic Arabian flavors" / "Taste of the desert" copywriting

### Copy clichés
- ❌ "Elevate", "Seamless", "Unleash", "Empower", "Next-Gen", "Revolutionize"
- ❌ "Discover your perfect…", "Where flavor meets…"
- ❌ Fake round numbers (`99.99%`, `50%+`, "Trusted by 10,000+")
- ❌ Generic placeholder names — use `أحمد العتيبي` / `نورة الشمري` / `سارة الدوسري` (Saudi-realistic)
- ❌ "Powered by MenuLink ✨" footers with sparkle
- ❌ Generic CTAs: "Get Started", "Learn More", "Discover"
- ❌ Scroll-arrow chevrons, "↓ Swipe down to explore", bouncing animations under heroes

### Data clichés
- ❌ Lorem ipsum
- ❌ Unsplash photos with broken/expired URLs — use `picsum.photos` or curated CDN
- ❌ Placeholder user avatars from `i.pravatar.cc` — use seeded SVG initials
- ❌ Generic phone numbers (`+1-555-…`) — use real Saudi format `+9665XXXXXXXX`
- ❌ Fake "ratings" (4.8★ everywhere)

### MenuLink-specific
- ❌ Emojis in UI chrome (nav labels, buttons, headers). Allowed only as **data**: category emojis (`🍗 بروستد`), heat badges (`🌶️ حار`), premium badges (`✨ مميز`). These are semantic, not decorative.
- ❌ Pure brand-red customer PWA when `restaurants.primary_color` is set — always read from DB.
- ❌ Hardcoded `whatsappPhone: '966500000000'` — always read from `restaurants.whatsapp_phone` at runtime.
- ❌ Latin numerals (24 ر.س) in customer-facing prices — use Arabic-Indic (٢٤ ر.س).
- ❌ Same CTA red on Ops as on Tenant Admin — Ops uses inverted white-on-dark CTAs to communicate role separation.

---

## 8. Hero Section Rule (Marketing only)

The marketing landing at `/` is the most public surface and follows extra rules:

- **No centered hero.** Headline left-aligned, supporting visual right, asymmetric.
- **Inline image typography** allowed and encouraged: small rounded photos of food embedded inline between Arabic words in the headline, at type-height. This is the **MenuLink signature creative move**. Example: "قائمة [🥟 صورة] احترافية" where `[🥟 صورة]` is a small rounded photo sitting inline.
- **One primary CTA.** "ابدأ مع MenuLink" → WhatsApp. No "تعرف على المزيد" secondary link cluttering the row.
- **No scroll indicators.** The content draws the eye downward by composition, not by an animated chevron.

---

## 9. When Prompting Stitch

Template prompt scaffold:

```
Generate a [surface name] screen for MenuLink. Surface: [Customer PWA | Tenant Admin | Ops | Marketing].
Reference DESIGN.md sections: §1 atmosphere, §2 color palette ([light|dark]),
§3 typography (Arabic-first: Tajawal + Cairo, Latin: Geist), §4 components,
§5 layout (RTL, mobile-first, single-column < 768px), §6 motion (spring physics),
§7 anti-patterns (no Inter, no purple, no centered hero, no 3-col equal grid).

Screen goal: [describe what the screen does and what the user accomplishes].

Required elements: [list explicit components, fields, sections].

Banned: [explicitly include anti-patterns relevant to the surface].
```

Stitch will read this as authoritative. If a generated screen violates §7, regenerate with the specific anti-pattern called out.

---

## 10. Living Document

This file is the spec. The shipped code in `apps/web/` and `archive/legacy-pwa/pwa-starter/` is the implementation. When they diverge, **the code is right and this file gets updated** — never the other way around. Commit DESIGN.md changes alongside the UI changes that drive them.

Owner of design: split as of 2026-05-19.

- **Tenants own:** their **logo** and **cover image** (uploaded directly from `/admin/info`). These belong to the restaurant's identity and shouldn't be gated by ops availability.
- **Ops owns:** brand **colors**, **slug**, **name**, layout, typography stack, copy patterns. These shape the platform's coherent visual language.

Tenants still cannot redesign the menu — they operate it. Ops still cannot change a tenant's logo without permission — they can override when needed via `/ops/tenants/[id]`.
