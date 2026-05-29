# DS-4-2 QR Profiles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** A QR tab in the design studio creates a `restaurant_qr_profile` + `qr_link` (encoding `{origin}/q/{code}`) and previews/downloads it client-side (PNG/SVG/poster).

**Architecture:** A `createQrCode` server action (generateShortCode + buildQrDestination) inserts the profile + link; `qr-tab.tsx` renders a create form + a list with `qrcode`/`menu-qr-poster` preview+download; `page.tsx` gains a 5th tab + data load. `menu-qr-poster` gains an optional `qrUrl` override. No migration.

**Tech Stack:** Next.js server action + client component, `qrcode`, `menu-qr-poster.ts`, DS-1 tables, DS-4-1 `/q` route.

**Verification:** `tsc --noEmit`, `next build` (`--max-old-space-size=8192`), manual create + download on `rzrz-bukhari-test`; clone-only.

**Branch:** `ds-4-2-qr-profiles` (spec committed there).

---

## File Structure
- Modify `apps/web/lib/menu-qr-poster.ts` — optional `qrUrl` override (2 edits).
- Create `apps/web/app/ops/tenants/[id]/design/qr-actions.ts` — `createQrCode` server action.
- Create `apps/web/app/ops/tenants/[id]/design/qr-tab.tsx` — QR create form + list/preview/download.
- Modify `apps/web/app/ops/tenants/[id]/design/page.tsx` — `qr` tab + data load + `tagline_ar`.

---

## Task 1: poster `qrUrl` override + `createQrCode` server action

**Files:** Modify `apps/web/lib/menu-qr-poster.ts`; Create `apps/web/app/ops/tenants/[id]/design/qr-actions.ts`.

- [ ] **Step 1: `menu-qr-poster.ts` — add optional `qrUrl`**

Find:
```ts
  tableLabel?: string | null;
  posterStyle?: "default" | "heritage-emerald";
};
```
Replace with:
```ts
  tableLabel?: string | null;
  posterStyle?: "default" | "heritage-emerald";
  qrUrl?: string;
};
```
Find:
```ts
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = opts.tableLabel
    ? `${origin}/m/${opts.slug}?table=${encodeURIComponent(opts.tableLabel)}`
    : `${origin}/m/${opts.slug}`;
```
Replace with:
```ts
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = opts.qrUrl
    ? opts.qrUrl
    : opts.tableLabel
    ? `${origin}/m/${opts.slug}?table=${encodeURIComponent(opts.tableLabel)}`
    : `${origin}/m/${opts.slug}`;
```

- [ ] **Step 2: Create `qr-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { generateShortCode, buildQrDestination, type QrTarget } from "@/lib/design/qr";

type Purpose = "menu" | "table" | "offer" | "category" | "item";

export async function createQrCode(input: {
  restaurantId: string;
  slug: string;
  templateId: string;
  nameAr: string;
  purpose: Purpose;
  target: string;
}): Promise<{ code?: string; error?: string }> {
  await requireOps();
  const sb = createClient();

  let qrTarget: QrTarget;
  switch (input.purpose) {
    case "menu": qrTarget = { type: "menu" }; break;
    case "table": qrTarget = { type: "table", tableLabel: input.target }; break;
    case "offer": qrTarget = { type: "offer", offerId: input.target }; break;
    case "category": qrTarget = { type: "category", categoryId: input.target }; break;
    case "item": qrTarget = { type: "item", itemId: input.target }; break;
  }
  const destination = buildQrDestination(input.slug, qrTarget);
  const code = generateShortCode();

  const { data: prof, error: e1 } = await sb
    .from("restaurant_qr_profiles")
    .insert({
      restaurant_id: input.restaurantId,
      qr_design_template_id: input.templateId,
      name_ar: input.nameAr || "رمز QR",
      purpose: input.purpose,
      status: "published",
    })
    .select("id").single();
  if (e1 || !prof) return { error: e1?.message ?? "profile insert failed" };

  const { error: e2 } = await sb.from("qr_links").insert({
    restaurant_id: input.restaurantId,
    qr_profile_id: prof.id,
    code,
    target_type: input.purpose,
    destination_url: destination,
    is_active: true,
  });
  if (e2) return { error: e2.message };

  revalidatePath(`/ops/tenants/${input.restaurantId}/design`);
  return { code };
}
```

