# DS-2 Ops Design Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the platform operator a 4-tab studio at `/ops/tenants/[id]/design` to assign brand + menu-page templates to a tenant, tune tokens, preview, and publish a versioned design profile — without touching the live customer menu.

**Architecture:** Additive migration `0060` adds `updated_at` + an atomic, advisory-locked `publish_design_profile` RPC. A dedicated server route renders `?tab=`-selected tabs; interactive tabs are client components writing `restaurant_design_profiles` through DS-1's ops RLS (drafts) or the RPC (publish). The customer PWA is untouched (DS-3 wires reads). The existing `DesignForm` and `restaurants` brand columns are untouched.

**Tech Stack:** Next.js 14 (App Router, server + client components), Supabase (Postgres + RLS + RPC, `@/lib/supabase-server` / `@/lib/supabase-browser`), Tailwind (dark ops cockpit), DS-1 `lib/design/*` helpers.

**Verification model (no unit-test runner in repo):** each task verifies with `npx tsc --noEmit`, `npm run build`, SQL checks via the Supabase Management API PAT against `rzrz-bukhari-test`, and manual smoke. The one pure helper (`prefill.ts`) gets a temp-compile + Node assertion (same technique used for DS-1 helpers). **Never** test on `koko` / `rzrz-bukhari`.

**Branch:** `ds-2-ops-design-studio` (already created off `ds-1-design-print-studio-foundation`; the spec commit is on it). All work + commits land here.

**Reference:** spec at `docs/superpowers/specs/2026-05-29-ds-2-ops-design-studio-design.md`.

---

## File Structure

**Create**
- `apps/web/supabase/migrations/0060_design_studio_publish.sql` — `updated_at` column + trigger; `publish_design_profile` RPC.
- `apps/web/lib/design/prefill.ts` — pure: build a draft's initial brand tokens from template defaults + the restaurant's live colors.
- `apps/web/app/ops/tenants/[id]/design/page.tsx` — server: `requireOps`, load data, render tab nav + active tab.
- `apps/web/app/ops/tenants/[id]/design/overview-tab.tsx` — server component: published/draft summary + link to Brand basics.
- `apps/web/app/ops/tenants/[id]/design/brand-identity-tab.tsx` — client: template select, token editor, preview, reset, save draft, publish.
- `apps/web/app/ops/tenants/[id]/design/menu-page-tab.tsx` — client: menu-page template select + save.
- `apps/web/app/ops/tenants/[id]/design/versions-tab.tsx` — client: list profiles + Set-as-published + Duplicate-to-draft.

**Modify**
- `apps/web/app/ops/tenants/[id]/page.tsx` — add one "Design Studio →" link (no other change).

**Data model decisions (locked):**
- `brand_tokens_json` stores the **full** edited token set (pre-filled from template + live colors). DS-3 will resolve template-then-profile; a complete profile layer dominates cleanly.
- The Brand Identity / Menu Page tabs operate on **the latest `draft`** profile (most recent `updated_at`). If none exists, the tab offers "Create draft". "Duplicate to new draft" (Versions tab) creates a new draft that becomes the latest.
- Profiles are loaded with embedded template names via PostgREST FK embedding.

---

## Task 1: Migration 0060 — `updated_at` + publish RPC

