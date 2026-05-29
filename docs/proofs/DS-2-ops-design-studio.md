# Proof · DS-2 — Ops Design Studio

- **Date:** 2026-05-29
- **Phase:** DS-2 (builds on DS-1; migration 0059 already live)
- **Branch:** `ds-2-ops-design-studio` (stacked on `ds-1-design-print-studio-foundation`)
- **Spec:** `docs/superpowers/specs/2026-05-29-ds-2-ops-design-studio-design.md`
- **Plan:** `docs/superpowers/plans/2026-05-29-ds-2-ops-design-studio.md`

## Goal

Give the platform operator a 4-tab studio at `/ops/tenants/[id]/design` to assign brand +
menu-page templates to a tenant, tune tokens, preview, and publish a versioned design
profile — with **no effect on the live customer menu** (that wiring is DS-3).

## Scope (delivered)

Four tabs only — **Overview, Brand Identity, Menu Page, Versions** — plus migration `0060`
(`updated_at` + publish RPC). No Print/QR/Promotions/Outputs tabs (not even placeholders),
no PDF/QR rendering, no promotions display, no `/m/[slug]` wiring, no Remotion, no POS.

## Files changed (all on branch `ds-2-ops-design-studio`)

```
A apps/web/supabase/migrations/0060_design_studio_publish.sql
A apps/web/lib/design/prefill.ts
A apps/web/app/ops/tenants/[id]/design/page.tsx
A apps/web/app/ops/tenants/[id]/design/overview-tab.tsx
A apps/web/app/ops/tenants/[id]/design/brand-identity-tab.tsx
A apps/web/app/ops/tenants/[id]/design/menu-page-tab.tsx
A apps/web/app/ops/tenants/[id]/design/versions-tab.tsx
M apps/web/app/ops/tenants/[id]/page.tsx   (one "Design Studio →" link; DesignForm untouched)
A docs/proofs/DS-2-ops-design-studio.md
```

Executed subagent-driven: one implementer subagent per task, main-agent review + verification
+ commit after each (8 commits). DB operations run by the main agent only.

## Migration 0060 (applied to live Supabase, project `dhmjrrsynfvomlzhggvu`)

- `restaurant_design_profiles.updated_at` column + `restaurant_design_profiles_set_updated_at`
  trigger (reuses existing `public.set_updated_at`).
- `public.publish_design_profile(uuid)` — `SECURITY DEFINER`, `set search_path = public`,
  guarded by `is_platform_admin()`, `pg_advisory_xact_lock` per tenant; archives the current
  published, promotes the target with a clean 1-based `version_number`. `grant execute … to
  authenticated`.
- Structural verify: `has_updated_at = 1`, `has_rpc = 1`.

## RPC verification (on `rzrz-bukhari-test` only — exact slug guard)

1. **Auth guard works:** calling the RPC with no auth JWT (Management API context) raised
   `not authorized` — the `is_platform_admin()` guard correctly rejects non-admins.
2. **Happy path (admin impersonation in a self-cleaning transaction):**
   - `is_platform_admin()` → `true`
   - publish #1 `version_number` → **1** (clean 1-based)
   - publish #2 `version_number` → **2**
   - published rows after two publishes → **1** (atomic archive-then-publish)
   - first profile status → **archived**
   - rows remaining for clone → **0** (self-cleaned)
3. Post-run independent check: `profiles_for_clone = 0`.

## Write paths & RLS

- Draft create/save (Brand Identity, Menu Page) and Duplicate use the browser Supabase client
  against `restaurant_design_profiles` through DS-1's ops RLS (`is_platform_admin()` write).
  These never write `restaurants`.
- Publish / Set-as-published call the `publish_design_profile` RPC only.
- Preview uses `resolveDesignTokens()` **inside the Ops studio only**.

## Build / type-check

- `npx tsc --noEmit` → clean.
- `npm run build` → SUCCESS; all routes compile, including the new `/ops/tenants/[id]/design`
  and the unchanged `/m/[slug]`, `/admin/qr`, `/admin/tables`, `/ops/tenants/[id]`.
  (One build worker OOM'd once under memory pressure; a clean re-run with a higher Node heap
  passed — environmental, not a code issue.)

## Guardrails verified

- **Production customer pages were NOT touched.** No reads/writes to `koko` or `rzrz-bukhari`;
  every DB write was on `rzrz-bukhari-test` and self-cleaned to 0 rows.
- `/m` (customer PWA) does **not** import `@/lib/design` (grep empty) → no live-menu behavior
  change; `resolveDesignTokens` is used only in the Ops studio.
- Existing `DesignForm` and the `restaurants` brand columns are unchanged; the tenant page got
  only a single link.
- Migration additive only; no destructive statements, no extensions, no hardcoded tenant UUIDs.
- No placeholder tabs beyond the temporary Task-3 stubs, which Tasks 4–6 fully replaced.

## Known limitations

- **Browser UI smoke not automated.** `/ops/tenants/[id]/design` requires an authenticated ops
  session (`requireOps`), so a headless smoke isn't possible here. The studio's behavior is
  covered by build/type-check (renders/compiles) + the DB-level RPC verification (publish
  semantics). Recommended manual check by the operator: open the studio for `rzrz-bukhari-test`,
  create a draft, preview, publish, confirm Versions — never on production tenants.
- No live menu effect until DS-3 wires the resolver into `/m/[slug]`.
- RLS *enforcement* (owner-can't-write) is not provable via the Management API (elevated role);
  it is exercised naturally by the authenticated browser client.

## Next phase

**DS-3 · Customer PWA Template Resolver** — make `/m/[slug]` read the published design profile
and apply resolved tokens (with safe fallback to the current theme).
