# Proof + Architecture · DS-8 — Remotion Architecture-Space

- **Date:** 2026-05-29 · **Phase:** DS-8 (final) · **Branch:** `ds-8-remotion-arch-space` ·
  **Migration:** 0068
- **Spec/Plan:** `docs/superpowers/specs/2026-05-29-ds-8-remotion-arch-space-design.md` ·
  `docs/superpowers/plans/2026-05-29-ds-8-remotion-arch-space.md`

## What this is (and is not)

Per the pack: **"do not install Remotion; only leave architecture space."** DS-8 therefore ships the
**database foundation only** for a future motion/video feature — and nothing else. **Not** built:
Remotion install, compositions, a render worker/queue, rendered-file storage, an Ops "Motion" tab,
fingerprint-driven regeneration. The schema reserves the space; the feature is future work.

## Files changed

```
A apps/web/supabase/migrations/0068_motion_arch_space.sql   (3 tables + indexes + RLS + 3 global seeds)
A docs/proofs/DS-8-remotion-arch-space.md
```

No app code, no dependencies, no UI, no `/m` or `/ops` changes.

## Schema (mirrors the DS-1 template → profile → export pattern)

- **`motion_templates`** (GLOBAL) — `key` unique, `name_ar/en`, `format`
  ∈ {`reel_9_16`,`square_1_1`,`story_9_16`,`landscape_16_9`}, `composition_id` (future Remotion
  composition name), `duration_seconds`, `default_props_json`, `supported_tiers[]`, `is_active`.
- **`restaurant_motion_profiles`** (TENANT) — `restaurant_id`, `motion_template_id`, `name_ar`,
  `props_json` (per-tenant overrides: featured items/promotions, brand tokens), `status`
  ∈ {`draft`,`published`}, `created_by`, timestamps. Partial-unique one published per restaurant.
- **`motion_exports`** (TENANT) — `restaurant_id`, `motion_profile_id`, `export_type`
  ∈ {`mp4`,`gif`,`webm`}, `file_url`, `data_hash` (reuse DS-7's `get_export_fingerprint` for
  outdated-detection), `status` ∈ {`queued`,`rendering`,`rendered`,`failed`,`outdated`},
  `error_message`, `duration_ms`, `rendered_at`.

**RLS (exactly DS-1's pattern):** templates = `ops_all` + `auth_read(is_active)`; both tenant tables
= `ops_all` + `owner_read(owns_restaurant(restaurant_id))`; writes ops-only.

## Intended future pipeline (the reserved architecture)

1. Ops creates a `restaurant_motion_profile` from a `motion_template`, choosing featured
   items/promotions; `props_json` carries the data + the tenant's design tokens
   (`get_published_design`).
2. A **render worker** (Remotion `renderMedia`, run off-Vercel — a container/Lambda, since headless
   rendering is heavy) reads the profile, renders the `composition_id`, uploads the `mp4/gif` to
   storage, and writes a `motion_exports` row (`status`, `file_url`, `data_hash`, `duration_ms`).
3. Outdated-detection reuses the DS-7 fingerprint: when `data_hash` ≠ current
   `get_export_fingerprint(slug)`, the export is stale → re-render.

This deliberately lives **outside** the Vercel request path (same reasoning that deferred DS-7's
Chromium PDF): video rendering is too heavy/long for serverless functions.

## Verification

- **Static review:** 3 `create table if not exists`; RLS enabled on all 3; 3 seed keys with
  `on conflict (key) do update`; partial-unique index present; no destructive/extension/hardcoded-UUID
  statements; reuses `is_platform_admin()` / `owns_restaurant()`.
- **Applied to live** (`dhmjrrsynfvomlzhggvu`) via the Management API → `motion_templates` = **3**
  (`item-spotlight-1-1-v1, offer-story-9-16-v1, promo-reel-9-16-v1`);
  `restaurant_motion_profiles` = **0**; `motion_exports` = **0** (no tenant data; production
  untouched). Idempotent (seed `on conflict`).
- **Build:** no app code changed; the migration is not imported by the Next build → build unaffected
  (DS-7's build was green at merge).

## Guardrails verified

Purely additive (3 new tables + RLS + 3 global rows). No Remotion, no deps, no UI, no public surface,
no existing object touched, no tenant rows. KO-KO / RzRz / Mazaj unaffected.

## Next — pack complete

**DS-1…DS-8 of the Brand & Print Studio pack are complete** (foundation → ops studio → PWA resolver →
QR/`/q` → A3/A4 print → promotions display+CRUD → export management → motion arch-space). Documented
future work, when prioritized:
- **DS-7 deferred infra:** server-side Chromium print-PDF + `print_exports` storage + regenerate worker.
- **DS-8 feature build-out:** Remotion compositions + off-Vercel render worker + Ops Motion studio tab.