**Files:**
- Create: `apps/web/supabase/migrations/0060_design_studio_publish.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- MenuLink · 0060_design_studio_publish
--
-- DS-2 support. Additive:
--   1. restaurant_design_profiles.updated_at + set_updated_at trigger.
--   2. publish_design_profile(uuid): atomic, advisory-locked, platform-admin
--      guarded publish that archives the tenant's current published profile and
--      promotes the target with a clean 1-based version number.
-- No data changes; no existing object altered destructively.
-- ============================================================================

-- 1. updated_at column + trigger (reuses public.set_updated_at from 0001)
alter table public.restaurant_design_profiles
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists restaurant_design_profiles_set_updated_at
  on public.restaurant_design_profiles;
create trigger restaurant_design_profiles_set_updated_at
  before update on public.restaurant_design_profiles
  for each row execute function public.set_updated_at();

-- 2. Atomic publish RPC
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

  -- archive the currently-published profile (if different from the target)
  update public.restaurant_design_profiles
     set status = 'archived'
   where restaurant_id = v_rid
     and status = 'published'
     and id <> p_profile_id;

  -- publish the target with a clean 1-based version number
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

- [ ] **Step 2: Static review of the migration**

Run:
```bash
cd /d/menulink && f=apps/web/supabase/migrations/0060_design_studio_publish.sql; \
grep -c "add column if not exists updated_at" $f; \
grep -c "create or replace function public.publish_design_profile" $f; \
grep -c "is_platform_admin" $f; \
grep -c "pg_advisory_xact_lock" $f; \
grep -ciE "drop table|truncate|delete from|create extension" $f
```
Expected: `1`, `1`, `1`, `1`, `0` (last line = no destructive/extension statements).

- [ ] **Step 3: Apply to live Supabase via Management API PAT**

Run (PowerShell):
```powershell
$pat = (Select-String -Path 'C:\Users\USER\.claude\projects\D--menulink\memory\reference_supabase_pat.md' -Pattern 'sbp_[A-Za-z0-9]+').Matches[0].Value
$uri = 'https://api.supabase.com/v1/projects/dhmjrrsynfvomlzhggvu/database/query'
$sql = Get-Content -Raw 'D:\menulink\apps\web\supabase\migrations\0060_design_studio_publish.sql'
$body = @{ query = $sql } | ConvertTo-Json
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
try { Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization = "Bearer $pat" } -ContentType 'application/json' -Body $bytes; Write-Output "0060 APPLIED OK" }
catch { Write-Output ("ERROR: " + $_.Exception.Message); if ($_.ErrorDetails) { Write-Output $_.ErrorDetails.Message } }
```
Expected: `0060 APPLIED OK`.

- [ ] **Step 4: Verify column + function exist**

Run (PowerShell):
```powershell
$pat = (Select-String -Path 'C:\Users\USER\.claude\projects\D--menulink\memory\reference_supabase_pat.md' -Pattern 'sbp_[A-Za-z0-9]+').Matches[0].Value
$uri = 'https://api.supabase.com/v1/projects/dhmjrrsynfvomlzhggvu/database/query'
$q = "select (select count(*) from information_schema.columns where table_schema='public' and table_name='restaurant_design_profiles' and column_name='updated_at') as has_updated_at, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_design_profile') as has_rpc;"
$body = @{ query = $q } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization = "Bearer $pat" } -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json
```
Expected: `has_updated_at = 1`, `has_rpc = 1`.

- [ ] **Step 5: Functional RPC test on `rzrz-bukhari-test` (self-cleaning)**

Run (PowerShell) — creates two drafts on the clone, publishes each, asserts archive behavior + single published + clean version numbers, then deletes test rows:
```powershell
$pat = (Select-String -Path 'C:\Users\USER\.claude\projects\D--menulink\memory\reference_supabase_pat.md' -Pattern 'sbp_[A-Za-z0-9]+').Matches[0].Value
$uri = 'https://api.supabase.com/v1/projects/dhmjrrsynfvomlzhggvu/database/query'
$q = @'
create or replace function pg_temp.ds2_rpc_test()
returns table(step text, result text) language plpgsql as $f$
declare v_rid uuid; v_b uuid; v_p1 uuid; v_p2 uuid; v_pub int; v_v1 int; v_v2 int;
begin
  select id into v_rid from public.restaurants where slug='rzrz-bukhari-test';
  select id into v_b from public.brand_identity_templates where key='rzrz-navy-v1';
  insert into public.restaurant_design_profiles(restaurant_id,brand_template_id,status) values (v_rid,v_b,'draft') returning id into v_p1;
  insert into public.restaurant_design_profiles(restaurant_id,brand_template_id,status) values (v_rid,v_b,'draft') returning id into v_p2;
  perform public.publish_design_profile(v_p1);
  select version_number into v_v1 from public.restaurant_design_profiles where id=v_p1;
  step:='publish #1 version'; result:=v_v1::text; return next;   -- expect 1
  perform public.publish_design_profile(v_p2);
  select version_number into v_v2 from public.restaurant_design_profiles where id=v_p2;
  step:='publish #2 version'; result:=v_v2::text; return next;   -- expect 2
  select count(*) into v_pub from public.restaurant_design_profiles where restaurant_id=v_rid and status='published';
  step:='published rows after 2 publishes'; result:=v_pub::text; return next;  -- expect 1
  step:='profile #1 status'; result:=(select status from public.restaurant_design_profiles where id=v_p1); return next; -- expect archived
  delete from public.restaurant_design_profiles where id in (v_p1,v_p2);
  step:='cleanup remaining for clone'; result:=(select count(*)::text from public.restaurant_design_profiles where restaurant_id=v_rid); return next; -- expect 0
  return;
