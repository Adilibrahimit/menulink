# DS-3B-2 Velora Premium Presentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the Velora menu mockup on the live ordering menu via two flag-gated treatments — a `velora-hero` header and `premium-lounge` dark item cards — that only render for a profile selecting those flags.

**Architecture:** Add new `ThemeConfig` flag values + extend the `resolveThemeLayout` whitelist; add a `VeloraHero` component branched into `menu-experience.tsx`'s header; add a `premium` dark-card branch to `menu-item.tsx`; migration `0064` sets the flags on `premium-lounge-grid-v1` (the clone already references it). All gated so KO-KO/RzRz/Mazaj are unchanged.

**Tech Stack:** Next.js 14 (client components), Tailwind + CSS vars (Velora tokens resolved by DS-3/3B-1), Supabase RPC config.

**Verification model (no JS test runner):** `tsc --noEmit`, `next build` (`NODE_OPTIONS=--max-old-space-size=8192` — machine OOMs static-gen at default heap), SQL on `rzrz-bukhari-test` only, manual browser smoke. Never touch `koko`/`rzrz-bukhari`.

**Branch:** `ds-3b-2-velora-presentation` (off `main`; spec commit there).

**Reference:** spec `docs/superpowers/specs/2026-05-29-ds-3b-2-velora-presentation-design.md`; mockup `docs/clients/Design-template`.

---

## File Structure

**Create**
- `apps/web/app/m/[slug]/velora-hero.tsx` — the velora-hero header (presentational).
- `apps/web/supabase/migrations/0064_velora_layout_flags.sql` — set velora flags on the template.

**Modify**
- `apps/web/lib/themes.ts` — extend `ThemeConfig` unions (2 lines).
- `apps/web/lib/design/layout.ts` — extend `resolveThemeLayout` whitelist (2 lines).
- `apps/web/app/m/[slug]/menu-experience.tsx` — import `VeloraHero`; header branch; pass `premium` to the card.
- `apps/web/app/m/[slug]/menu-item.tsx` — accept `premium?: boolean`; premium dark-card branch.

---

## Task 1: New flag values (themes + resolver whitelist)

**Files:** Modify `apps/web/lib/themes.ts`, `apps/web/lib/design/layout.ts`.

- [ ] **Step 1: Extend `ThemeConfig` unions**

In `apps/web/lib/themes.ts`, find:
```ts
  menuCardStyle: "stitch-navy" | "default";
```
replace with:
```ts
  menuCardStyle: "stitch-navy" | "default" | "premium-lounge";
```
Then find:
```ts
  headerStyle: "dark-navy" | "brand-filled";
```
replace with:
```ts
  headerStyle: "dark-navy" | "brand-filled" | "velora-hero";
```

- [ ] **Step 2: Extend the resolver whitelist**

In `apps/web/lib/design/layout.ts`, find:
```ts
  if (c.menuCardStyle === "stitch-navy" || c.menuCardStyle === "default") out.menuCardStyle = c.menuCardStyle;
  if (c.headerStyle === "dark-navy" || c.headerStyle === "brand-filled") out.headerStyle = c.headerStyle;
```
replace with:
```ts
  if (c.menuCardStyle === "stitch-navy" || c.menuCardStyle === "default" || c.menuCardStyle === "premium-lounge") out.menuCardStyle = c.menuCardStyle;
  if (c.headerStyle === "dark-navy" || c.headerStyle === "brand-filled" || c.headerStyle === "velora-hero") out.headerStyle = c.headerStyle;
```

- [ ] **Step 3: Type-check**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /d/menulink && git add apps/web/lib/themes.ts apps/web/lib/design/layout.ts && \
git commit -m "DS-3B-2: add velora-hero + premium-lounge flag values"
```

---

## Task 2: Migration 0064 — set velora flags on the template

**Files:** Create `apps/web/supabase/migrations/0064_velora_layout_flags.sql`.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- MenuLink · 0064_velora_layout_flags
--
-- DS-3B-2: turn on the Velora presentation flags for premium-lounge-grid-v1.
-- The clone's published profile already references this template, so the new
-- headerStyle/menuCardStyle flow through get_published_design -> resolveThemeLayout.
-- Additive single update; no schema change.
-- ============================================================================

update public.menu_page_templates set default_config_json =
  '{"categoryStyle":"pills","headerStyle":"velora-hero","cartBarStyle":"gold-navy","hasItemDetailSheet":true,"menuCardStyle":"premium-lounge"}'::jsonb
where key = 'premium-lounge-grid-v1';
```

