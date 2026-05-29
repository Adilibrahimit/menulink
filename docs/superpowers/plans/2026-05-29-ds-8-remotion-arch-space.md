# DS-8 Remotion Architecture-Space — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Schema-only; executed directly
> (mirrors DS-1's verify-by-static-review-and-apply flow). Steps `- [ ]`.

**Goal:** Reserve the DB space for a future motion/video feature (3 tables + RLS + 3 global seeds).
No Remotion install, no app code, no UI. **Branch:** `ds-8-remotion-arch-space`. **Migration:** 0068.

## Files
- Create `apps/web/supabase/migrations/0068_motion_arch_space.sql` (motion_templates +
  restaurant_motion_profiles + motion_exports + indexes + RLS + 3 seeds).
- Create `docs/proofs/DS-8-remotion-arch-space.md` (proof + architecture doc).

## Task 1 — migration (done in-session)
- [ ] Write 0068 mirroring DS-1 conventions (`if not exists`, text+check, `gen_random_uuid()`,
      ops_all + auth_read/owner_read RLS, idempotent `on conflict (key)` seeds).
- [ ] MAIN review: additive only; RLS on all 3; no existing object touched; no tenant rows. Commit.

## Task 2 — apply + verify + proof + PR (MAIN)
- [ ] Apply 0068 to live via PAT (additive). Verify: 3 motion_templates seeded;
      `restaurant_motion_profiles` and `motion_exports` counts = 0 (no tenant data); re-apply is
      idempotent (seed `on conflict`).
- [ ] `tsc`/`build` unaffected (no app code) — spot-confirm build still green.
- [ ] Proof `docs/proofs/DS-8-remotion-arch-space.md`; push; PR (base main); merge+deploy.

## Self-Review
- 3 tables (template/profile/export) mirror DS-1 shape → Task 1 ✓ · RLS reuses helpers ✓ ·
  global seeds only, production untouched ✓ · no Remotion/app code/UI (pack instruction) ✓.
- This closes the DS-1…DS-8 pack at the schema layer; the live feature (Remotion comps + render
  worker + Motion tab) and the deferred DS-7 Chromium PDF are documented future work.