end $f$;
select * from pg_temp.ds2_rpc_test();
'@
$body = @{ query = $q } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization="Bearer $pat" } -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | Format-Table step,result -AutoSize | Out-String -Width 120
```
Expected: version `1`, then `2`; published rows `1`; profile #1 `archived`; cleanup `0`.

- [ ] **Step 6: Commit**

```bash
cd /d/menulink && git add apps/web/supabase/migrations/0060_design_studio_publish.sql && \
git commit -m "DS-2: migration 0060 — design profile updated_at + publish RPC"
```

---

## Task 2: `prefill.ts` pure helper

**Files:**
- Create: `apps/web/lib/design/prefill.ts`

- [ ] **Step 1: Write the helper**

```typescript
// Build a draft profile's initial brand tokens: template defaults first, then
// the restaurant's current live colors layered on top, so the operator starts
// from what the live menu shows. Pure — reuses mergeTokens. (DS-2)

import { mergeTokens } from "./tokens";
import type { DesignTokens } from "./types";

export type RestaurantBrandFields = {
  primary_color?: string | null;
  background_color?: string | null;
};

export function prefillBrandTokens(
  templateTokens: Partial<DesignTokens> | null | undefined,
  restaurant: RestaurantBrandFields,
): DesignTokens {
  const colors: Record<string, string> = {};
  if (restaurant.primary_color) colors.primary = restaurant.primary_color;
  if (restaurant.background_color) colors.background = restaurant.background_color;
  const liveOverrides: Partial<DesignTokens> =
    Object.keys(colors).length > 0 ? ({ colors } as Partial<DesignTokens>) : {};
  return mergeTokens(templateTokens ?? undefined, liveOverrides);
}
```

- [ ] **Step 2: Type-check**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit`
Expected: clean (no output).

- [ ] **Step 3: Runtime assertion via temp-compile**

Write `C:\Users\USER\AppData\Local\Temp\ds2-prefill-test.cjs`:
```javascript
const B = "C:/Users/USER/AppData/Local/Temp/ds2build";
const { prefillBrandTokens } = require(B + "/prefill.js");
let fail = 0; const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fail++; };
const tpl = { colors: { background: "#061A3A", surface: "#FFFFFF", primary: "#C8A15A", text: "#0B1220", muted: "#6B7280" }, typography: { heading: "Alexandria", body: "Cairo", latin: "Geist" }, mood: "navy" };
const r = prefillBrandTokens(tpl, { primary_color: "#FF0000", background_color: null });
ok("live primary overrides template", r.colors.primary === "#FF0000");
ok("null background keeps template background", r.colors.background === "#061A3A");
ok("template-only key preserved (surface)", r.colors.surface === "#FFFFFF");
ok("typography from template", r.typography.heading === "Alexandria");
process.exit(fail === 0 ? 0 : 1);
```
Run:
```bash
cd /d/menulink/apps/web && rm -rf "/c/Users/USER/AppData/Local/Temp/ds2build" && \
npx tsc lib/design/types.ts lib/design/tokens.ts lib/design/prefill.ts --outDir "/c/Users/USER/AppData/Local/Temp/ds2build" --module commonjs --moduleResolution node --target es2020 --skipLibCheck --esModuleInterop && \
node "/c/Users/USER/AppData/Local/Temp/ds2-prefill-test.cjs"; \
rm -rf "/c/Users/USER/AppData/Local/Temp/ds2build" "/c/Users/USER/AppData/Local/Temp/ds2-prefill-test.cjs"
```
Expected: 4 × PASS, exit 0.

- [ ] **Step 4: Commit**

```bash
cd /d/menulink && git add apps/web/lib/design/prefill.ts && \
git commit -m "DS-2: add prefillBrandTokens helper"
```

---

## Task 3: Studio route scaffold — server page + tab nav + Overview tab

**Files:**
- Create: `apps/web/app/ops/tenants/[id]/design/page.tsx`
- Create: `apps/web/app/ops/tenants/[id]/design/overview-tab.tsx`

- [ ] **Step 1: Write the Overview tab (server component)**