- [ ] **Step 3: tsc**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**
```bash
cd /d/menulink && git add apps/web/lib/menu-qr-poster.ts ':(literal)apps/web/app/ops/tenants/[id]/design/qr-actions.ts' && git commit -m "DS-4-2: poster qrUrl override + createQrCode server action"
```

---

## Task 2: `qr-tab.tsx`

**Files:** Create `apps/web/app/ops/tenants/[id]/design/qr-tab.tsx`.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { generatePosterDataUrl, triggerDownload } from "@/lib/menu-qr-poster";
import { createQrCode } from "./qr-actions";

type Template = { id: string; key: string; name_ar: string };
type QrLinkRow = { id: string; code: string; target_type: string; is_active: boolean };
type QrProfileRow = { id: string; name_ar: string; purpose: string; links: QrLinkRow[] };
type Restaurant = {
  id: string; slug: string; name: string;
  logo_url: string | null; tagline_ar: string | null; primary_color: string;
};

const PURPOSES = ["menu", "table", "offer", "category", "item"] as const;
const PURPOSE_AR: Record<string, string> = {
  menu: "القائمة", table: "طاولة", offer: "عرض", category: "قسم", item: "صنف",
};

export default function QrTab({
  restaurant, templates, qrProfiles,
}: { restaurant: Restaurant; templates: Template[]; qrProfiles: QrProfileRow[] }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [nameAr, setNameAr] = useState("");
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>("menu");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function create() {
    if (!templateId) { setMsg({ kind: "err", text: "اختر قالباً" }); return; }
    setBusy(true); setMsg(null);
    const res = await createQrCode({ restaurantId: restaurant.id, slug: restaurant.slug, templateId, nameAr, purpose, target });
    setBusy(false);
    if (res.error) { setMsg({ kind: "err", text: res.error }); return; }
    setMsg({ kind: "ok", text: `تم إنشاء رمز QR (${res.code}) ✓` });
    setNameAr(""); setTarget("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className={`rounded-md text-sm p-3 ${msg.kind === "ok"
          ? "bg-green-900/40 border border-green-800 text-green-300"
          : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-sm">إنشاء رمز QR ديناميكي</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-neutral-400 mb-1">قالب التصميم</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400">
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-400 mb-1">الاسم</span>
            <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: بوستر المدخل"
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400" />
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-400 mb-1">الوجهة</span>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)}
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400">
              {PURPOSES.map((p) => <option key={p} value={p}>{PURPOSE_AR[p]}</option>)}
            </select>
          </label>
          {purpose !== "menu" && (
            <label className="block">
              <span className="block text-xs text-neutral-400 mb-1">{purpose === "table" ? "رقم الطاولة" : "المعرّف (id)"}</span>
              <input value={target} onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400" />
            </label>
          )}
        </div>
        <button onClick={create} disabled={busy}
          className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60">
          {busy ? "..." : "إنشاء"}
        </button>
        <p className="text-[10px] text-neutral-500">الرمز يشير إلى رابط ديناميكي /q/code يمكن إعادة توجيهه لاحقاً دون إعادة الطباعة.</p>
      </div>

      <div className="space-y-3">
        {qrProfiles.length === 0 && <p className="text-sm text-neutral-500">لا توجد رموز QR بعد.</p>}
        {qrProfiles.flatMap((p) => p.links.map((l) => (
          <QrLinkCard key={l.id} restaurant={restaurant} profileName={p.name_ar} link={l} />
        )))}
      </div>
    </div>
  );
}

function QrLinkCard({
  restaurant, profileName, link,
}: { restaurant: Restaurant; profileName: string; link: QrLinkRow }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = origin ? `${origin}/q/${link.code}` : "";

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      errorCorrectionLevel: "H", margin: 2, width: 180, color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [url]);

  async function dl(kind: "png" | "svg" | "poster") {
    if (!url) return;
    setBusy(kind);
    try {
      if (kind === "png") {
        const d = await QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 2, width: 1024 });
        triggerDownload(d, `${restaurant.slug}-${link.code}-qr.png`);
      } else if (kind === "svg") {
        const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H", margin: 2 });
        const u = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        triggerDownload(u, `${restaurant.slug}-${link.code}-qr.svg`);
        setTimeout(() => URL.revokeObjectURL(u), 1000);
      } else {
        const { dataUrl } = await generatePosterDataUrl({
          slug: restaurant.slug, restaurantName: restaurant.name, logoUrl: restaurant.logo_url,
          taglineAr: restaurant.tagline_ar, primaryColor: restaurant.primary_color,
          tableLabel: null, posterStyle: "default", qrUrl: url,
        });
        triggerDownload(dataUrl, `${restaurant.slug}-${link.code}-poster.png`);
      }
    } finally { setBusy(null); }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center">
      <canvas ref={canvasRef} className="rounded-lg bg-white p-1 shrink-0" />
      <div className="flex-1 min-w-0 text-center sm:text-right">
        <div className="text-sm text-neutral-100">{profileName} · {PURPOSE_AR[link.target_type] ?? link.target_type}</div>
        <div className="text-xs text-neutral-500 font-mono break-all" dir="ltr">/q/{link.code}{link.is_active ? "" : " (معطّل)"}</div>
        <div className="mt-2 flex gap-2 flex-wrap justify-center sm:justify-start">
          <button onClick={() => dl("poster")} disabled={busy !== null}
            className="text-xs rounded bg-neutral-100 text-neutral-900 px-2 py-1 font-semibold hover:bg-white disabled:opacity-60">{busy === "poster" ? "..." : "بوستر PNG"}</button>
          <button onClick={() => dl("png")} disabled={busy !== null}
            className="text-xs rounded bg-neutral-800 border border-neutral-700 px-2 py-1 hover:bg-neutral-700 disabled:opacity-60">QR PNG</button>
          <button onClick={() => dl("svg")} disabled={busy !== null}
            className="text-xs rounded bg-neutral-800 border border-neutral-700 px-2 py-1 hover:bg-neutral-700 disabled:opacity-60">QR SVG</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: tsc** → `cd /d/menulink/apps/web && npx tsc --noEmit` clean.
