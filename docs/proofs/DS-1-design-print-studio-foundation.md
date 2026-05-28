# Proof · DS-1 — Design & Print Studio Foundation

## Goal

Add the database + TypeScript foundation for the MenuLink Brand & Print Studio:
reusable brand/page/print/QR templates, tenant design/print/QR profiles, dynamic QR
links, QR/print export history, promotions, and QR scan events. Foundation only — it
unblocks DS-2 (Ops Studio UI) and DS-3 (customer PWA resolver), which consume it later.

## Scope

- One additive Supabase migration (tables + indexes + RLS + idempotent template seeds).
- A pure TypeScript helper layer under `apps/web/lib/design/`.
- No UI, no PDF/PNG/SVG rendering, no Remotion, no `/m/[slug]` changes, no `/q/` route,
  no POS changes. Helpers are imported by **no route** in DS-1.

## Files changed

```text
A  apps/web/supabase/migrations/0059_design_print_studio_foundation.sql
A  apps/web/lib/design/types.ts
A  apps/web/lib/design/tokens.ts
A  apps/web/lib/design/templates.ts
A  apps/web/lib/design/resolver.ts
A  apps/web/lib/design/hashing.ts
A  apps/web/lib/design/validation.ts
A  apps/web/lib/design/qr.ts
A  docs/proofs/DS-1-design-print-studio-foundation.md
```

No existing files were modified (`lib/types.ts` left untouched; new row shapes live in
`lib/design/types.ts`).

## Migration name

`0059_design_print_studio_foundation.sql` (next available; latest prior was `0058`).

## Tables created (13)

| Group | Tables |
|---|---|
| Global templates | `brand_identity_templates`, `menu_page_templates`, `print_templates`, `qr_design_templates` |
| Tenant profiles | `restaurant_design_profiles`, `restaurant_print_profiles`, `restaurant_qr_profiles` |
| QR + exports | `qr_links`, `qr_exports`, `print_exports`, `qr_scan_events` |
| Promotions | `promotions`, `promotion_items` |

Schema is verbatim from `03_DATABASE_SCHEMA.md`: `text` + `check` constraints (no PG enum
types), `gen_random_uuid()` PKs (no extension added). `restaurant_design_profiles.created_by`
is a plain `uuid` (no FK, matching MenuLink convention). `qr_links.table_id` is FK-less (soft
ref to `restaurant_tables(id)`, per spec). Indexes: the 7 `ix_*` from the pack plus the partial
unique `ux_restaurant_design_profiles_one_published` (one published profile per tenant).

## RLS summary

RLS enabled on all 13 tables (verified: 13 `enable row level security`, 26 policies = 2/table,
each guarded by `drop policy if exists` for re-runnability). Reuses existing helpers
`public.is_platform_admin()` and `public.owns_restaurant(uuid)` (migration 0008).

- **Global template tables (4)**: `*_ops_all` (platform admin full access) + `*_auth_read`
  (`select` to authenticated where `is_active`). No anon policy — public pages do not read
  template tables directly.
- **Tenant tables (8, with `restaurant_id`)**: `*_ops_all` + `*_owner_read`
  (`select using owns_restaurant(restaurant_id)`). Write stays **ops-only** in DS-1.
- **`promotion_items`** (no `restaurant_id`): ops-all + owner-read via parent
  `promotions.restaurant_id`.
- **`qr_scan_events`**: ops-all + owner-read only; **no public/anon insert** yet (scan route
  is DS-4).

## Seeds created (14, idempotent)

`insert … on conflict (key) do update` (4 insert blocks, verified). No tenant profile rows
seeded.

- Brand (5): `koko-bold-v1`, `rzrz-navy-v1`, `velora-premium-v1`, `standard-clean-v1`, `cafe-minimal-v1`
- Page (2): `fast-food-grid-v1`, `premium-lounge-grid-v1`
- Print (2): `a3-full-menu-bold-v1`, `a4-full-menu-clean-v1`
- QR (5): `qr-standard-a4-poster-v1`, `qr-standard-table-tent-v1`, `qr-koko-bold-poster-v1`, `qr-rzrz-navy-table-v1`, `qr-velora-premium-card-v1`

## Commands run

```text
grep -r "@/lib/design" apps/web/app      # regression guard
npx tsc --noEmit                          # full-project type-check
npm run build                             # next build
# static SQL self-consistency greps on the migration
```

## Results

- `grep "@/lib/design" apps/web/app` → **no matches** (helpers imported by no route).
- `npx tsc --noEmit` → **clean** (no type errors).
- `npm run build` → **success**; full route table emitted, including `/m/[slug]`,
  `/admin/qr`, `/admin/tables`, `/ops/tenants/[id]` (all unchanged surfaces still compile).
- Static SQL review → 13 `create table if not exists`; 13 `enable row level security`;
  26 policies; 4 idempotent seed inserts → 14 distinct template keys; 1 partial unique index;
  0 destructive statements; 0 extension installs; 0 hardcoded tenant UUIDs.
- `npm run lint` → **not run**: the repo has no ESLint config (`next lint` offers to scaffold
  one). Scaffolding would be an unrelated modification; type safety is covered by
  `tsc --noEmit` + `next build`.

## Guardrails verified

- `/m/[slug]`, `/admin/qr`, `/admin/tables` untouched and still build → KO-KO / RzRz / Mazaj
  unaffected.
- No PDF generation, no Remotion, no POS changes, no `/q/` route.
- Existing design form (`app/ops/tenants/[id]/design-form.tsx`) untouched.
- Migration additive only; no destructive statements; no secrets; no unrelated files modified.

## Known limitations

- **Migration not applied to the live Supabase project** this session (authored only; user
  reviews/applies). Acceptance items "Migration applies / Tables exist in Supabase / RLS
  enabled in DB" are pending that apply.
- `lib/design/*` helpers are **unwired** — exported but imported by no route (DS-3 wires the
  resolver into `/m/[slug]`).
- RLS **write** access is **ops-only** in DS-1 (no tenant self-service writes yet).
- Owner-read on `restaurant_design_profiles` covers all the tenant's own rows (not narrowed to
  `status='published'`); there is no tenant-facing read path in DS-1, so this is deferred to DS-3.
- No `lint` step (no ESLint config in repo).

## Next recommended phase

**DS-2 · Ops Design Studio UI** — turn `/ops/tenants/[id]` into a multi-tab studio (Brand,
Menu Page, Print, QR, Promotions, Outputs, Versions) that selects templates and saves/publishes
a `restaurant_design_profiles` row. Then DS-3 wires the resolver into `/m/[slug]`.
