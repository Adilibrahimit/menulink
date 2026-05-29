# DS-3B-1 Layout Resolver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a published design profile's menu-page-template drive `/m/[slug]`'s `ThemeConfig` layout flags (existing flag values only), with safe fallback.

**Architecture:** Migration `0063` extends the `get_published_design` RPC to also return the menu-page-template's `default_config_json` (as `menu_layout_config`) and seeds two template configs. A pure `resolveThemeLayout(base, config)` overrides only valid known flags; `page.tsx` applies it to the resolved `theme`. No component changes.

**Tech Stack:** Next.js 14 (server component), Supabase RPC (anon), `ThemeConfig` from `lib/themes.ts`, DS-1/2/3 design layer.

**Verification model (no JS test runner):** `tsc --noEmit`, `next build` (use `NODE_OPTIONS=--max-old-space-size=8192` — this machine OOMs static-gen at the default heap), SQL checks via the Management API PAT on `rzrz-bukhari-test` only, and a temp-compile Node assertion for the pure resolver. Never touch `koko`/`rzrz-bukhari`.

**Branch:** `ds-3b-1-layout-resolver` (off `main`; spec commit already there).

**Reference:** spec `docs/superpowers/specs/2026-05-29-ds-3b-1-layout-resolver-design.md`.

---

## File Structure

**Create**
- `apps/web/supabase/migrations/0063_design_layout_config.sql` — extend RPC + seed configs.
- `apps/web/lib/design/layout.ts` — `resolveThemeLayout(base, config)` (pure).

**Modify**
- `apps/web/app/m/[slug]/page.tsx` — import resolver; `const theme` → `let theme`; apply resolver after the `if (design)` block. No component changes.

---

## Task 1: Migration 0063 — extend RPC + seed layout configs

**Files:**
- Create: `apps/web/supabase/migrations/0063_design_layout_config.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- MenuLink · 0063_design_layout_config
--
-- DS-3B-1: extend get_published_design to also return the assigned menu-page-
-- template's layout config (menu_layout_config), and seed existing-flag configs
-- for the page templates. Additive; get_public_menu untouched; no schema change.
-- ============================================================================

create or replace function public.get_published_design(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'template_key',       bt.key,
    'template_name',      bt.name_ar,
    'template_tokens',    coalesce(bt.default_tokens_json, '{}'::jsonb),
    'profile_tokens',     coalesce(p.brand_tokens_json, '{}'::jsonb),
    'menu_page_key',      mt.key,
    'menu_layout_config', coalesce(mt.default_config_json, '{}'::jsonb)
  )
  from public.restaurants r
  join public.restaurant_design_profiles p
    on p.restaurant_id = r.id and p.status = 'published'
  left join public.brand_identity_templates bt on bt.id = p.brand_template_id
  left join public.menu_page_templates     mt on mt.id = p.menu_page_template_id
  where r.slug = p_slug and r.is_active and r.is_published
  limit 1;
$$;

grant execute on function public.get_published_design(text) to anon, authenticated;

update public.menu_page_templates set default_config_json =
  '{"categoryStyle":"pills","headerStyle":"dark-navy","cartBarStyle":"gold-navy","hasItemDetailSheet":true}'::jsonb
where key = 'premium-lounge-grid-v1';

update public.menu_page_templates set default_config_json =
  '{"categoryStyle":"tabs","headerStyle":"brand-filled","cartBarStyle":"brand-default","hasItemDetailSheet":false}'::jsonb
where key = 'fast-food-grid-v1';
```

- [ ] **Step 2: Static review**

Run:
```bash
cd /d/menulink && f=apps/web/supabase/migrations/0063_design_layout_config.sql; \
echo "rpc: $(grep -c 'create or replace function public.get_published_design' $f)"; \
echo "menu_layout_config: $(grep -c 'menu_layout_config' $f)"; \
echo "join menu_page: $(grep -c 'join public.menu_page_templates' $f)"; \
echo "seed updates: $(grep -c 'update public.menu_page_templates' $f)"; \
echo "destructive: $(grep -ciE 'drop table|truncate|delete from|create extension|alter table' $f)"
```
Expected: rpc=1, menu_layout_config=1, join menu_page=1, seed updates=2, destructive=0.

- [ ] **Step 3 (MAIN AGENT, DB): apply + verify**

Apply via the Management API PAT (token in `C:\Users\USER\.claude\projects\D--menulink\memory\reference_supabase_pat.md`, project `dhmjrrsynfvomlzhggvu`). Then:
```sql
select
  public.get_published_design('rzrz-bukhari-test') ? 'menu_layout_config' as has_key,
  public.get_published_design('koko') is null as koko_null,
  (select default_config_json from public.menu_page_templates where key='premium-lounge-grid-v1') as lounge_config;
```
Expected: `has_key=true`, `koko_null=true`, `lounge_config` = the pills/dark-navy/gold JSON.

- [ ] **Step 4: Commit**

```bash
cd /d/menulink && git add apps/web/supabase/migrations/0063_design_layout_config.sql && \
git commit -m "DS-3B-1: migration 0063 — get_published_design returns menu_layout_config + seed configs"
```

