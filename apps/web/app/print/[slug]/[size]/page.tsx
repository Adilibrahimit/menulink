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
