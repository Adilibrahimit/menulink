---
name: menulink-motion-assets
description: "Build and render MenuLink motion/video assets — promo reels, item spotlights, and offer stories as MP4s — using Remotion, wired to the DS-8 'motion arch-space' schema that already shipped (motion_templates / restaurant_motion_profiles / motion_exports). Use this skill whenever the task involves generating a video, reel, animated story, social clip, or motion asset for a restaurant tenant; implementing or finishing the deferred DS-8 Remotion render pipeline; rendering an MP4/WebM/GIF for a menu item or promotion; or anything mentioning 'motion asset', 'promo video', 'offer story', 'item spotlight', 'reel', 'animated menu', or 'Remotion'. This is the menulink-specific render layer — for general UI design use frontend-design/ui-ux-pro-max instead. Always read references/schema.md (the real DB shape) and references/remotion-setup.md before writing render code so compositions match the seeded composition_ids."
---

# MenuLink Motion Assets (DS-8)

DS-8 of the Brand & Print Studio reserved **architecture space** for motion/video but
deliberately shipped **no Remotion, no render worker, no UI** — only 3 tables + RLS +
3 global template seeds (migration `0068_motion_arch_space.sql`). This skill is how that
deferred pipeline gets built correctly: it binds Remotion compositions to the schema
that already exists, instead of inventing a new one.

**Before writing any code, read both reference files** — they are the source of truth:
- `references/schema.md` — the exact tables, columns, statuses, and seeded templates.
- `references/remotion-setup.md` — package layout, composition specs, render worker, CLI, and licensing.

## The contract that's already in the database

Three global `motion_templates` are seeded. Your Remotion compositions **must** be named
to match their `composition_id` exactly, or nothing lines up:

| `composition_id` | template key | format | dimensions | duration |
|---|---|---|---|---|
| `PromoReel` | `promo-reel-9-16-v1` | `reel_9_16` | 1080×1920 | 15s |
| `ItemSpotlight` | `item-spotlight-1-1-v1` | `square_1_1` | 1080×1080 | 8s |
| `OfferStory` | `offer-story-9-16-v1` | `story_9_16` | 1080×1920 | 10s |

Data flows template → tenant profile → export:
`motion_templates` (global, ops-managed) → `restaurant_motion_profiles` (per tenant,
draft/published, props_json) → `motion_exports` (per render: status, file_url, data_hash).

## Build order

1. **Scaffold** `packages/remotion-renderer/` per `references/remotion-setup.md`
   (compositions / components / data / render). Do NOT add Remotion to `apps/web` — the
   customer PWA must never carry a render dependency (DS-8 guardrail).
2. **Define the 3 compositions** with the exact ids, dimensions, fps (30), and
   `durationInFrames` from the table above. Drive everything off `defaultProps` typed
   to the props the templates expect.
3. **Bind tenant brand** — merge props in this order: `motion_templates.default_props_json`
   (base) ← `restaurant_motion_profiles.props_json` (tenant overrides) ← brand tokens
   pulled from the tenant's published `restaurant_design_profiles` (colors, fonts) so a
   reel looks like *that* restaurant, not a stock template. No hardcoded tenant data.
4. **Render as an async worker** (`render.ts`) using `@remotion/renderer`
   (`bundle` → `selectComposition` → `renderMedia`). Render is a background job —
   never during a page request, never blocking the PWA.
5. **Persist** — upload the MP4 to Supabase Storage, then write/patch the `motion_exports`
   row: `file_url`, `rendered_at`, `duration_ms`, and `status` through its lifecycle.
6. **Fingerprint for staleness** — compute `data_hash` from the resolved props + source
   item/offer data (mirror the DS-7 `get_export_fingerprint` pattern). When the hash
   changes, mark old exports `outdated` so they regenerate.

## Status lifecycle (enforced by a CHECK constraint)

`queued → rendering → rendered` on success; `→ failed` (set `error_message`) on error;
`→ outdated` when `data_hash` no longer matches current data. Add retry on `failed`.

## Guardrails (from the DS-8 spec — do not skip)

- **Async only.** Rendering happens off the request path; the PWA never waits on it.
- **Store outputs**, always set a render `status`, and support retry + failure state.
- **One published profile per tenant** is enforced by a partial unique index — respect it.
- **Licensing is a real gate.** Remotion is free for individuals and companies of ≤3
  people, but a paid **Company License** is required for larger teams, and MenuLink would
  be selling automated video generation as a service. Confirm the license is in place
  **before** shipping this as a paid tenant feature — the spec calls this out explicitly.
  See `references/remotion-setup.md` for the current terms to verify.

## Scope boundary

This skill renders motion assets. It does **not** touch `/m/[slug]` runtime, normal menu
cards, or PDF/QR export (those are DS-3/DS-5/DS-7). If the request is about static design
or print, it's the wrong skill.
