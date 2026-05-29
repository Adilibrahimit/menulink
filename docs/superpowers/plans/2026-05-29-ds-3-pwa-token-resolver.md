# DS-3 Customer PWA Token Resolver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a tenant's published design profile's **colors + fonts** to `/m/[slug]`, with a safe fallback to today's theme when no profile is published; layout untouched.

**Architecture:** Additive migration `0061` adds a `SECURITY DEFINER` RPC `get_published_design(p_slug)` (anon-callable) returning `{ template_tokens, profile_tokens, … }` or null. A pure helper `lib/design/css-vars.ts` maps resolved tokens → the PWA's CSS-var palette + a Google-Fonts URL. `m/[slug]/page.tsx` calls the RPC, resolves via DS-1 `resolveDesignTokens`, merges the mapped vars over `buildCssVars(...)`, and injects the profile fonts link — in both render paths. No change to `get_public_menu`, layout, or component branching.

**Tech Stack:** Next.js 14 (server components), Supabase (Postgres RPC, anon client), Tailwind CSS-var theming, DS-1 `lib/design/*`.

**Verification model (no JS test runner):** `tsc --noEmit`, `next build`, SQL checks via the Management API PAT on `rzrz-bukhari-test` only, temp-compile Node assertion for the pure helper, and a manual browser smoke (clone only). Never touch production tenants `koko`/`rzrz-bukhari`.

**Branch:** `ds-3-pwa-token-resolver` (stacked on `ds-2-ops-design-studio`; spec commit already there).

**Reference:** spec `docs/superpowers/specs/2026-05-29-ds-3-pwa-token-resolver-design.md`.

---

## File Structure

**Create**
- `apps/web/supabase/migrations/0061_get_published_design.sql` — the RPC.
- `apps/web/lib/design/css-vars.ts` — `tokensToCssVars(tokens)` + `googleFontsUrl(tokens)` (pure).

**Modify**
- `apps/web/app/m/[slug]/page.tsx` — imports + data-load (RPC call, resolve, merge) + a profile fonts `<link>` in each of the two render paths. No other change; layout/flags via `getTheme` untouched.

**Data-flow:** RPC (bypasses RLS for anon) → `resolveDesignTokens({templateTokens, profileTokens})` (DS-1) → `tokensToCssVars` → `{ ...buildCssVars(...), ...mapped }`. Null RPC result → today's behavior verbatim.

---

## Task 1: Migration 0061 — `get_published_design` RPC

**Files:**
- Create: `apps/web/supabase/migrations/0061_get_published_design.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- MenuLink · 0061_get_published_design
--
-- DS-3 support. Additive: one SECURITY DEFINER, anon-callable function that
-- returns the published design profile's tokens for a slug (or null). Lets the
-- public customer page read design data without a public RLS policy on
-- restaurant_design_profiles. No table changes; get_public_menu untouched.
-- ============================================================================

create or replace function public.get_published_design(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'template_key',    bt.key,
    'template_name',   bt.name_ar,
    'template_tokens', coalesce(bt.default_tokens_json, '{}'::jsonb),
    'profile_tokens',  coalesce(p.brand_tokens_json, '{}'::jsonb)
  )
  from public.restaurants r
  join public.restaurant_design_profiles p
    on p.restaurant_id = r.id and p.status = 'published'
  left join public.brand_identity_templates bt
    on bt.id = p.brand_template_id
  where r.slug = p_slug
    and r.is_active
    and r.is_published
  limit 1;
$$;

grant execute on function public.get_published_design(text) to anon, authenticated;
```

- [ ] **Step 2: Static review**

Run:
```bash
cd /d/menulink && f=apps/web/supabase/migrations/0061_get_published_design.sql; \
echo "fn: $(grep -c 'create or replace function public.get_published_design' $f)"; \
echo "definer: $(grep -c 'security definer' $f)"; \
echo "grant anon: $(grep -c 'to anon, authenticated' $f)"; \
echo "touches get_public_menu: $(grep -c 'get_public_menu' $f)"; \
echo "destructive/ext: $(grep -ciE 'drop table|truncate|delete from|create extension|alter table' $f)"
```
Expected: fn=1, definer=1, grant anon=1, touches get_public_menu=0, destructive/ext=0.

- [ ] **Step 3 (MAIN AGENT, DB): apply to live + verify null for production**

Apply via the Management API PAT (read the token from `C:\Users\USER\.claude\projects\D--menulink\memory\reference_supabase_pat.md`, project `dhmjrrsynfvomlzhggvu`). Then run:
```sql
select
  public.get_published_design('koko')               as koko,
  public.get_published_design('rzrz-bukhari')        as rzrz_prod,
  public.get_published_design('rzrz-bukhari-test')   as clone;
```
Expected: all three **null** (no published profiles yet) — confirms production pages are unaffected.

