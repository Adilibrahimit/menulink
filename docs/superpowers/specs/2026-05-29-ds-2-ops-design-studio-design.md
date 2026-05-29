# DS-2 · Ops Design Studio — Design Spec

- **Date:** 2026-05-29
- **Phase:** DS-2 of the Brand & Print Studio initiative (builds on DS-1 foundation, migration 0059)
- **Status:** Approved design, pre-implementation
- **Depends on:** DS-1 (`restaurant_design_profiles`, `brand_identity_templates`, `menu_page_templates`, `lib/design/*`) — code on branch `ds-1-design-print-studio-foundation` (PR #1); migration 0059 already applied to live Supabase.

## Context

DS-1 added the data model + pure helper layer but no UI. DS-2 gives the platform operator
an authoring surface to assign a brand identity + menu-page template to a tenant, tune tokens,
preview, and publish a versioned **design profile** — without affecting the live customer
menu (that wiring is DS-3). This is what makes the templates usable.

The existing `/ops/tenants/[id]` page has an inline "التصميم البصري" (`DesignForm`) that writes
`name/slug/logo/cover/primary_color/background_color` straight to `restaurants`, and those
columns are what `/m/[slug]` renders today. DS-2 must **not** disturb that.

## Scope

**In scope (4 tabs only):** Overview, Brand Identity, Menu Page, Versions — plus the publish
RPC and one additive migration. Fully satisfies the DS-2 acceptance list (select templates,
save draft, publish, archive old, customer PWA stable).

**Out of scope:** Print / QR / Promotions / Outputs tabs (DS-4/5/6/7) — **not even placeholder
tabs**; PDF/PNG/SVG/QR rendering; promotions display; `/m/[slug]` resolver wiring (DS-3);
Remotion; POS; tenant self-service writes; any change to production tenants.

## Guardrails

- Do not touch production tenants `koko` or `rzrz-bukhari`. Any smoke/write test uses
  `rzrz-bukhari-test` only.
- Do not wire DS-2 into `/m/[slug]` (DS-3). `resolveDesignTokens()` is used **only** inside Ops.
- Do not write profile token changes back into `restaurants`.
- Keep the existing `DesignForm` intact — not deleted, not trimmed.
- Additive only; no unrelated files modified; no secrets printed.
- The database remains the source of truth for "one published profile per tenant" (the DS-1
  partial-unique index is the final invariant).

## Architecture

### Placement & navigation (decision A1)

A dedicated sub-route **`/ops/tenants/[id]/design`** hosts the 4-tab studio. The main tenant
page (`/ops/tenants/[id]/page.tsx`) is untouched except for **one added link** ("Design Studio
→"). The existing `DesignForm` stays exactly where it is on the main page.

Tabs are server-rendered and selected via `?tab=` (default `overview`), deep-linkable. The
studio `page.tsx` is a server component (`requireOps()`, loads data) that renders the active
tab; interactive tabs delegate to client components, matching the existing server-page +
client-form pattern (`DesignForm`, `AddonManager`).

### Data layer — additive migration `0060_design_studio_publish.sql`

1. **`updated_at` on profiles** (Versions tab needs it; DS-1 only added `created_at`):
   ```sql
   alter table public.restaurant_design_profiles
     add column if not exists updated_at timestamptz not null default now();

   drop trigger if exists restaurant_design_profiles_set_updated_at
     on public.restaurant_design_profiles;
   create trigger restaurant_design_profiles_set_updated_at
     before update on public.restaurant_design_profiles
     for each row execute function public.set_updated_at();  -- existing fn (0001)
   ```

2. **Atomic publish RPC** (`SECURITY DEFINER`, fixed `search_path`, platform-admin guarded,
   tenant-level advisory lock so concurrent publishes serialize):
   ```sql
   create or replace function public.publish_design_profile(p_profile_id uuid)
   returns public.restaurant_design_profiles
   language plpgsql
   security definer
   set search_path = public
   as $$
   declare
     v_rid uuid;
     v_row public.restaurant_design_profiles;
   begin
     if not public.is_platform_admin() then
       raise exception 'not authorized';
     end if;

     select restaurant_id into v_rid
       from public.restaurant_design_profiles where id = p_profile_id;
     if v_rid is null then
       raise exception 'profile % not found', p_profile_id;
     end if;

     -- serialize publishes for this tenant
     perform pg_advisory_xact_lock(hashtextextended(v_rid::text, 0));

     -- archive currently-published (if any other than the target)
     update public.restaurant_design_profiles
        set status = 'archived'
      where restaurant_id = v_rid
        and status = 'published'
        and id <> p_profile_id;

     -- publish target with bumped version
     update public.restaurant_design_profiles
        set status = 'published',
            published_at = now(),
            version_number = coalesce(
              (select max(version_number) from public.restaurant_design_profiles
                where restaurant_id = v_rid
                  and status in ('published', 'archived')), 0) + 1
      where id = p_profile_id
      returning * into v_row;

     return v_row;
   end;
   $$;

   grant execute on function public.publish_design_profile(uuid) to authenticated;
   ```
   Archive-then-publish ordering means the partial-unique index never sees two `published`
   rows. The advisory lock prevents a race between two concurrent publishes for the same tenant.

   **Version-number nuance (decide at spec review):** the formula above takes `max` over *all*
   the tenant's rows, including the target. Since drafts default to `version_number = 1`, a
   tenant's very first publish becomes **v2**, not v1. If clean 1-based published versions are
   preferred, scope the `max` to already-published history instead —
   `where restaurant_id = v_rid and status in ('published','archived')` (first publish → v1).
   Spec currently assumes the latter (clean 1-based) unless you say otherwise.

### The four tabs

- **Overview** — read-only: current published profile (template, version, `published_at`) and
  draft status; link to the existing "Brand basics" form on the main page. No editing here.
- **Brand Identity** — the core tab:
  - Select a brand template (5 seeded: koko-bold / rzrz-navy / velora-premium / standard-clean /
    cafe-minimal).
  - Token editor **pre-filled on draft create/reset** from (1) selected template defaults, then
    (2) restaurant's current `primary_color`/`background_color`; logo/cover shown for preview
    context only. Pre-fill is one-shot, **not** continuous two-way sync.
  - **Preview** panel built with `resolveDesignTokens()` — color swatches, typography names,
    radius. Ops-only.
  - **"Reset from current live brand"** action — re-seeds draft colors from `restaurants`.
  - Persistent note: *"هذه المسودة لا تؤثر على صفحة العميل الحالية حتى يتم ربطها في DS-3."*
  - Actions: **Save draft** (writes `brand_template_id` + `brand_tokens_json`, `status='draft'`)
    and **Publish** (RPC).
- **Menu Page** — select a menu-page template (2 seeded), saved onto the draft
  (`menu_page_template_id`, optional `menu_tokens_json`). Shows `layout_type` +
  `supported_business_types` for context.
- **Versions** — lists all profiles for the tenant (draft/published/archived) with version #,
  status, brand template, menu-page template, `updated_at`, `published_at`. Actions:
  **Set as published** (same RPC — works on a draft or archived row → re-publish) and
  **Duplicate to new draft**. **No manual archive button** (archiving is implicit via publish).

### Write paths & RLS

- **Draft create/save** — browser client (`@/lib/supabase-browser`)
  `.from('restaurant_design_profiles').insert/update(...)` through the existing DS-1 ops RLS
  (`*_ops_all` = `is_platform_admin()`). Never writes `restaurants`. No live-menu effect.
- **Publish / set-as-published** — the `publish_design_profile` RPC only (never client-side
  archive+publish sequencing).
- **Duplicate to new draft** — client insert of a new row (`status='draft'`, copied
  template/token fields, `version_number` left at default until publish).

### Preview

`resolveDesignTokens({ templateTokens, profileTokens })` from `lib/design/resolver.ts`, rendered
in the Brand Identity tab only. First real consumer of the resolver; `/m/[slug]` remains on the
legacy theme path until DS-3.

## Files

**Create**
- `apps/web/supabase/migrations/0060_design_studio_publish.sql`
- `apps/web/app/ops/tenants/[id]/design/page.tsx` (server: requireOps, load profiles +
  templates, render active tab)
- `apps/web/app/ops/tenants/[id]/design/brand-identity-tab.tsx` (client)
- `apps/web/app/ops/tenants/[id]/design/menu-page-tab.tsx` (client)
- `apps/web/app/ops/tenants/[id]/design/versions-tab.tsx` (client)
- `apps/web/app/ops/tenants/[id]/design/overview-tab.tsx` (can be server)
- Possibly `apps/web/lib/design/prefill.ts` — helper to build draft tokens from a template +
  restaurant brand fields (pure; reuses `mergeTokens`).

**Modify (minimal)**
- `apps/web/app/ops/tenants/[id]/page.tsx` — add one "Design Studio →" link.
- `apps/web/lib/design/types.ts` — only if a small shared type is needed (e.g. publish result);
  otherwise reuse existing row types.

## Testing

- `npx tsc --noEmit` + `npm run build` green.
- Migration 0060 applied to live Supabase via Management API PAT (additive: column + trigger +
  function).
- **RPC verification on `rzrz-bukhari-test` only:** create draft → publish → confirm previous
  published archived and exactly one `published` row remains → publish a second draft → confirm
  the first flips to archived → clean up test rows. Confirm `is_platform_admin()` guard rejects
  a non-admin (best-effort; the Management API runs elevated, so RLS-enforcement nuance is noted
  as in DS-1).
- Manual studio smoke (draft/preview/publish/versions) against `rzrz-bukhari-test`.
- Regression: production tenants and `/m/[slug]` rendering unchanged (no reads from profiles).

## Acceptance criteria (DS-2)

- [ ] Ops can select brand + menu-page templates for a tenant.
- [ ] Ops can save a draft design profile.
- [ ] Ops can publish a design profile; the previously published one is archived atomically.
- [ ] Versions tab lists draft/published/archived with set-as-published + duplicate actions.
- [ ] Exactly one published profile per tenant is enforced by the DB.
- [ ] Customer PWA (`/m/[slug]`) unchanged; existing `DesignForm` intact.
- [ ] Build + type-check pass; verification done on `rzrz-bukhari-test`.

## Open questions

None — all decisions resolved during brainstorming (scope = 4 tabs, A1 sub-route, clear-split
with pre-fill, advisory-locked publish RPC, no live wiring).