- [ ] **Step 3: Commit**
```bash
cd /d/menulink && git add ':(literal)apps/web/app/ops/tenants/[id]/design/qr-tab.tsx' && git commit -m "DS-4-2: QR tab (create form + preview + download)"
```

---

## Task 3: wire `page.tsx`

**Files:** Modify `apps/web/app/ops/tenants/[id]/design/page.tsx`.

- [ ] **Step 1: import + tab + tagline + data load + render**

Edit A — import. Find `import VersionsTab from "./versions-tab";` → append line `import QrTab from "./qr-tab";`.

Edit B — TABS. Find:
```tsx
  { key: "versions", label: "الإصدارات" },
] as const;
```
Replace with:
```tsx
  { key: "versions", label: "الإصدارات" },
  { key: "qr", label: "رموز QR" },
] as const;
```

Edit C — restaurants select add tagline_ar. Find:
```tsx
        .select("id, slug, name, logo_url, cover_image_url, primary_color, background_color")
```
Replace with:
```tsx
        .select("id, slug, name, logo_url, cover_image_url, primary_color, background_color, tagline_ar")
```

Edit D — data load + destructure. Find:
```tsx
  const [{ data: r }, { data: profiles }, { data: brandTemplates }, { data: pageTemplates }] =
    await Promise.all([
```
Replace with:
```tsx
  const [{ data: r }, { data: profiles }, { data: brandTemplates }, { data: pageTemplates }, { data: qrProfiles }, { data: qrTemplates }] =
    await Promise.all([
```
And find (the closing of the Promise.all array — the `menu_page_templates` query + `]);`):
```tsx
      sb.from("menu_page_templates")
        .select("id, key, name_ar, layout_type, supported_business_types")
        .eq("is_active", true).order("key", { ascending: true }),
    ]);
```
Replace with:
```tsx
      sb.from("menu_page_templates")
        .select("id, key, name_ar, layout_type, supported_business_types")
        .eq("is_active", true).order("key", { ascending: true }),
      sb.from("restaurant_qr_profiles")
        .select("id, name_ar, purpose, links:qr_links(id, code, target_type, is_active)")
        .eq("restaurant_id", params.id)
        .order("created_at", { ascending: false }),
      sb.from("qr_design_templates")
        .select("id, key, name_ar")
        .eq("is_active", true).order("key", { ascending: true }),
    ]);
```