- [ ] **Step 4: Commit**

```bash
cd /d/menulink && git add apps/web/supabase/migrations/0061_get_published_design.sql && \
git commit -m "DS-3: migration 0061 — get_published_design RPC"
```

---

## Task 2: `css-vars.ts` mapping helper

**Files:**
- Create: `apps/web/lib/design/css-vars.ts`

- [ ] **Step 1: Write the helper**

```typescript
// Map resolved design tokens to the PWA's existing CSS-variable palette, and
// build a Google-Fonts URL for the profile's heading/body fonts. Pure — DS-3.
// Only emits a var when its source token is a non-empty string, so callers can
// safely merge the result over buildCssVars(...) without blanking base vars.

import type { DesignTokens } from "./types";

export function tokensToCssVars(tokens: DesignTokens): Record<string, string> {
  const c = (tokens?.colors ?? {}) as Record<string, string | undefined>;
  const vars: Record<string, string> = {};
  const set = (k: string, v: string | undefined) => {
    if (typeof v === "string" && v.trim()) vars[k] = v;
  };
  set("--brand", c.primary);
  set("--bg", c.background);
  set("--ink", c.text);
  set("--card-bg", c.surface);
  set("--text-secondary", c.muted);
  set("--accent-gold", c.accent);
  set("--price-color", c.primary);
  set("--header-bg", c.primary);
  set("--cta-bg", c.primary);
  const t = tokens?.typography;
  if (t?.heading?.trim()) vars["--font-display"] = `${t.heading}, system-ui, sans-serif`;
  if (t?.body?.trim()) vars["--font-body"] = `${t.body}, system-ui, sans-serif`;
  return vars;
}

// Fonts that are not Google-hosted (or are CSS keywords) are skipped.
const SKIP_FONTS = new Set(["geist", "system-ui", "sans-serif", "serif", "monospace", "inherit"]);

export function googleFontsUrl(tokens: DesignTokens): string | null {
  const raw = [tokens?.typography?.heading, tokens?.typography?.body];
  const names = Array.from(
    new Set(
      raw
        .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
        .map((n) => n.trim())
        .filter((n) => !SKIP_FONTS.has(n.toLowerCase())),
    ),
  );
  if (names.length === 0) return null;
  const families = names
    .map((n) => `family=${encodeURIComponent(n).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
```

- [ ] **Step 2: Type-check**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Runtime assertion via temp-compile**

Write `C:\Users\USER\AppData\Local\Temp\ds3-cssvars-test.cjs`:
```javascript
const B = "C:/Users/USER/AppData/Local/Temp/ds3build";
const { tokensToCssVars, googleFontsUrl } = require(B + "/css-vars.js");
let fail = 0; const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fail++; };
const tk = { colors: { background: "#061A3A", surface: "#FFFFFF", primary: "#C8A15A", accent: "#F7C948", text: "#0B1220", muted: "#6B7280" }, typography: { heading: "Alexandria", body: "Cairo", latin: "Geist" }, mood: "navy" };
const v = tokensToCssVars(tk);
ok("--brand from primary", v["--brand"] === "#C8A15A");
ok("--bg from background", v["--bg"] === "#061A3A");
ok("--card-bg from surface", v["--card-bg"] === "#FFFFFF");
ok("--text-secondary from muted", v["--text-secondary"] === "#6B7280");
ok("--accent-gold from accent", v["--accent-gold"] === "#F7C948");
ok("--font-display has fallback", v["--font-display"] === "Alexandria, system-ui, sans-serif");
ok("no header-text emitted (kept from base)", !("--header-text" in v));
const noAccent = tokensToCssVars({ colors: { background: "#fff", surface: "#fff", primary: "#000", text: "#000", muted: "#777" }, typography: { heading: "Tajawal", body: "Cairo", latin: "Geist" } });
ok("accent omitted when absent", !("--accent-gold" in noAccent));
const url = googleFontsUrl(tk);
ok("fonts url includes Alexandria", !!url && url.includes("family=Alexandria"));
ok("fonts url includes Cairo", !!url && url.includes("family=Cairo"));
ok("fonts url skips Geist (latin)", !!url && !url.includes("Geist"));
ok("fonts url null when only skipped fonts", googleFontsUrl({ colors: tk.colors, typography: { heading: "Geist", body: "system-ui", latin: "Geist" } }) === null);
process.exit(fail === 0 ? 0 : 1);
```
Run:
```bash
cd /d/menulink/apps/web && rm -rf "/c/Users/USER/AppData/Local/Temp/ds3build" && \
npx tsc lib/design/types.ts lib/design/css-vars.ts --outDir "/c/Users/USER/AppData/Local/Temp/ds3build" --module commonjs --moduleResolution node --target es2020 --skipLibCheck --esModuleInterop && \
node "/c/Users/USER/AppData/Local/Temp/ds3-cssvars-test.cjs"; \
rm -rf "/c/Users/USER/AppData/Local/Temp/ds3build" "/c/Users/USER/AppData/Local/Temp/ds3-cssvars-test.cjs"
```
Expected: 11 × PASS, exit 0.

- [ ] **Step 4: Commit**

```bash
cd /d/menulink && git add apps/web/lib/design/css-vars.ts && \
git commit -m "DS-3: add tokensToCssVars + googleFontsUrl helper"
```

---

## Task 3: Wire `/m/[slug]/page.tsx`

**Files:**
- Modify: `apps/web/app/m/[slug]/page.tsx`

Apply these four exact edits.

- [ ] **Step 1: Add imports**

Find:
```tsx
import { getTheme, buildCssVars } from "@/lib/themes";
```
Replace with:
```tsx
import { getTheme, buildCssVars } from "@/lib/themes";
import { resolveDesignTokens } from "@/lib/design/resolver";
import { tokensToCssVars, googleFontsUrl } from "@/lib/design/css-vars";
import type { CSSProperties } from "react";
```

- [ ] **Step 2: Resolve + merge profile design after the theme/cssVars block**

Find:
```tsx
  const theme = getTheme(params.slug);
  const cssVars = buildCssVars(params.slug, {
    primary_color: menu.restaurant.primary_color,
    background_color: menu.restaurant.background_color,
  });
