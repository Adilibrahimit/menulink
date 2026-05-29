# DS-5 Print Routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Public `/print/[slug]/[size]` (a3|a4) renders a print-ready full menu from `get_public_menu`; the operator prints-to-PDF from the browser. Compliance footer (VAT/calories/last-updated).

**Architecture:** Server component reads the menu, injects `@page` CSS for the size via `<style>{css}</style>` (static, validated size — no `dangerouslySetInnerHTML`), renders categories/items light-themed with `break-inside: avoid`; a client Print button calls `window.print()`. One link from the ops tenant page. No migration; server PDF/storage → DS-7.

**Verification:** `tsc --noEmit`, `next build` (`--max-old-space-size=8192`), smoke `/print/rzrz-bukhari-test/a4` & `/a3`.

**Branch:** `ds-5-print-routes` (spec committed there).

---

## File Structure
- Create `apps/web/app/print/[slug]/[size]/print-button.tsx` — client `window.print()` button.
- Create `apps/web/app/print/[slug]/[size]/page.tsx` — server print page.
- Modify `apps/web/app/ops/tenants/[id]/page.tsx` — one print link.

---

## Task 1: print route (button + page) + tenant link

**Files:** Create the two print files; modify the tenant page.

- [ ] **Step 1: `print-button.tsx`**

```tsx
"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ background: "#111", color: "#fff", padding: "8px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", border: "none" }}
    >
      🖨️ طباعة / حفظ PDF
    </button>
  );
}
```

- [ ] **Step 2: `page.tsx`** (note: `<style>{css}</style>` — a single string child, NOT `dangerouslySetInnerHTML`; `css` is built from the validated `a3`/`a4` size, not user input)

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { toArabicDigits } from "@/lib/arabic";
import { ALLERGEN_MAP } from "@/lib/allergens";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

type PVariant = { label: string | null; price: number };
type PItem = {
  id: string; name_ar: string; description_ar: string | null;
  calories_kcal: number | null; allergens: string[] | null; variants: PVariant[];
};
type PCategory = { id: string; name_ar: string; emoji: string | null; items: PItem[] };
type PMenu = {
  restaurant: { name: string; tagline_ar: string | null; logo_url: string | null; primary_color: string };
  categories: PCategory[];
};

const allergenLabel = (k: string) =>
  (ALLERGEN_MAP as Map<string, { label_ar?: string }>).get(k)?.label_ar ?? k;