- [ ] **Step 2: Static review**

Run:
```bash
cd /d/menulink && f=apps/web/supabase/migrations/0064_velora_layout_flags.sql; \
echo "update: $(grep -c 'update public.menu_page_templates' $f)"; \
echo "velora-hero: $(grep -c 'velora-hero' $f)"; \
echo "premium-lounge: $(grep -c 'premium-lounge' $f)"; \
echo "destructive: $(grep -ciE 'drop table|truncate|delete from|create extension|alter table' $f)"
```
Expected: update=1, velora-hero=1, premium-lounge=1, destructive=0.

- [ ] **Step 3 (MAIN AGENT, DB): apply + verify**

Apply via the Management API PAT (project `dhmjrrsynfvomlzhggvu`). Then:
```sql
select
  public.get_published_design('rzrz-bukhari-test')->'menu_layout_config'->>'headerStyle' as header,
  public.get_published_design('rzrz-bukhari-test')->'menu_layout_config'->>'menuCardStyle' as card,
  public.get_published_design('koko') is null as koko_null;
```
Expected: `header='velora-hero'`, `card='premium-lounge'`, `koko_null=true`.

- [ ] **Step 4: Commit**

```bash
cd /d/menulink && git add apps/web/supabase/migrations/0064_velora_layout_flags.sql && \
git commit -m "DS-3B-2: migration 0064 — velora flags on premium-lounge-grid-v1"
```

---

## Task 3: VeloraHero component + header branch

**Files:** Create `apps/web/app/m/[slug]/velora-hero.tsx`; modify `apps/web/app/m/[slug]/menu-experience.tsx`.

- [ ] **Step 1: Create `velora-hero.tsx`**