```
Replace with:
```tsx
  const theme = getTheme(params.slug);
  const baseCssVars = buildCssVars(params.slug, {
    primary_color: menu.restaurant.primary_color,
    background_color: menu.restaurant.background_color,
  });

  // DS-3: apply a published design profile's palette + fonts (colors/fonts only;
  // layout/behavior stay from getTheme). Falls back to today's vars when none.
  const { data: design } = await sb.rpc("get_published_design", { p_slug: params.slug });
  let cssVars: CSSProperties = baseCssVars;
  let profileFontsUrl: string | null = null;
  if (design) {
    const d = design as { template_tokens?: unknown; profile_tokens?: unknown };
    const resolved = resolveDesignTokens({
      templateTokens: d.template_tokens as Parameters<typeof resolveDesignTokens>[0]["templateTokens"],
      profileTokens: d.profile_tokens as Parameters<typeof resolveDesignTokens>[0]["profileTokens"],
    });
    cssVars = { ...(baseCssVars as Record<string, string>), ...tokensToCssVars(resolved) } as CSSProperties;
    profileFontsUrl = googleFontsUrl(resolved);
  }
```

- [ ] **Step 3: Inject the profile fonts link in the display-only render path**

Find:
```tsx
        {theme.fonts.googleUrl && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href={theme.fonts.googleUrl} />
        )}
        <MenuComponent menu={menu} theme={theme} />
```
Replace with:
```tsx
        {theme.fonts.googleUrl && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href={theme.fonts.googleUrl} />
        )}
        {profileFontsUrl && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href={profileFontsUrl} />
        )}
        <MenuComponent menu={menu} theme={theme} />
```

- [ ] **Step 4: Inject the profile fonts link in the normal render path**

Find:
```tsx
      {theme.fonts.googleUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={theme.fonts.googleUrl} />
      )}
      <CustomerShell menu={menu} tableParam={tableLabel} theme={theme} notifCenterEnabled={notifCenterEnabled}>
```
Replace with:
```tsx
      {theme.fonts.googleUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={theme.fonts.googleUrl} />
      )}
      {profileFontsUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={profileFontsUrl} />
      )}
      <CustomerShell menu={menu} tableParam={tableLabel} theme={theme} notifCenterEnabled={notifCenterEnabled}>
```

- [ ] **Step 5: Type-check + build**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=4096 npm run build`
Expected: tsc clean; build SUCCESS; `/m/[slug]` still in the route list.

- [ ] **Step 6: Commit**

```bash
cd /d/menulink && git add ':(literal)apps/web/app/m/[slug]/page.tsx' && \
git commit -m "DS-3: apply published design profile palette + fonts on /m/[slug]"
```

---

## Task 4: End-to-end verification on the clone, proof, PR (MAIN AGENT)

**Files:**
- Create: `docs/proofs/DS-3-pwa-token-resolver.md`

