# DS-8 Motion Schema (the real shape)

Source of truth: `apps/web/supabase/migrations/0068_motion_arch_space.sql`. This is
**arch-space only** — the tables, RLS, and 3 seeds exist; no app code reads them yet.
Build against these exact names; do not invent new tables.

## `motion_templates` (GLOBAL, ops-managed)

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `key` | text unique | e.g. `promo-reel-9-16-v1` |
| `name_ar` | text NOT NULL | Arabic name (Arabic-first product) |
| `name_en` | text | |
| `format` | text CHECK | one of `reel_9_16`, `square_1_1`, `story_9_16`, `landscape_16_9` |
| `composition_id` | text | **must equal the Remotion composition id** |
| `duration_seconds` | int default 15 | |
| `default_props_json` | jsonb default `{}` | base props for the composition |
| `supported_tiers` | text[] | subset of `standard`/`pro`/`premium` |
| `is_active` | bool default true | |
| `created_at` | timestamptz | |

### Seeded rows (already in every environment)

| key | name_en | format | composition_id | duration | tiers |
|---|---|---|---|---|---|
| `promo-reel-9-16-v1` | Promo Reel | `reel_9_16` | `PromoReel` | 15 | standard, pro, premium |
| `item-spotlight-1-1-v1` | Item Spotlight | `square_1_1` | `ItemSpotlight` | 8 | pro, premium |
| `offer-story-9-16-v1` | Offer Story | `story_9_16` | `OfferStory` | 10 | standard, pro, premium |

## `restaurant_motion_profiles` (TENANT)

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK → restaurants(id) ON DELETE CASCADE | |
| `motion_template_id` | uuid FK → motion_templates(id) | |
| `name_ar` | text NOT NULL | |
| `props_json` | jsonb default `{}` | tenant overrides merged over template defaults |
| `status` | text CHECK (`draft`/`published`) default `draft` | |
| `created_by` | uuid | soft ref auth.users(id) |
| `created_at` / `updated_at` | timestamptz | |

Partial unique index `ux_restaurant_motion_profiles_one_published`:
**only one `published` profile per restaurant**. Respect this when publishing.

## `motion_exports` (TENANT, one row per render)

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK → restaurants(id) | |
| `motion_profile_id` | uuid FK → restaurant_motion_profiles(id) ON DELETE SET NULL | |
| `export_type` | text CHECK (`mp4`/`gif`/`webm`) | |
| `file_url` | text | set after Storage upload |
| `data_hash` | text NOT NULL | fingerprint of resolved props + source data |
| `status` | text CHECK (`queued`/`rendering`/`rendered`/`failed`/`outdated`) default `queued` | |
| `error_message` | text | set on `failed` |
| `duration_ms` | int | actual render wall-time |
| `rendered_at` | timestamptz | set on success |
| `created_at` | timestamptz | |

## RLS (already enabled on all three)

- `motion_templates`: ops (`is_platform_admin()`) full; authenticated read where `is_active`.
- `restaurant_motion_profiles` & `motion_exports`: ops full; restaurant owner
  (`owns_restaurant(restaurant_id)`) **read-only**.

→ Writes (queue/render/patch status) happen through an ops/service path, not the owner
client. A render worker should use the service role (bypasses RLS) or an ops-authenticated
server action — mirror how DS-7 export writes are done.

## Where brand tokens come from

Pull the tenant's published design profile (DS-1/DS-3) for colors + fonts:
`restaurant_design_profiles` (joined to `brand_identity_templates` /
`menu_page_templates`). Resolve these into the composition props so a reel matches the
restaurant's identity. Use `apps/web/lib/design/` resolver helpers rather than re-deriving.