---

## Task 2: `resolveThemeLayout` helper

**Files:**
- Create: `apps/web/lib/design/layout.ts`

- [ ] **Step 1: Write the helper**

```ts
import type { ThemeConfig } from "../themes";

// Override only valid, known layout flags from a template's default_config_json over the base
// ThemeConfig. Unknown keys / invalid values are ignored, so a bad config can never break render.
export function resolveThemeLayout(base: ThemeConfig, config: unknown): ThemeConfig {
  if (!config || typeof config !== "object") return base;
  const c = config as Record<string, unknown>;
  const out: ThemeConfig = { ...base };
  if (c.menuLayout === "card-grid" || c.menuLayout === "heritage-list") out.menuLayout = c.menuLayout;
  if (c.categoryStyle === "pills" || c.categoryStyle === "tabs") out.categoryStyle = c.categoryStyle;
  if (c.menuCardStyle === "stitch-navy" || c.menuCardStyle === "default") out.menuCardStyle = c.menuCardStyle;
  if (c.headerStyle === "dark-navy" || c.headerStyle === "brand-filled") out.headerStyle = c.headerStyle;
  if (c.cartBarStyle === "gold-navy" || c.cartBarStyle === "brand-default") out.cartBarStyle = c.cartBarStyle;
  if (typeof c.hasItemDetailSheet === "boolean") out.hasItemDetailSheet = c.hasItemDetailSheet;
  if (c.bottomNavItems === 3 || c.bottomNavItems === 5) out.bottomNavItems = c.bottomNavItems;
  return out;
}
```

- [ ] **Step 2: Type-check**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Runtime assertion via temp-compile**

Write `C:\Users\USER\AppData\Local\Temp\ds3b1-test.cjs`:
```javascript
const B = "C:/Users/USER/AppData/Local/Temp/ds3b1build";
const { resolveThemeLayout } = require(B + "/design/layout.js");
const { getTheme } = require(B + "/themes.js");
let fail = 0; const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fail++; };
const base = getTheme("default"); // categoryStyle tabs, headerStyle brand-filled, cartBarStyle brand-default, hasItemDetailSheet false
ok("null config -> base", resolveThemeLayout(base, null).categoryStyle === "tabs");
ok("non-object -> base", resolveThemeLayout(base, "x").headerStyle === "brand-filled");
const r = resolveThemeLayout(base, { categoryStyle: "pills", headerStyle: "dark-navy", cartBarStyle: "gold-navy", hasItemDetailSheet: true, bottomNavItems: 5 });
ok("categoryStyle override", r.categoryStyle === "pills");
ok("headerStyle override", r.headerStyle === "dark-navy");
ok("cartBarStyle override", r.cartBarStyle === "gold-navy");
ok("hasItemDetailSheet override", r.hasItemDetailSheet === true);
ok("bottomNavItems override", r.bottomNavItems === 5);
ok("invalid value ignored", resolveThemeLayout(base, { categoryStyle: "bogus" }).categoryStyle === "tabs");
ok("unknown key ignored", resolveThemeLayout(base, { foo: "bar" }).headerStyle === "brand-filled");
ok("base not mutated", base.categoryStyle === "tabs");
process.exit(fail === 0 ? 0 : 1);
```
Run (compiles `themes.ts` + `layout.ts` together so the relative `../themes` import resolves):
```bash
cd /d/menulink/apps/web && rm -rf "/c/Users/USER/AppData/Local/Temp/ds3b1build" && \
npx tsc lib/themes.ts lib/design/layout.ts --outDir "/c/Users/USER/AppData/Local/Temp/ds3b1build" --module commonjs --moduleResolution node --target es2020 --skipLibCheck --esModuleInterop --jsx react-jsx && \
node "/c/Users/USER/AppData/Local/Temp/ds3b1-test.cjs"; \
rm -rf "/c/Users/USER/AppData/Local/Temp/ds3b1build" "/c/Users/USER/AppData/Local/Temp/ds3b1-test.cjs"
```
Expected: 10 × PASS, exit 0. (If `themes.ts` pulls a `.tsx`/JSX dependency the `--jsx react-jsx` flag covers it; it should not.)

- [ ] **Step 4: Commit**

```bash
cd /d/menulink && git add apps/web/lib/design/layout.ts && \
git commit -m "DS-3B-1: add resolveThemeLayout helper"
```

---

## Task 3: Wire `/m/[slug]/page.tsx`

**Files:**
- Modify: `apps/web/app/m/[slug]/page.tsx`

Three exact edits.

- [ ] **Step 1: Add the import**

Find:
```tsx
import { tokensToCssVars, googleFontsUrl } from "@/lib/design/css-vars";
```
Replace with:
```tsx
import { tokensToCssVars, googleFontsUrl } from "@/lib/design/css-vars";
import { resolveThemeLayout } from "@/lib/design/layout";
```

- [ ] **Step 2: Make `theme` reassignable**

Find:
```tsx
  const theme = getTheme(params.slug);
```
Replace with:
```tsx
  let theme = getTheme(params.slug);
```

- [ ] **Step 3: Apply the layout resolver after the design block**