export default async function PrintMenuPage({ params }: { params: { slug: string; size: string } }) {
  const size = params.size === "a3" ? "a3" : "a4";
  const pageCss = size === "a3" ? "A3 landscape" : "A4 portrait";
  const cols = size === "a3" ? "1fr 1fr 1fr" : "1fr 1fr";

  const sb = createClient();
  const { data } = await sb.rpc("get_public_menu", { p_slug: params.slug });
  const menu = data as PMenu | null;
  if (!menu) notFound();
  const r = menu.restaurant;
  const today = new Date().toLocaleDateString("ar-SA");

  const css =
    `@page{size:${pageCss};margin:10mm;}` +
    `html,body{background:#fff;}` +
    `.print-root{color:#1a1a1a;font-family:Tajawal,Cairo,system-ui,sans-serif;padding:16px;max-width:1100px;margin:0 auto;}` +
    `html{print-color-adjust:exact;-webkit-print-color-adjust:exact;}` +
    `@media print{.no-print{display:none!important;}}`;

  return (
    <div dir="rtl" className="print-root">
      <style>{css}</style>
      <div className="no-print" style={{ marginBottom: 12 }}><PrintButton /></div>

      <header style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: `3px solid ${r.primary_color}`, paddingBottom: 12, marginBottom: 16 }}>
        {r.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.logo_url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12 }} />
        ) : null}
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: r.primary_color }}>{r.name}</h1>
          {r.tagline_ar ? <p style={{ margin: "4px 0 0", color: "#555" }}>{r.tagline_ar}</p> : null}
        </div>
      </header>

      {menu.categories.map((c) => (
        <section key={c.id} style={{ marginBottom: 18, breakInside: "avoid" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: r.primary_color, borderBottom: "1px solid #e5e5e5", paddingBottom: 4, marginBottom: 8 }}>
            {c.emoji ? `${c.emoji} ` : ""}{c.name_ar}
          </h2>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: cols }}>
            {c.items.map((it) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, breakInside: "avoid", borderBottom: "1px dotted #e0e0e0", paddingBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{it.name_ar}</div>
                  {it.description_ar ? <div style={{ fontSize: 12, color: "#777" }}>{it.description_ar}</div> : null}
                  {(it.calories_kcal || (it.allergens && it.allergens.length > 0)) ? (
                    <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                      {it.calories_kcal ? `🔥 ${toArabicDigits(String(it.calories_kcal))} سعرة` : ""}
                      {it.allergens && it.allergens.length > 0 ? `  ⚠️ ${it.allergens.map(allergenLabel).join("، ")}` : ""}
                    </div>
                  ) : null}
                </div>
                <div style={{ fontWeight: 800, color: r.primary_color, whiteSpace: "nowrap" }}>
                  {it.variants.map((v) => `${v.label ? v.label + " " : ""}${toArabicDigits(String(v.price))} ر.س`).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <footer style={{ marginTop: 20, borderTop: "1px solid #e5e5e5", paddingTop: 10, fontSize: 11, color: "#777" }}>
        <p style={{ margin: 0 }}>جميع الأسعار شاملة ضريبة القيمة المضافة (15%).</p>
        <p style={{ margin: "2px 0 0" }}>السعرات الحرارية إرشادية · متوسط احتياج البالغ ٢٠٠٠ سعرة في اليوم.</p>
        <p style={{ margin: "2px 0 0" }}>آخر تحديث: {today} · {r.name}</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: tenant-page print link.** In `apps/web/app/ops/tenants/[id]/page.tsx`, find:
```tsx
            <Link href={`/ops/tenants/${r.id}/design`} className="text-xs text-neutral-300 hover:text-white underline">
              استوديو التصميم →
            </Link>
```
Replace with:
```tsx
            <Link href={`/ops/tenants/${r.id}/design`} className="text-xs text-neutral-300 hover:text-white underline">
              استوديو التصميم →
            </Link>
            <a href={`/print/${r.slug}/a4`} target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-300 hover:text-white underline">
              🖨️ طباعة المنيو
            </a>
```

- [ ] **Step 4: tsc + build** → `cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=8192 npm run build` clean + SUCCESS; `/print/[slug]/[size]` in the route list.

- [ ] **Step 5: Commit**
```bash
cd /d/menulink && git add ':(literal)apps/web/app/print/[slug]/[size]/print-button.tsx' ':(literal)apps/web/app/print/[slug]/[size]/page.tsx' ':(literal)apps/web/app/ops/tenants/[id]/page.tsx' && git commit -m "DS-5: A3/A4 print routes + tenant print link"
```

---

## Task 2: verify + proof + PR + merge (MAIN AGENT)
- [ ] `tsc` + `build` green; `/print/[slug]/[size]` present.
- [ ] Smoke (operator browser step): `/print/rzrz-bukhari-test/a4` & `/a3` render menu + compliance footer; `/print/<bad>` → 404.
- [ ] Proof `docs/proofs/DS-5-print-routes.md` (Goal · Files · route + `@page` CSS + compliance blocks · no migration · Guardrails: additive, reads public RPC, existing surfaces untouched, `<style>` string child not dangerouslySetInnerHTML · Known limitations: browser-PDF only; server PDF/storage/`print_exports` → DS-7 · Next: DS-6). Commit, push, draft PR (base main), then merge+deploy.

---

## Self-Review
- A3/A4 print route from live menu + `@page` size + RTL + compliance footer → Task 1. ✓
- Browser print-to-PDF (PrintButton) → Task 1. ✓ · Link from ops → Task 1 Step 3. ✓
- No migration; server PDF/storage deferred → DS-7. ✓
- Security: CSS injected via `<style>{css}</style>` (single string child), `css` built only from the validated `a3`/`a4` size — no `dangerouslySetInnerHTML`, no untrusted interpolation.
- Type consistency: local `PMenu` matches the `get_public_menu` fields used; `allergenLabel` casts `ALLERGEN_MAP` to a string-keyed map (avoids importing `AllergenKey` across the `[slug]` route); `breakInside` is a valid CSSProperties key; `dynamic="force-dynamic"`.
