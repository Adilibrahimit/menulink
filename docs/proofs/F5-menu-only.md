# F5: Menu-Only Mode — Proof

**Date:** 2026-05-26
**Phase:** 1

## Files Changed

| File | Change |
|------|--------|
| `apps/web/supabase/migrations/0049_display_only_mode.sql` | New migration: `display_only_mode` column + RPC update |
| `apps/web/app/m/[slug]/display-only-menu.tsx` | New component: read-only menu renderer |
| `apps/web/app/m/[slug]/page.tsx` | Branch: if display_only_mode, render DisplayOnlyMenu |
| `apps/web/app/m/[slug]/types.ts` | Added `display_only_mode` to PublicRestaurant type |
| `apps/web/app/admin/layout.tsx` | Filtered nav + warning banner for display-only tenants |
| `apps/web/app/ops/tenants/[id]/page.tsx` | Pass displayOnlyMode prop to TenantActions |
| `apps/web/app/ops/tenants/[id]/tenant-actions.tsx` | Toggle with confirmation dialog |

## Migration Applied

`0049_display_only_mode.sql`:
- Added `display_only_mode boolean NOT NULL DEFAULT false` to `restaurants`
- Rewrote `get_public_menu()` RPC to include `display_only_mode` in JSON output

## Build Result

TypeScript type-check: PASSED (no errors)

## Test Tenant Verification

- `display_only_mode` enabled on `rzrz-bukhari-test` only
- Test URL: `/m/rzrz-bukhari-test` — will show display-only menu after deploy
- Admin URL: `/admin` as rzrz-bukhari-test owner — filtered nav + warning banner

## Production Safety

| Tenant | display_only_mode | Affected? |
|--------|------------------|-----------|
| koko | `false` | NOT modified |
| rzrz-bukhari | `false` | NOT modified |
| rzrz-bukhari-test | `true` | Test only |
| All other tenants | `false` (default) | NOT modified |
