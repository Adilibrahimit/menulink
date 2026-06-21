# Implementation Phases · MenuLink Brand & Print Studio

## Phase DS-1 · Foundation

### Goal

Create the database and TypeScript foundation for templates, tenant design profiles, QR design templates, promotions, and export history.

### Scope

- Add Supabase migration.
- Add DB types if manually maintained.
- Add seed data for starter templates.
- Add helper files under `apps/web/lib/design/`.
- No major UI change.
- No PDF generation.
- No Remotion.
- No customer PWA redesign.

### Files likely affected

```text
apps/web/supabase/migrations/00xx_design_print_studio_foundation.sql
apps/web/lib/design/tokens.ts
apps/web/lib/design/templates.ts
apps/web/lib/design/resolver.ts
apps/web/lib/design/hashing.ts
apps/web/lib/design/validation.ts
apps/web/lib/design/qr.ts
apps/web/lib/types.ts
docs/proofs/DS-1-design-print-studio-foundation.md
```

### Acceptance

- Build passes.
- Migration applies.
- RLS enabled.
- Starter templates seeded.
- Existing `/m/koko` works.
- Existing `/m/rzrz-bukhari` works if present.
- Existing `/admin/qr` works.
- Existing `/admin/tables` QR works.
- No tenant data lost.

---

## Phase DS-2 · Ops Design Studio UI

### Goal

Upgrade `/ops/tenants/[id]` into a multi-tab design studio.

### Scope

Tabs:

- Overview
- Brand Identity
- Menu Page Template
- Print Templates
- QR Templates
- Promotions
- Outputs
- Versions

### Acceptance

- Ops can select templates.
- Ops can save draft design profile.
- Ops can publish design profile.
- Old published profile archives.
- Customer PWA still stable.

---

## Phase DS-3 · Customer PWA Template Resolver

### Goal

Make `/m/[slug]` read published design profiles.

### Scope

- Load published design profile server-side.
- Resolve tokens.
- Apply CSS variables.
- Add safe fallback to current theme.
- Add promotions placeholder if no active promotions.

### Acceptance

- KO-KO output unchanged or intentionally matched.
- RzRz output unchanged or intentionally matched.
- Velora can be previewed without breaking existing tenants.
- No hardcoded tenant data.

---

## Phase DS-4 · QR Design Templates

### Goal

Implement QR design profiles and exports.

### Scope

- QR profile UI.
- Dynamic QR links.
- QR preview.
- PNG or SVG export.
- Basic scan route.
- Scan event insert.

### Acceptance

- Standard A4 QR poster works.
- Table tent QR works.
- Dynamic link redirects correctly.
- QR exports are tenant-scoped.
- Scan events are recorded.
- Existing QR features still work.

---

## Phase DS-5 · Print Templates A3/A4

### Goal

Generate print-ready full menu outputs.

### Scope

- A3 full menu print route.
- A4 full menu print route.
- Data hash.
- Export record.
- Storage upload.
- Download link.

### Acceptance

- A3 PDF generated.
- A4 PDF generated.
- Actual MenuLink images used.
- Actual MenuLink prices used.
- VAT notice shown.
- Calories shown when available.
- Allergens shown when available.
- Export becomes outdated after price change.

---

## Phase DS-6 · Promotions

### Goal

Add structured offers to digital and print output.

### Scope

- Promotions CRUD.
- Active promotion display on `/m/[slug]`.
- Promotion print card.
- Promotion QR link.
- Export hash includes promotions.

### Acceptance

- Active offer appears.
- Expired offer disappears.
- Offer QR opens correct destination.
- Print menu includes active offers if configured.

---

## Phase DS-7 · Export Management

### Goal

Improve export queue, regenerate, outdated state, and history.

### Scope

- Outputs tab.
- Export status.
- Regenerate button.
- Failure state.
- Download history.

### Acceptance

- Existing export can be reused.
- Force regenerate works.
- Failed export shows reason.
- Outdated export is clear.

---

## Phase DS-8 · Remotion Motion Assets

### Goal

Add premium motion asset generation.

### Scope

- Remotion package.
- First item promo template.
- First offer story template.
- Storage output.
- Download link.

### Acceptance

- Async render only.
- No customer PWA runtime dependency.
- MP4 output works.
- Failure state works.

## Recommended immediate action

Start with DS-1 only.