`apps/web/app/ops/tenants/[id]/design/overview-tab.tsx`:
```tsx
import Link from "next/link";

type ProfileRow = {
  id: string;
  status: string;
  version_number: number;
  published_at: string | null;
  updated_at: string;
  brand: { name_ar: string } | null;
  page: { name_ar: string } | null;
};

export default function OverviewTab({
  tenantId,
  profiles,
}: {
  tenantId: string;
  profiles: ProfileRow[];
}) {
  const published = profiles.find((p) => p.status === "published") ?? null;
  const draft = profiles.find((p) => p.status === "draft") ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-neutral-400">المنشور حالياً</div>
          {published ? (
            <div className="mt-1 text-sm text-neutral-200">
              {published.brand?.name_ar ?? "—"} · v{published.version_number}
              <div className="text-xs text-neutral-500 mt-1">
                {published.published_at
                  ? new Date(published.published_at).toLocaleDateString("ar-SA")
                  : ""}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-neutral-500">لا يوجد ملف منشور</div>
          )}
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-neutral-400">المسودة الحالية</div>
          <div className="mt-1 text-sm text-neutral-200">
            {draft ? `${draft.brand?.name_ar ?? "—"} (مسودة)` : "لا توجد مسودة"}
          </div>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        تعديل الاسم/الشعار/الغلاف/الألوان الحالية للقائمة يتم من نموذج «التصميم البصري» في{" "}
        <Link href={`/ops/tenants/${tenantId}`} className="text-neutral-300 underline">
          صفحة المطعم
        </Link>
        .
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write the studio server page (data load + tab nav)**

`apps/web/app/ops/tenants/[id]/design/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import OverviewTab from "./overview-tab";
import BrandIdentityTab from "./brand-identity-tab";
import MenuPageTab from "./menu-page-tab";
import VersionsTab from "./versions-tab";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "brand", label: "الهوية البصرية" },
  { key: "menu", label: "قالب القائمة" },
  { key: "versions", label: "الإصدارات" },
] as const;