```tsx
import type { PublicMenu } from "./types";

// Velora "lounge" hero: centered monogram + serif wordmark + tagline on a dark
// (optionally cover-image) backdrop with gold accents. Rendered only when
// headerStyle is "velora-hero". Presentational; styled entirely via resolved CSS vars.
export default function VeloraHero({ menu }: { menu: PublicMenu }) {
  const r = menu.restaurant;
  const initial = r.name?.trim().charAt(0) || "V";
  return (
    <div className="relative overflow-hidden bg-[var(--header-bg)]">
      {r.cover_image_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--header-bg)] via-[var(--header-bg)]/85 to-[var(--header-bg)]/55" />
        </>
      )}
      <div className="relative flex flex-col items-center text-center px-6 pt-10 pb-8 gap-3">
        {r.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.logo_url} alt={r.name} className="w-20 h-20 rounded-full object-cover border border-[var(--accent-gold,#C8A15A)] shadow-md" />
        ) : (
          <div
            className="w-16 h-16 flex items-center justify-center rounded-md border border-[var(--accent-gold,#C8A15A)] text-[var(--accent-gold,#C8A15A)] text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {initial}
          </div>
        )}
        <h1 className="text-[var(--header-text)] text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          {r.name}
        </h1>
        <div className="flex items-center gap-3 text-[var(--accent-gold,#C8A15A)]">
          <span className="h-px w-8 bg-[var(--accent-gold,#C8A15A)] opacity-50" />
          <span className="text-[11px] tracking-[0.3em] uppercase" style={{ fontFamily: "var(--font-display)" }}>Restaurant · Lounge</span>
          <span className="h-px w-8 bg-[var(--accent-gold,#C8A15A)] opacity-50" />
        </div>
        {r.tagline_ar && (
          <p className="text-[var(--header-text)] opacity-80 text-sm max-w-md leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
            {r.tagline_ar}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Import VeloraHero in menu-experience.tsx**

Find:
```tsx
import MenuItemCard from "./menu-item";
```
Replace with:
```tsx
import MenuItemCard from "./menu-item";
import VeloraHero from "./velora-hero";
```

- [ ] **Step 3: Add the velora-hero header branch**

Find:
```tsx
        {theme.headerStyle === "dark-navy" ? (
          <div className="bg-[var(--header-bg)] px-5 pt-8 pb-6">
```
Replace with:
```tsx
        {theme.headerStyle === "velora-hero" ? (
          <VeloraHero menu={menu} />
        ) : theme.headerStyle === "dark-navy" ? (
          <div className="bg-[var(--header-bg)] px-5 pt-8 pb-6">
```
(This prepends a new branch; the existing `dark-navy`/`hasCover`/light branches stay intact — the ternary now has one more leading condition.)

- [ ] **Step 4: Type-check + build**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=8192 npm run build`
Expected: tsc clean; build SUCCESS; `/m/[slug]` present.

- [ ] **Step 5: Commit**

```bash
cd /d/menulink && git add ':(literal)apps/web/app/m/[slug]/velora-hero.tsx' ':(literal)apps/web/app/m/[slug]/menu-experience.tsx' && \
git commit -m "DS-3B-2: velora-hero header (monogram + serif wordmark + tagline)"
```

---

## Task 4: premium-lounge item card

**Files:** Modify `apps/web/app/m/[slug]/menu-item.tsx`; modify `apps/web/app/m/[slug]/menu-experience.tsx`.

- [ ] **Step 1: Add the `premium` prop to MenuItemCard**

In `apps/web/app/m/[slug]/menu-item.tsx`, find:
```tsx
  hasDetailSheet,
  onAdd,
  onTapCard,
}: {
  item: PublicMenuItem;
  hasDetailSheet?: boolean;
  onAdd: (variant: PublicVariant) => void;
  onTapCard?: () => void;
}) {
```
Replace with:
```tsx
  hasDetailSheet,
  onAdd,
  onTapCard,
  premium,
}: {
  item: PublicMenuItem;
  hasDetailSheet?: boolean;
  onAdd: (variant: PublicVariant) => void;
  onTapCard?: () => void;
  premium?: boolean;
}) {
```

- [ ] **Step 2: Add the premium dark-card branch**

In `apps/web/app/m/[slug]/menu-item.tsx`, find:
```tsx
  const isHot = item.badges?.some((b) => b.type === "hot");

  return (
```
Replace with:
```tsx
  const isHot = item.badges?.some((b) => b.type === "hot");

  if (premium) {
    return (
      <article
        className={
          "bg-[var(--card-bg,#1C1A17)] rounded-2xl overflow-hidden border border-[var(--accent-gold,#C8A15A)]/25 flex flex-col group" +
          (hasDetailSheet ? " cursor-pointer" : "")
        }
        onClick={hasDetailSheet ? onTapCard : undefined}
      >
        <div className="relative aspect-[4/3] bg-black/30 overflow-hidden">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={item.name_ar}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-white/20">🍽️</div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        </div>
        <div className="p-3 flex flex-col gap-2 flex-1">
          <h3 className="text-[var(--ink,#F3EBDD)] leading-tight text-[16px]" style={{ fontFamily: "var(--font-display)" }}>
            {item.name_ar}
          </h3>
          {item.description_ar && (
            <p className="text-[11px] leading-snug -mt-1 line-clamp-2 text-[var(--ink,#F3EBDD)] opacity-60" style={{ fontFamily: "var(--font-body)" }}>
              {item.description_ar}
            </p>
          )}
          {item.calories_kcal != null && item.calories_kcal > 0 && (
            <span className="inline-flex w-fit items-center gap-0.5 text-[10px] text-[var(--accent-gold,#C8A15A)] border border-[var(--accent-gold,#C8A15A)]/30 rounded-full px-1.5 py-0.5 leading-none">
              🔥 {toArabicDigits(String(item.calories_kcal))} سعرة
            </span>
          )}
          <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
            {item.variants.map((v) => (
              <button
                key={v.key}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(v);
                }}
                className="flex-1 min-w-[88px] inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-full border border-[var(--accent-gold,#C8A15A)]/60 text-[var(--accent-gold,#C8A15A)] text-[11px] font-semibold active:translate-y-px hover:bg-[var(--accent-gold,#C8A15A)]/10"
                aria-label={`أضف ${item.name_ar}${v.label ? ` ${v.label}` : ""}`}
              >
                {v.label && <span className="text-[10px] opacity-85">{v.label}</span>}
                <span className="text-sm">{toArabicDigits(String(v.price))}</span>
                <SarSymbol size={10} className="opacity-80" />
              </button>
            ))}
          </div>
        </div>
      </article>
    );
  }

  return (
```
(The default `return (` below is unchanged — KO-KO/RzRz keep the existing card.)

- [ ] **Step 3: Pass `premium` from menu-experience.tsx**

In `apps/web/app/m/[slug]/menu-experience.tsx`, find:
```tsx
                <MenuItemCard
                  key={item.id}
                  item={item}
                  hasDetailSheet={theme.hasItemDetailSheet}
```
Replace with:
```tsx
                <MenuItemCard
                  key={item.id}
                  item={item}
                  premium={theme.menuCardStyle === "premium-lounge"}
                  hasDetailSheet={theme.hasItemDetailSheet}
```

- [ ] **Step 4: Type-check + build**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=8192 npm run build`
Expected: tsc clean; build SUCCESS.

- [ ] **Step 5: Commit**

```bash
cd /d/menulink && git add ':(literal)apps/web/app/m/[slug]/menu-item.tsx' ':(literal)apps/web/app/m/[slug]/menu-experience.tsx' && \
git commit -m "DS-3B-2: premium-lounge dark item card"
```

---

## Task 5: E2E verification, proof, PR (MAIN AGENT)

**Files:** Create `docs/proofs/DS-3B-2-velora-presentation.md`.

- [ ] **Step 1: Confirm the flags on the clone + production null**

Via the PAT:
```sql
select
  public.get_published_design('rzrz-bukhari-test')->'menu_layout_config'->>'headerStyle' as header,
  public.get_published_design('rzrz-bukhari-test')->'menu_layout_config'->>'menuCardStyle' as card,
  public.get_published_design('koko') is null as koko_null,
  public.get_published_design('rzrz-bukhari') is null as rzrz_prod_null;
```
Expected: `header='velora-hero'`, `card='premium-lounge'`, both production null `true`.

- [ ] **Step 2: tsc + build**

```bash
cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=8192 npm run build
```
Expected: clean + SUCCESS.

- [ ] **Step 3: Manual browser smoke (operator)**

Open `/m/rzrz-bukhari-test` → centered monogram/serif hero + dark image-forward cards + pills + gold cart. Spot-check `/m/koko` and `/m/rzrz-bukhari` visually unchanged (white cards, existing header).

- [ ] **Step 4: Proof + commit + push + draft PR**

Create `docs/proofs/DS-3B-2-velora-presentation.md` (Goal · Scope · Files · New flags + resolver · velora-hero + premium-lounge summaries · Migration 0064 · RPC verification · build/tsc · Guardrails incl. **production not touched, default card/order-flow unchanged** · Known limitations (structural fidelity; pixel-polish pending browser pass; "Restaurant · Lounge" eyebrow is a static velora-hero touch) · Next: DS-4/5/6). Then:
```bash
cd /d/menulink && git add docs/proofs/DS-3B-2-velora-presentation.md && \
git commit -m "DS-3B-2: proof doc" && git push -u origin ds-3b-2-velora-presentation
gh pr create --base main --head ds-3b-2-velora-presentation \
  --title "DS-3B-2: Velora premium presentation (hero + dark cards)" \
  --body "Implements DS-3B-2 per docs/superpowers/specs/2026-05-29-ds-3b-2-velora-presentation-design.md. New flag values velora-hero + premium-lounge (resolver whitelist extended); VeloraHero header + premium dark item card branched in, flag-gated; migration 0064 sets the flags on premium-lounge-grid-v1. KO-KO/RzRz unchanged (default path). Verified on rzrz-bukhari-test."
```

---

## Self-Review

**Spec coverage:**
- New flag values + resolver whitelist → Task 1. ✓
- velora-hero header (monogram + serif wordmark + tagline, dark/cover, gold) → Task 3 (`VeloraHero` + branch). ✓
- premium-lounge dark image-forward cards (serif name, gold price/outline) → Task 4 (`menu-item.tsx` branch + `premium` prop threaded from `menu-experience.tsx`). ✓
- Migration 0064 sets flags on premium-lounge-grid-v1 → Task 2. ✓
- Clone-only verification; production null/unchanged → Tasks 2 & 5. ✓

**Placeholder scan:** none — full JSX for both treatments; SQL complete.

**Type consistency:** new union members (`"velora-hero"`, `"premium-lounge"`) added to `ThemeConfig` (Task 1) match the resolver whitelist (Task 1), the migration JSON (Task 2), the header branch condition `theme.headerStyle === "velora-hero"` (Task 3), and the card condition `theme.menuCardStyle === "premium-lounge"` (Task 4). `MenuItemCard`'s new `premium?: boolean` prop (Task 4 Step 1) matches the `premium={…}` passed in Task 4 Step 3. `VeloraHero({ menu }: { menu: PublicMenu })` matches the `<VeloraHero menu={menu} />` call (Task 3). `velora-hero.tsx` uses only `menu.restaurant` fields already used elsewhere in `menu-experience.tsx` (`name`, `logo_url`, `cover_image_url`, `tagline_ar`).

**Note:** `VeloraHero` has no `"use client"` directive — correct, since it's imported into the client component `menu-experience.tsx` and has no hooks; it joins the client bundle automatically. The premium card reuses the same `img`/`item`/`onAdd`/`onTapCard`/`hasDetailSheet` already in scope in `menu-item.tsx`.