Edit E — render branch. Find:
```tsx
        {active === "versions" && <VersionsTab restaurantId={r.id} profiles={rows as any} />}
      </div>
```
Replace with:
```tsx
        {active === "versions" && <VersionsTab restaurantId={r.id} profiles={rows as any} />}
        {active === "qr" && (
          <QrTab restaurant={r as any} templates={(qrTemplates ?? []) as any} qrProfiles={(qrProfiles ?? []) as any} />
        )}
      </div>
```

- [ ] **Step 2: tsc + build** → `cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=8192 npm run build` clean + SUCCESS.
- [ ] **Step 3: Commit**
```bash
cd /d/menulink && git add ':(literal)apps/web/app/ops/tenants/[id]/design/page.tsx' && git commit -m "DS-4-2: wire QR tab into the studio"
```

---

## Task 4: verification + proof + PR (MAIN AGENT)

- [ ] **Step 1:** `tsc` + `build` green.
- [ ] **Step 2 (clone, optional DB sanity):** confirm no production QR profiles exist; (the create flow is exercised via the UI/server action — `createQrCode` is ops-authenticated). Spot-check via PAT that `restaurant_qr_profiles`/`qr_links` for `rzrz-bukhari-test` can be created and that `resolve_qr_link(code)` (DS-4-1) returns the destination.
- [ ] **Step 3:** Write `docs/proofs/DS-4-2-qr-profiles.md` (Goal · Files · server action · QR tab · preview/download reuse · no migration · Guardrails: /admin/qr + table-QR + MenuQR untouched, ops-only, clone-only · Known limitations: no qr_exports/storage [DS-7], simple target inputs, no repoint/deactivate UI · Next: DS-5). Commit.
- [ ] **Step 4:** push + draft PR (base main):
```bash
cd /d/menulink && git push -u origin ds-4-2-qr-profiles
gh pr create --draft --base main --head ds-4-2-qr-profiles --title "DS-4-2: QR profiles + dynamic link + preview/download" --body "QR tab creates restaurant_qr_profile + qr_link (encodes /q/{code}); preview + client PNG/SVG/poster download (reuse MenuQR). createQrCode server action; menu-qr-poster gains optional qrUrl. No migration; qr_exports/storage -> DS-7. Existing QR untouched."
```

---

## Self-Review
- Server action (profile+link, generateShortCode/buildQrDestination) → Task 1. ✓
- QR tab create form + list + preview + PNG/SVG/poster → Task 2. ✓
- Poster encodes /q/{code} via the new `qrUrl` override → Task 1 + Task 2 (`qrUrl: url`). ✓
- page.tsx 5th tab + data load (qr profiles+links embed, qr templates) + tagline_ar for the poster → Task 3. ✓
- No migration; reuse `qrcode`/`menu-qr-poster`; ops-only; clone-only → all tasks. ✓
- Type consistency: `createQrCode` input shape matches the call in `qr-tab`; `QrTarget` import from `@/lib/design/qr`; embed alias `links:qr_links(...)` (FK `qr_profile_id`); `generatePosterDataUrl({..., qrUrl})` matches the extended `PosterOpts`.
