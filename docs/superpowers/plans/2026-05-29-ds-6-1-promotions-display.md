# DS-6-1 Promotions Display — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps `- [ ]`.

**Goal:** `get_active_promotions` RPC + a self-fetching `PromotionsRail` shown on `/m/[slug]`.
**Branch:** `ds-6-1-promotions-display`. **Verify:** tsc/build + clone SQL (`rzrz-bukhari-test`).

## Files
- Create `apps/web/supabase/migrations/0066_get_active_promotions.sql`.
- Create `apps/web/app/m/[slug]/promotions-rail.tsx` (client, self-fetch).
- Modify `apps/web/app/m/[slug]/menu-experience.tsx` (import + 1-line insert after the VAT block).

## Task 1 — code (subagent writes files + tsc/build; MAIN applies migration + verifies + commits)

Migration `0066`:
```sql
-- MenuLink · 0066_get_active_promotions  (DS-6-1)
create or replace function public.get_active_promotions(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.priority desc, x.created_at desc), '[]'::jsonb)
  from (
    select pr.id, pr.title_ar, pr.subtitle_ar, pr.description_ar, pr.badge_text_ar,
           pr.image_url, pr.priority, pr.created_at
    from public.promotions pr
    join public.restaurants r on r.id = pr.restaurant_id
    where r.slug = p_slug and r.is_active and r.is_published
      and pr.is_active and pr.show_on_menu_home
      and (pr.starts_at is null or pr.starts_at <= now())
      and (pr.ends_at is null or pr.ends_at >= now())
  ) x;
$$;
grant execute on function public.get_active_promotions(text) to anon, authenticated;
```

`promotions-rail.tsx` and the `menu-experience.tsx` import + insertion are given verbatim in the
subagent dispatch (rail = client component fetching the RPC via `@/lib/supabase-browser`, rendering
offer cards via CSS vars; insertion right after the VAT-notice `</div></div>`).

- [ ] Subagent: write the migration file + `promotions-rail.tsx` + the 2 `menu-experience.tsx` edits; `tsc --noEmit` + `npm run build` (8192 heap) green.
- [ ] MAIN: review diff (rail isolated; menu-experience = +import +1 line); apply `0066` via PAT; insert a test promotion on `rzrz-bukhari-test`; `get_active_promotions('rzrz-bukhari-test')` returns it, an expired one is excluded, `get_active_promotions('koko')` = `[]`; commit.

## Task 2 — proof + PR + merge (MAIN)
- [ ] Proof `docs/proofs/DS-6-1-promotions-display.md`; push; draft PR (base main); merge+deploy.

## Self-Review
- RPC active-window + show_on_menu_home + priority order → migration. ✓
- Rail self-fetches, renders only when non-empty (no-promo tenants unchanged) → component + 1-line insert. ✓
- No prop-signature change to MenuExperience; `promotions` RLS untouched; clone-only verify. ✓