- [ ] **Step 1: Publish a design profile ONLY on `rzrz-bukhari-test`**

Use the admin-impersonation technique in a transaction (set `request.jwt.claim.sub` to a real `platform_admins.user_id`), insert a draft for `rzrz-bukhari-test` linked to brand `velora-premium-v1` (a visually distinct dark palette), then `perform public.publish_design_profile(<id>)`. Guard: if the `rzrz-bukhari-test` slug is not found exactly, STOP.

- [ ] **Step 2: Confirm the RPC returns the profile for the clone and null for production**

```sql
select
  public.get_published_design('rzrz-bukhari-test') is not null as clone_has_design,
  public.get_published_design('koko')              is null      as koko_unchanged,
  public.get_published_design('rzrz-bukhari')       is null      as rzrz_prod_unchanged;
```
Expected: `clone_has_design = true`, `koko_unchanged = true`, `rzrz_prod_unchanged = true`.

- [ ] **Step 3: tsc + build + regression**

```bash
cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=4096 npm run build
```
Expected: clean + SUCCESS.

- [ ] **Step 4: Manual browser smoke (clone only) — operator step**

Open `/m/rzrz-bukhari-test` → confirm the Velora dark palette + fonts render. Spot-check `/m/koko` is unchanged. (Headless auth not required for `/m` — it is public — so this can be eyeballed in a browser.)

- [ ] **Step 5: Decide on the demo profile**

Leave the published profile on `rzrz-bukhari-test` as a live demo (the clone is a sandbox), OR remove it via the PAT:
```sql
delete from public.restaurant_design_profiles p using public.restaurants r
where p.restaurant_id = r.id and r.slug = 'rzrz-bukhari-test';
```

- [ ] **Step 6: Write proof + commit + push + draft PR**

Create `docs/proofs/DS-3-pwa-token-resolver.md` (Goal · Scope · Files · Migration 0061 · RPC verification (clone has design, production null) · CSS-var mapping + font rules · Fallback · Build/tsc · Guardrails incl. **production customer pages not touched** · Known limitations (contrast-sensitive vars kept from base; layout deferred; manual browser smoke) · Next phase DS-3B). Then:
```bash
cd /d/menulink && git add docs/proofs/DS-3-pwa-token-resolver.md && \
git commit -m "DS-3: proof doc" && git push -u origin ds-3-pwa-token-resolver
gh pr create --draft --base ds-2-ops-design-studio --head ds-3-pwa-token-resolver \
  --title "DS-3: Customer PWA token resolver (colors + fonts)" \
  --body "Implements DS-3 per docs/superpowers/specs/2026-05-29-ds-3-pwa-token-resolver-design.md. Migration 0061 (get_published_design RPC), lib/design/css-vars.ts, /m/[slug] applies published profile palette+fonts with safe fallback. Layout unchanged (DS-3B). Verified on rzrz-bukhari-test; koko/rzrz-bukhari return null and are unchanged. Stacked on DS-2 (#2)."
```
Expected: PR URL printed.

---

## Self-Review

**Spec coverage:**
- Migration 0061 + RPC contract → Task 1. ✓
- CSS-var mapping (exact table) → Task 2 `tokensToCssVars`. ✓
- Font loading rules (Google-Fonts URL, skip non-Google, system fallback) → Task 2 `googleFontsUrl` + Task 3 link injection. ✓
- Resolve via DS-1 `resolveDesignTokens`, merge over `buildCssVars` → Task 3 Step 2. ✓
- Fallback (null → today; both render paths) → Task 3 Steps 2–4. ✓
- `get_public_menu` untouched / no public RLS → Task 1 (separate fn) + static grep. ✓
- Verify on clone only; production null → Tasks 1 & 4. ✓

**Placeholder scan:** none — all code blocks complete; the only "decide" is Task 4 Step 5 (keep vs delete the demo profile), which is an explicit either/or with the exact SQL, not a placeholder.

**Type consistency:** `get_published_design(p_slug text)` / RPC param `p_slug` match across Task 1 and Task 3 (`sb.rpc("get_published_design", { p_slug })`). `tokensToCssVars` / `googleFontsUrl` signatures match Task 2 ↔ Task 3 imports. `resolveDesignTokens({templateTokens, profileTokens})` matches the DS-1 signature. RPC JSON keys `template_tokens`/`profile_tokens` match between the SQL `jsonb_build_object` and the page's destructuring.

**Note:** `resolveDesignTokens` always seeds from `SYSTEM_DEFAULT_TOKENS`, so an active profile's complete token set fully drives the palette (intended). A hypothetical empty published profile would render system-default (standard-clean) colors — acceptable edge; DS-2's editor never produces an empty profile.
