# DS-8 · Remotion Architecture-Space — Design Spec

- **Date:** 2026-05-29 · **Phase:** DS-8 (final) · **Branch:** `ds-8-remotion-arch-space`
- **Status:** Approved (standing approval). **Depends on:** DS-1 RLS helpers
  (`is_platform_admin()`, `owns_restaurant(uuid)`); the DS-1 template/profile/export pattern.

## Pack instruction (verbatim intent)

> "Do not install Remotion; only leave architecture space." Finish as a **future-schema foundation +
> doc**, NOT a live video pipeline.

So DS-8 ships **only** the database foundation for a future motion/video feature (promo reels,
item spotlights, offer stories) + an architecture doc. **No** `npm install remotion`, **no** render
worker, **no** UI, **no** `lib/` code that imports anything, **no** `/m` or `/ops` changes.

## Scope

**In:** one additive migration (**0068**) creating three tables that mirror the existing
template→profile→export shape, with RLS + a few seeded global motion templates + a doc.

**Out (deferred — the actual feature):** Remotion install + compositions, a render worker /
queue, storage of rendered `mp4/gif`, an Ops "Motion" studio tab, fingerprint-driven regeneration.
None of this is built; the schema only reserves the space.

## Tables (mirror DS-1 conventions: `if not exists`, text+check, `gen_random_uuid()`)

- **`motion_templates`** (GLOBAL, like `qr_design_templates`): `id`, `key` unique, `name_ar`,
  `name_en`, `format` check `('reel_9_16','square_1_1','story_9_16','landscape_16_9')`,
  `composition_id text` (future Remotion composition name), `duration_seconds int`,
  `default_props_json jsonb default '{}'::jsonb`, `supported_tiers text[]`, `is_active bool default
  true`, `created_at`.
- **`restaurant_motion_profiles`** (TENANT, like `restaurant_design_profiles`): `id`,
  `restaurant_id` FK→restaurants, `motion_template_id` FK→motion_templates, `name_ar`,
  `props_json jsonb default '{}'::jsonb`, `status` check `('draft','published')` default `'draft'`,
  `created_by uuid` (no FK, per convention), `created_at`, `updated_at`.
- **`motion_exports`** (TENANT, like `qr_exports`): `id`, `restaurant_id` FK→restaurants,
  `motion_profile_id` FK→restaurant_motion_profiles `on delete set null`, `export_type` check
  `('mp4','gif','webm')`, `file_url`, `data_hash text not null`, `status` check
  `('queued','rendering','rendered','failed','outdated')` default `'queued'`, `error_message`,
  `duration_ms int`, `rendered_at`, `created_at`.

**Indexes:** `ix_restaurant_motion_profiles_restaurant`, `ix_motion_exports_restaurant`; partial
unique `ux_restaurant_motion_profiles_one_published (restaurant_id) where status='published'`.

## RLS (exactly the DS-1 pattern)

- `enable row level security` on all three.
- `motion_templates`: `motion_templates_ops_all` (`for all to authenticated using/with check
  is_platform_admin()`) + `motion_templates_auth_read` (`for select to authenticated using
  is_active`).
- `restaurant_motion_profiles` + `motion_exports`: `<t>_ops_all` (ops full) + `<t>_owner_read`
  (`for select to authenticated using owns_restaurant(restaurant_id)`). **Write stays ops-only**
  (no owner write), matching DS-1.

## Seeds (GLOBAL templates only — idempotent `on conflict (key) do update`)

3 rows: `promo-reel-9-16-v1` (reel_9_16, 15s), `item-spotlight-1-1-v1` (square_1_1, 8s),
`offer-story-9-16-v1` (story_9_16, 10s). **No tenant rows** → production tenants (`koko` etc.)
unchanged.

## Safety

Purely additive: 3 new tables + RLS + 3 global seed rows. Reuses existing RLS helpers. No app code,
no deps, no UI, no public surface. No existing table touched. Verified statically + applied to live;
confirm no tenant rows created.

## Files

Create: `apps/web/supabase/migrations/0068_motion_arch_space.sql`,
`docs/proofs/DS-8-remotion-arch-space.md` (doubles as the architecture doc).

## Verification

- Static SQL review (3 `create table if not exists`; RLS on all 3; 3 seed keys with `on conflict`;
  no destructive/extension/hardcoded-UUID statements; partial unique present).
- Apply 0068 to live; confirm the 3 templates seeded; confirm `restaurant_motion_profiles` /
  `motion_exports` row counts = 0 (no tenant data). `tsc`/`build` unaffected (no app code changed).

## Next

DS-8 closes the pack at the schema layer. **The whole Brand & Print Studio pack (DS-1…DS-8) is
complete.** Future build-out (when prioritized): Remotion compositions + render worker + Motion
studio tab on top of this schema; and the deferred DS-7 Chromium print-PDF pipeline.