export default async function DesignStudioPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  await requireOps();
  const sb = createClient();
  const active = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "overview";

  const [{ data: r }, { data: profiles }, { data: brandTemplates }, { data: pageTemplates }] =
    await Promise.all([
      sb.from("restaurants")
        .select("id, slug, name, logo_url, cover_image_url, primary_color, background_color")
        .eq("id", params.id).single(),
      sb.from("restaurant_design_profiles")
        .select("*, brand:brand_identity_templates(key,name_ar), page:menu_page_templates(key,name_ar)")
        .eq("restaurant_id", params.id)
        .order("updated_at", { ascending: false }),
      sb.from("brand_identity_templates")
        .select("id, key, name_ar, name_en, tier, business_type, default_tokens_json")
        .eq("is_active", true).order("tier", { ascending: true }),
      sb.from("menu_page_templates")
        .select("id, key, name_ar, layout_type, supported_business_types")
        .eq("is_active", true).order("key", { ascending: true }),
    ]);

  if (!r) notFound();
  const rows = profiles ?? [];
  const draft = rows.find((p: any) => p.status === "draft") ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/ops/tenants/${r.id}`} className="text-xs text-neutral-400 hover:text-neutral-200">
          ← {r.name}
        </Link>
        <h1 className="text-xl font-bold mt-1">استوديو التصميم</h1>
        <p className="text-xs text-neutral-400 font-mono">{r.slug}</p>
      </div>

      <nav className="flex gap-1 border-b border-neutral-800">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/ops/tenants/${r.id}/design?tab=${t.key}`}
            className={`px-3 py-2 text-sm rounded-t-md ${
              active === t.key
                ? "bg-neutral-900 border border-b-0 border-neutral-800 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div>
        {active === "overview" && <OverviewTab tenantId={r.id} profiles={rows as any} />}
        {active === "brand" && (
          <BrandIdentityTab
            restaurant={r as any}
            draft={draft as any}
            brandTemplates={(brandTemplates ?? []) as any}
          />
        )}
        {active === "menu" && (
          <MenuPageTab draft={draft as any} pageTemplates={(pageTemplates ?? []) as any} />
        )}
        {active === "versions" && <VersionsTab restaurantId={r.id} profiles={rows as any} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add placeholder exports for the not-yet-written client tabs so the page compiles**

This step is only to keep the build green between tasks. Create minimal stubs that Task 4–6 replace fully. `apps/web/app/ops/tenants/[id]/design/brand-identity-tab.tsx`:
```tsx
"use client";
export default function BrandIdentityTab(_: any) {
  return <div className="text-sm text-neutral-500">…</div>;
}
```
`apps/web/app/ops/tenants/[id]/design/menu-page-tab.tsx`:
```tsx
"use client";
export default function MenuPageTab(_: any) {
  return <div className="text-sm text-neutral-500">…</div>;
}
```
`apps/web/app/ops/tenants/[id]/design/versions-tab.tsx`:
```tsx
"use client";
export default function VersionsTab(_: any) {
  return <div className="text-sm text-neutral-500">…</div>;
}
```

- [ ] **Step 4: Build**

Run: `cd /d/menulink/apps/web && npm run build`
Expected: success; route `/ops/tenants/[id]/design` appears in the output.

- [ ] **Step 5: Commit**

```bash
cd /d/menulink && git add apps/web/app/ops/tenants/[id]/design/ && \
git commit -m "DS-2: studio route scaffold + Overview tab + tab nav"
```

---

## Task 4: Brand Identity tab

**Files:**
- Modify (replace stub): `apps/web/app/ops/tenants/[id]/design/brand-identity-tab.tsx`

- [ ] **Step 1: Write the full tab**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { prefillBrandTokens } from "@/lib/design/prefill";
import { resolveDesignTokens } from "@/lib/design/resolver";
import type { DesignTokens } from "@/lib/design/types";

type BrandTemplate = {
  id: string; key: string; name_ar: string; name_en: string | null;
  tier: string; default_tokens_json: DesignTokens;
};
type Restaurant = {
  id: string; primary_color: string | null; background_color: string | null;
};
type Draft = {
  id: string; brand_template_id: string | null;
  brand_tokens_json: Partial<DesignTokens>;
} | null;

const COLOR_KEYS = ["background", "surface", "primary", "accent", "text", "muted"] as const;

export default function BrandIdentityTab({
  restaurant, draft, brandTemplates,
}: { restaurant: Restaurant; draft: Draft; brandTemplates: BrandTemplate[] }) {
  const router = useRouter();
  const sb = createClient();

  const [templateId, setTemplateId] = useState<string>(
    draft?.brand_template_id ?? brandTemplates[0]?.id ?? "",
  );
  const selected = useMemo(
    () => brandTemplates.find((t) => t.id === templateId) ?? null,
    [brandTemplates, templateId],
  );

  const seed = (): DesignTokens =>
    prefillBrandTokens(selected?.default_tokens_json, {
      primary_color: restaurant.primary_color,
      background_color: restaurant.background_color,
    });

  const [tokens, setTokens] = useState<DesignTokens>(
    draft?.brand_tokens_json && Object.keys(draft.brand_tokens_json).length
      ? (draft.brand_tokens_json as DesignTokens)
      : seed(),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const preview = resolveDesignTokens({
    templateTokens: selected?.default_tokens_json,
    profileTokens: tokens,
  });

  function setColor(key: string, value: string) {
    setTokens((t) => ({ ...t, colors: { ...t.colors, [key]: value } }));
  }
  function resetFromLive() {
    setTokens(seed());
    setMsg({ kind: "ok", text: "تمت إعادة التهيئة من الهوية الحالية" });
  }

  async function persist(publish: boolean) {
    setBusy(true); setMsg(null);
    try {
      let profileId = draft?.id ?? null;
      if (profileId) {
        const { error } = await sb.from("restaurant_design_profiles")
          .update({ brand_template_id: templateId || null, brand_tokens_json: tokens })
          .eq("id", profileId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("restaurant_design_profiles")
          .insert({ restaurant_id: restaurant.id, brand_template_id: templateId || null, brand_tokens_json: tokens, status: "draft" })
          .select("id").single();
        if (error) throw error;
        profileId = data.id;
      }
      if (publish) {
        const { error } = await sb.rpc("publish_design_profile", { p_profile_id: profileId });
        if (error) throw error;
      }
      setMsg({ kind: "ok", text: publish ? "تم النشر ✓" : "تم حفظ المسودة ✓" });
      router.refresh();
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "خطأ" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {msg && (
        <p className={`rounded-md text-sm p-3 ${msg.kind === "ok"
          ? "bg-green-900/40 border border-green-800 text-green-300"
          : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>
      )}

      <p className="text-xs text-amber-300/90 bg-amber-900/20 border border-amber-800/40 rounded-md p-2">
        هذه المسودة لا تؤثر على صفحة العميل الحالية حتى يتم ربطها في DS-3.
      </p>

      <label className="block">
        <span className="block text-xs text-neutral-400 mb-1">قالب الهوية</span>
        <select
          value={templateId}
          onChange={(e) => { setTemplateId(e.target.value); }}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400"
        >
          {brandTemplates.map((t) => (
            <option key={t.id} value={t.id}>{t.name_ar} · {t.tier}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3" dir="ltr">
        {COLOR_KEYS.map((k) => (
          <label key={k} className="block">
            <span className="block text-xs text-neutral-400 mb-1">{k}</span>
            <div className="flex items-center gap-2 rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1">
              <input type="color" value={(preview.colors as any)[k] ?? "#000000"}
                onChange={(e) => setColor(k, e.target.value)}
                className="h-8 w-10 cursor-pointer bg-transparent" />
              <input type="text" value={(tokens.colors as any)[k] ?? ""}
                onChange={(e) => setColor(k, e.target.value)}
                placeholder="(من القالب)"
                className="flex-1 bg-transparent text-neutral-100 px-1 py-1 outline-none font-mono text-xs" />
            </div>
          </label>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-800 p-4" style={{ background: preview.colors.background }}>
        <div className="text-xs mb-2" style={{ color: preview.colors.muted }}>معاينة</div>
        <div className="rounded-lg p-3" style={{ background: preview.colors.surface }}>
          <div style={{ color: preview.colors.text, fontWeight: 700 }}>عنوان تجريبي</div>
          <button className="mt-2 px-3 py-1.5 text-sm rounded-md"
            style={{ background: preview.colors.primary, color: "#fff",
                     borderRadius: preview.radius?.button ?? "12px" }}>
            زر
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => persist(false)} disabled={busy}
          className="rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-4 py-2 text-sm hover:bg-neutral-700 disabled:opacity-60">
          {busy ? "..." : "حفظ كمسودة"}
        </button>
        <button onClick={() => persist(true)} disabled={busy}
          className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60">
          نشر
        </button>
        <button onClick={resetFromLive} type="button"
          className="text-xs text-neutral-500 hover:text-neutral-300 self-center">
          إعادة التهيئة من الهوية الحالية
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit && npm run build`
Expected: clean, build success.

- [ ] **Step 3: Commit**

```bash
cd /d/menulink && git add apps/web/app/ops/tenants/[id]/design/brand-identity-tab.tsx && \
git commit -m "DS-2: Brand Identity tab (template select, token editor, preview, publish)"
```

---

## Task 5: Menu Page tab

**Files:**
- Modify (replace stub): `apps/web/app/ops/tenants/[id]/design/menu-page-tab.tsx`

- [ ] **Step 1: Write the full tab**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type PageTemplate = {
  id: string; key: string; name_ar: string;
  layout_type: string; supported_business_types: string[];
};
type Draft = { id: string; menu_page_template_id: string | null } | null;

export default function MenuPageTab({
  draft, pageTemplates,
}: { draft: Draft; pageTemplates: PageTemplate[] }) {
  const router = useRouter();
  const sb = createClient();
  const [sel, setSel] = useState<string>(draft?.menu_page_template_id ?? pageTemplates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    if (!draft) {
      setMsg({ kind: "err", text: "أنشئ مسودة من تبويب الهوية البصرية أولاً." });
      return;
    }
    setBusy(true); setMsg(null);
    const { error } = await sb.from("restaurant_design_profiles")
      .update({ menu_page_template_id: sel || null }).eq("id", draft.id);
    setBusy(false);
    if (error) { setMsg({ kind: "err", text: error.message }); return; }
    setMsg({ kind: "ok", text: "تم الحفظ ✓" });
    router.refresh();
  }

  const current = pageTemplates.find((t) => t.id === sel) ?? null;

  return (
    <div className="space-y-4">
      {msg && (
        <p className={`rounded-md text-sm p-3 ${msg.kind === "ok"
          ? "bg-green-900/40 border border-green-800 text-green-300"
          : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>
      )}
      <label className="block">
        <span className="block text-xs text-neutral-400 mb-1">قالب صفحة القائمة</span>
        <select value={sel} onChange={(e) => setSel(e.target.value)}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400">
          {pageTemplates.map((t) => (
            <option key={t.id} value={t.id}>{t.name_ar} · {t.layout_type}</option>
          ))}
        </select>
      </label>
      {current && (
        <p className="text-xs text-neutral-500">
          الأنواع المدعومة: {current.supported_business_types.join("، ")}
        </p>
      )}
      <button onClick={save} disabled={busy}
        className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60">
        {busy ? "..." : "حفظ"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit && npm run build`
Expected: clean, build success.

- [ ] **Step 3: Commit**

```bash
cd /d/menulink && git add apps/web/app/ops/tenants/[id]/design/menu-page-tab.tsx && \
git commit -m "DS-2: Menu Page tab (template selection)"
```

---

## Task 6: Versions tab

**Files:**
- Modify (replace stub): `apps/web/app/ops/tenants/[id]/design/versions-tab.tsx`

- [ ] **Step 1: Write the full tab**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type ProfileRow = {
  id: string; status: string; version_number: number;
  updated_at: string; published_at: string | null;
  brand_template_id: string | null; menu_page_template_id: string | null;
  brand_tokens_json: unknown; menu_tokens_json: unknown;
  brand: { name_ar: string } | null;
  page: { name_ar: string } | null;
};

const STATUS_AR: Record<string, string> = { draft: "مسودة", published: "منشور", archived: "مؤرشف" };

export default function VersionsTab({
  restaurantId, profiles,
}: { restaurantId: string; profiles: ProfileRow[] }) {
  const router = useRouter();
  const sb = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function publish(id: string) {
    setBusy(id); setMsg(null);
    const { error } = await sb.rpc("publish_design_profile", { p_profile_id: id });
    setBusy(null);
    if (error) { setMsg({ kind: "err", text: error.message }); return; }
    setMsg({ kind: "ok", text: "تم النشر ✓" });
    router.refresh();
  }

  async function duplicate(p: ProfileRow) {
    setBusy(p.id); setMsg(null);
    const { error } = await sb.from("restaurant_design_profiles").insert({
      restaurant_id: restaurantId,
      brand_template_id: p.brand_template_id,
      menu_page_template_id: p.menu_page_template_id,
      brand_tokens_json: p.brand_tokens_json ?? {},
      menu_tokens_json: p.menu_tokens_json ?? {},
      status: "draft",
    });
    setBusy(null);
    if (error) { setMsg({ kind: "err", text: error.message }); return; }
    setMsg({ kind: "ok", text: "تم إنشاء مسودة جديدة ✓" });
    router.refresh();
  }

  if (profiles.length === 0) {
    return <p className="text-sm text-neutral-500">لا توجد ملفات تصميم بعد. أنشئ مسودة من تبويب الهوية البصرية.</p>;
  }

  return (
    <div className="space-y-3">
      {msg && (
        <p className={`rounded-md text-sm p-3 ${msg.kind === "ok"
          ? "bg-green-900/40 border border-green-800 text-green-300"
          : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-500 text-xs text-right border-b border-neutral-800">
              <th className="py-2 px-2">الإصدار</th>
              <th className="py-2 px-2">الحالة</th>
              <th className="py-2 px-2">الهوية</th>
              <th className="py-2 px-2">قالب القائمة</th>
              <th className="py-2 px-2">آخر تحديث</th>
              <th className="py-2 px-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-neutral-900">
                <td className="py-2 px-2">v{p.version_number}</td>
                <td className="py-2 px-2">{STATUS_AR[p.status] ?? p.status}</td>
                <td className="py-2 px-2">{p.brand?.name_ar ?? "—"}</td>
                <td className="py-2 px-2">{p.page?.name_ar ?? "—"}</td>
                <td className="py-2 px-2 text-neutral-500 text-xs">
                  {new Date(p.updated_at).toLocaleDateString("ar-SA")}
                </td>
                <td className="py-2 px-2">
                  <div className="flex gap-2">
                    {p.status !== "published" && (
                      <button onClick={() => publish(p.id)} disabled={busy === p.id}
                        className="text-xs rounded bg-neutral-100 text-neutral-900 px-2 py-1 font-semibold hover:bg-white disabled:opacity-60">
                        نشر
                      </button>
                    )}
                    <button onClick={() => duplicate(p)} disabled={busy === p.id}
                      className="text-xs rounded bg-neutral-800 border border-neutral-700 px-2 py-1 hover:bg-neutral-700 disabled:opacity-60">
                      نسخ كمسودة
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit && npm run build`
Expected: clean, build success.

- [ ] **Step 3: Commit**

```bash
cd /d/menulink && git add apps/web/app/ops/tenants/[id]/design/versions-tab.tsx && \
git commit -m "DS-2: Versions tab (list + set-published + duplicate)"
```

---

## Task 7: Link from the main tenant page

**Files:**
- Modify: `apps/web/app/ops/tenants/[id]/page.tsx` (the "التصميم البصري" section header, around line 81-85)

- [ ] **Step 1: Add the studio link to the design section header**

Find:
```tsx
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-semibold">التصميم البصري</h2>
          <span className="text-[10px] text-neutral-500">ops-only · المالك لا يرى هذه الحقول</span>
        </div>
```
Replace with:
```tsx
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-semibold">التصميم البصري</h2>
          <div className="flex items-center gap-3">
            <Link href={`/ops/tenants/${r.id}/design`} className="text-xs text-neutral-300 hover:text-white underline">
              استوديو التصميم →
            </Link>
            <span className="text-[10px] text-neutral-500">ops-only · المالك لا يرى هذه الحقول</span>
          </div>
        </div>
```
(`Link` is already imported at the top of this file.)

- [ ] **Step 2: Build**

Run: `cd /d/menulink/apps/web && npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /d/menulink && git add apps/web/app/ops/tenants/[id]/page.tsx && \
git commit -m "DS-2: link to Design Studio from tenant page"
```

---

## Task 8: End-to-end verification, proof, PR

**Files:**
- Create: `docs/proofs/DS-2-ops-design-studio.md`

- [ ] **Step 1: Full type-check + build + regression grep**

Run:
```bash
cd /d/menulink/apps/web && npx tsc --noEmit && npm run build && \
cd /d/menulink && grep -rn "@/lib/design" apps/web/app/m || echo "OK: /m does not import lib/design"
```
Expected: clean tsc, build success, and the customer PWA (`app/m`) still does **not** import `lib/design` (resolver wiring is DS-3).

- [ ] **Step 2: Manual studio smoke on `rzrz-bukhari-test`**

Run `npm run dev`, open `/ops/tenants/<clone-id>/design` (find the clone id: it is the `rzrz-bukhari-test` restaurant). Verify: pick a brand template → colors pre-fill → preview updates → Save draft → Brand Identity persists; Menu Page select + save; Versions shows the draft; Publish → row becomes published; publish a second draft → first flips to archived, only one published. Then delete the test profiles created (Versions has no delete — remove via the PAT cleanup below).

- [ ] **Step 3: Clean up any smoke rows on the clone**

Run (PowerShell):
```powershell
$pat = (Select-String -Path 'C:\Users\USER\.claude\projects\D--menulink\memory\reference_supabase_pat.md' -Pattern 'sbp_[A-Za-z0-9]+').Matches[0].Value
$uri = 'https://api.supabase.com/v1/projects/dhmjrrsynfvomlzhggvu/database/query'
$q = "delete from public.restaurant_design_profiles p using public.restaurants r where p.restaurant_id=r.id and r.slug='rzrz-bukhari-test'; select count(*) as remaining from public.restaurant_design_profiles p join public.restaurants r on r.id=p.restaurant_id where r.slug='rzrz-bukhari-test';"
$body = @{ query = $q } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization="Bearer $pat" } -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json
```
Expected: `remaining = 0`. (Confirms only clone data touched; production never used.)

- [ ] **Step 4: Write proof doc**

Create `docs/proofs/DS-2-ops-design-studio.md` covering: Goal · Scope (4 tabs) · Files changed · Migration 0060 (updated_at + RPC) · RPC verification results · Write paths/RLS · Build/tsc results · Guardrails verified (no `/m/[slug]` import, old form intact, clone-only testing) · Known limitations (no live effect until DS-3; RLS enforcement not provable via PAT) · Next phase (DS-3).

- [ ] **Step 5: Commit + push + draft PR**

```bash
cd /d/menulink && git add docs/proofs/DS-2-ops-design-studio.md && \
git commit -m "DS-2: proof doc" && \
git push -u origin ds-2-ops-design-studio
gh pr create --draft --base main --head ds-2-ops-design-studio \
  --title "DS-2: Ops Design Studio (4 tabs + publish RPC)" \
  --body "Implements DS-2 per docs/superpowers/specs/2026-05-29-ds-2-ops-design-studio-design.md. Migration 0060 (updated_at + atomic publish_design_profile RPC), studio at /ops/tenants/[id]/design (Overview/Brand/Menu/Versions). No /m/[slug] wiring (DS-3); existing DesignForm intact; verified on rzrz-bukhari-test. Stacked on DS-1 (#1)."
```
Expected: PR URL printed.

---

## Self-Review

**Spec coverage:**
- Sub-route + 4 tabs → Tasks 3–6. ✓
- Migration 0060 (updated_at + advisory-locked publish RPC, clean 1-based version) → Task 1. ✓
- Clear-split + pre-fill (template + live colors), Reset action, DS-3 note → Task 4 + Task 2 helper. ✓
- Draft via RLS / publish via RPC; no `restaurants` writes → Tasks 4–6. ✓
- Versions: list + set-published + duplicate, no manual archive → Task 6. ✓
- Ops-only preview via `resolveDesignTokens` → Task 4. ✓
- Link from tenant page; existing form intact → Task 7. ✓
- Clone-only testing → Tasks 1, 8. ✓

**Placeholder scan:** Task 3 deliberately creates 3 minimal client-tab stubs solely to keep the build green; Tasks 4–6 fully replace them. This is intentional staged scaffolding, not a shipped placeholder. No "TBD/handle later" remain.

**Type consistency:** Component prop names align with the server page's pass-through: `BrandIdentityTab{restaurant,draft,brandTemplates}`, `MenuPageTab{draft,pageTemplates}`, `VersionsTab{restaurantId,profiles}`, `OverviewTab{tenantId,profiles}`. RPC name `publish_design_profile` and param `p_profile_id` match the migration. `prefillBrandTokens(templateTokens, restaurant)` and `resolveDesignTokens({templateTokens, profileTokens})` match DS-1 signatures.

**Note on `default_config_json` / menu_tokens:** Menu Page tab only sets `menu_page_template_id` in DS-2 (menu token editing deferred — YAGNI). `menu_tokens_json` is copied on duplicate but not edited; acceptable for DS-2.