Find:
```tsx
    profileFontsUrl = googleFontsUrl(resolved);
  }
```
Replace with:
```tsx
    profileFontsUrl = googleFontsUrl(resolved);
  }

  // DS-3B-1: a published profile's menu-page-template can override theme layout flags.
  theme = resolveThemeLayout(theme, (design as { menu_layout_config?: unknown } | null)?.menu_layout_config);
```

- [ ] **Step 4: Type-check + build**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=8192 npm run build`
Expected: tsc clean; build SUCCESS; `/m/[slug]` in the route list.

- [ ] **Step 5: Commit**

```bash
cd /d/menulink && git add ':(literal)apps/web/app/m/[slug]/page.tsx' && \
git commit -m "DS-3B-1: apply menu-page-template layout flags on /m/[slug]"
```

---

## Task 4: E2E verification, proof, PR (MAIN AGENT)

**Files:**
- Create: `docs/proofs/DS-3B-1-layout-resolver.md`

- [ ] **Step 1: Point the clone profile at premium-lounge-grid-v1 (clone only)**

Via the PAT (exact-slug guarded):
```sql
update public.restaurant_design_profiles p
set menu_page_template_id = (select id from public.menu_page_templates where key='premium-lounge-grid-v1')
from public.restaurants r
where p.restaurant_id = r.id and r.slug = 'rzrz-bukhari-test' and p.status = 'published';
```
If 0 rows updated (no published profile on the clone), STOP and report.

- [ ] **Step 2: Verify the RPC returns the config; production still null**

```sql
select
  public.get_published_design('rzrz-bukhari-test')->'menu_layout_config'->>'headerStyle' as clone_header,
  public.get_published_design('rzrz-bukhari-test')->>'menu_page_key' as clone_menu_page,
  public.get_published_design('koko') is null as koko_null,
  public.get_published_design('rzrz-bukhari') is null as rzrz_prod_null;
```
Expected: `clone_header='dark-navy'`, `clone_menu_page='premium-lounge-grid-v1'`, `koko_null=true`, `rzrz_prod_null=true`.

- [ ] **Step 3: tsc + build**

```bash
cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=8192 npm run build
```
Expected: clean + SUCCESS.

- [ ] **Step 4: Manual browser smoke (operator)**

Open `/m/rzrz-bukhari-test` → category **pills** + **dark-navy** header + **gold** cart bar + item-detail sheet on tap. Spot-check `/m/koko` unchanged (tabs / brand-filled).

- [ ] **Step 5: Proof + commit + push + draft PR**

Create `docs/proofs/DS-3B-1-layout-resolver.md` (Goal · Scope · Files · Migration 0063 · RPC verification (clone config, production null) · resolver assertions · fallback · build/tsc · Guardrails incl. **production not touched, no component/order-flow changes** · Known limitations (only existing flags; `menuLayout` display-only-only; premium presentation = DS-3B-2) · Next phase DS-3B-2). Then:
```bash
cd /d/menulink && git add docs/proofs/DS-3B-1-layout-resolver.md && \
git commit -m "DS-3B-1: proof doc" && git push -u origin ds-3b-1-layout-resolver
gh pr create --base main --head ds-3b-1-layout-resolver \
  --title "DS-3B-1: layout resolver (profile menu-page-template -> theme flags)" \
  --body "Implements DS-3B-1 per docs/superpowers/specs/2026-05-29-ds-3b-1-layout-resolver-design.md. Migration 0063 extends get_published_design to return menu_layout_config + seeds template configs; resolveThemeLayout merges valid existing flags over getTheme; /m/[slug] applies it with safe fallback. No component/order-flow changes. Verified on rzrz-bukhari-test; koko/rzrz-bukhari unchanged. Premium presentation = DS-3B-2."
```

---

## Self-Review

**Spec coverage:**
- Migration 0063 (extend RPC + seed configs) → Task 1. ✓
- Layout-flag schema (safe subset) → Task 2 `resolveThemeLayout` (the exact 7 flags). ✓
- Resolver helper → Task 2. ✓
- Wiring in page.tsx (import, `let theme`, apply after design block) → Task 3 (3 edits). ✓
- Fallback (null/invalid → base) → Task 2 logic + Task 3 (resolver handles `?.` undefined). ✓
- Seed premium-lounge / fast-food configs → Task 1. ✓
- Clone-only verification; production null → Tasks 1 & 4. ✓

**Placeholder scan:** none — all code complete; Task 4 Step 1 has an explicit STOP-if-0-rows guard, not a placeholder.

**Type consistency:** RPC key `menu_layout_config` matches between Task 1 SQL and Task 3's `(design as { menu_layout_config?: unknown })`. `resolveThemeLayout(base, config)` signature matches Task 2 ↔ Task 3 import/call. Flag names/values in `resolveThemeLayout` match `ThemeConfig`'s literal unions in `lib/themes.ts` (`menuLayout`, `categoryStyle`, `menuCardStyle`, `headerStyle`, `cartBarStyle`, `hasItemDetailSheet`, `bottomNavItems`). The `../themes` relative import in `layout.ts` is what makes the Task 2 temp-compile resolve.
