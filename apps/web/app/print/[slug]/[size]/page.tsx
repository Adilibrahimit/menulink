import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase-server";
import { toArabicDigits } from "@/lib/arabic";
import { ALLERGEN_MAP } from "@/lib/allergens";
import { SLUG_TO_IMG } from "@/lib/koko-images";
import { resolvePrintTokens } from "@/lib/print-design";
import MenuPoster, { posterHasPhotos } from "./menu-poster";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

type PVariant = { label: string | null; price: number };
type PItem = {
  id: string; slug: string; name_ar: string; description_ar: string | null;
  image_url: string | null; calories_kcal: number | null;
  allergens: string[] | null; variants: PVariant[];
};
type PCategory = { id: string; name_ar: string; emoji: string | null; info_ar?: string | null; items: PItem[] };
type PMenu = {
  restaurant: {
    name: string; tagline_ar: string | null; logo_url: string | null; primary_color: string;
    address_ar: string | null; city: string | null; instagram_handle: string | null;
    hours_json: Record<string, string> | null;
  };
  categories: PCategory[];
};

const allergenLabel = (k: string) =>
  (ALLERGEN_MAP as Map<string, { label_ar?: string }>).get(k)?.label_ar ?? k;
const imgFor = (it: PItem) => it.image_url ?? SLUG_TO_IMG[it.slug] ?? null;
const priceText = (vs: PVariant[]) =>
  vs.map((v) => `${v.label ? v.label + " " : ""}${toArabicDigits(String(v.price))}`).join(" · ");

export default async function PrintMenuPage({ params }: { params: { slug: string; size: string } }) {
  const size = params.size === "a3" ? "a3" : "a4";
  const pageCss = size === "a3" ? "A3 landscape" : "A4 portrait";
  const cols = size === "a3" ? 3 : 2;

  const sb = createClient();
  const { data } = await sb.rpc("get_public_menu", { p_slug: params.slug });
  const menu = data as PMenu | null;
  if (!menu) notFound();
  const r = menu.restaurant;

  // Design-aware palette: premium-epicurean -> dark/gold, else light brand.
  const { data: rDesign } = await sb
    .from("restaurants").select("menu_design_key").eq("slug", params.slug).maybeSingle();
  const t = resolvePrintTokens(
    (rDesign as { menu_design_key?: string | null } | null)?.menu_design_key,
    r.primary_color,
  );

  // Order QR -> the live customer menu (host-derived so it works on any domain).
  const host = headers().get("host") ?? "menulink-admin-five.vercel.app";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const menuUrl = `${proto}://${host}/m/${params.slug}`;
  const qrSvg = await QRCode.toString(menuUrl, {
    type: "svg", margin: 0, errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" }, // QR always dark-on-light (readability)
  });

  // size=poster -> single-page curated "signature" poster (luxe-framed). The
  // poster is photo-forward; with no usable photos we fall through to the
  // standard A4 menu below rather than render an empty frame.
  if (params.size === "poster" && posterHasPhotos(menu)) {
    return (
      <>
        <style>{`@media print{.no-print{display:none!important;}}`}</style>
        <div className="no-print" style={{ position: "fixed", top: 10, insetInlineEnd: 10, zIndex: 50 }}>
          <PrintButton />
        </div>
        <MenuPoster menu={menu} t={t} qrSvg={qrSvg} />
      </>
    );
  }

  // Hero spotlight = first item that has a photo (data-driven, no invented copy).
  let featured: PItem | null = null;
  for (const c of menu.categories) {
    const f = c.items.find((it) => imgFor(it));
    if (f) { featured = f; break; }
  }
  const featuredImg = featured ? imgFor(featured) : null;

  const hoursToday = (() => {
    if (!r.hours_json) return null;
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const k = days[new Date().getDay()];
    return r.hours_json[k] ?? null;
  })();
  const today = new Date().toLocaleDateString("ar-SA");
  const totalItems = menu.categories.reduce((s, c) => s + c.items.length, 0);

  const css =
    `@page{size:${pageCss};margin:8mm;}` +
    `*{box-sizing:border-box;}` +
    `html,body{background:${t.bg};margin:0;}` +
    `html{print-color-adjust:exact;-webkit-print-color-adjust:exact;}` +
    `.print-root{background:${t.bg};color:${t.ink};font-family:Tajawal,Cairo,system-ui,sans-serif;padding:14px;max-width:1180px;margin:0 auto;}` +
    `.sec{break-inside:avoid;}` +
    `.card{break-inside:avoid;}` +
    `@media print{.no-print{display:none!important;}}`;

  const accentChip = { background: t.accent, color: t.accentText } as const;

  return (
    <div dir="rtl" className="print-root">
      <style>{css}</style>
      <div className="no-print" style={{ marginBottom: 12 }}><PrintButton /></div>

      {/* ===== top strip: logo · hours/contact · order QR ===== */}
      <header style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 12, marginBottom: 12, borderBottom: `2px solid ${t.accent}` }}>
        {r.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.logo_url} alt="" style={{ width: 58, height: 58, objectFit: "cover", borderRadius: 12, border: `1px solid ${t.cardBorder}` }} />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: t.secondary, display: "flex", flexWrap: "wrap", gap: 12 }}>
            {hoursToday ? <span>🕑 {hoursToday}</span> : null}
            {r.city ? <span>📍 {r.city}</span> : null}
            {r.instagram_handle ? <span>📷 @{r.instagram_handle.replace(/^@/, "")}</span> : null}
            <span>🍽️ {toArabicDigits(String(totalItems))} صنف</span>
          </div>
          <div style={{ fontSize: 11, color: t.secondary, marginTop: 4 }}>
            جميع الأسعار شاملة ضريبة القيمة المضافة (15%)
          </div>
        </div>
        {/* order QR card — always light for scan reliability */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 8, textAlign: "center", width: 104, border: `1px solid ${t.cardBorder}` }}>
          <div style={{ width: 80, height: 80, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div style={{ fontSize: 10, fontWeight: 800, color: "#111", marginTop: 4 }}>امسح للطلب</div>
        </div>
      </header>

      {/* ===== hero band: featured dish + name + tagline ===== */}
      {featuredImg ? (
        <section className="sec" style={{ position: "relative", height: size === "a3" ? 180 : 168, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={featuredImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: t.heroScrim }} />
          <div style={{ position: "absolute", insetInlineStart: 0, bottom: 0, padding: 20, maxWidth: "70%" }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: t.accent, lineHeight: 1.1, textShadow: t.isDark ? "0 0 16px rgba(230,195,131,0.25)" : "0 1px 8px rgba(0,0,0,0.4)" }}>
              {r.name}
            </h1>
            {r.tagline_ar ? (
              <p style={{ margin: "6px 0 0", fontSize: 14, color: t.isDark ? t.secondary : "#f3ece0", fontWeight: 600 }}>{r.tagline_ar}</p>
            ) : null}
          </div>
        </section>
      ) : (
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: t.accent }}>{r.name}</h1>
          {r.tagline_ar ? <p style={{ margin: "4px 0 0", color: t.secondary }}>{r.tagline_ar}</p> : null}
        </header>
      )}

      {/* ===== category sections — photo cards ===== */}
      {menu.categories.filter((c) => c.items.length > 0).map((c) => (
        <section key={c.id} className="sec" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ width: 6, height: 22, borderRadius: 3, background: t.accent, display: "inline-block" }} />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.ink }}>
              {c.emoji ? `${c.emoji} ` : ""}{c.name_ar}
            </h2>
            <span style={{ flex: 1, height: 1, background: t.divider }} />
            {c.info_ar ? <span style={{ fontSize: 11, color: t.secondary }}>{c.info_ar}</span> : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
            {c.items.map((it) => {
              const img = imgFor(it);
              return (
                <div key={it.id} className="card" style={{ display: "flex", gap: 10, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: 8, overflow: "hidden" }}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 9, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 76, height: 76, borderRadius: 9, flexShrink: 0, background: t.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, opacity: 0.6 }}>
                      {c.emoji || "🍽️"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: t.ink, lineHeight: 1.25 }}>{it.name_ar}</div>
                    {it.description_ar ? (
                      <div style={{ fontSize: 11, color: t.secondary, marginTop: 2, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {it.description_ar}
                      </div>
                    ) : null}
                    <div style={{ marginTop: "auto", paddingTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 13, padding: "2px 8px", borderRadius: 999, ...accentChip }}>
                        {priceText(it.variants)} ر.س
                      </span>
                      {it.calories_kcal ? (
                        <span style={{ fontSize: 10, color: t.secondary }}>🔥 {toArabicDigits(String(it.calories_kcal))} سعرة</span>
                      ) : <span />}
                    </div>
                    {it.allergens && it.allergens.length > 0 ? (
                      <div style={{ fontSize: 9, color: t.secondary, opacity: 0.85, marginTop: 3 }}>
                        ⚠️ {it.allergens.map(allergenLabel).join("، ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* ===== footer: info icons + disclaimers ===== */}
      <footer className="sec" style={{ marginTop: 18, background: t.surface, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", marginBottom: 10, fontSize: 11, color: t.ink }}>
          {[["👨 رجل", "~٢٥٠٠ سعرة"], ["👩 امرأة", "~٢٠٠٠ سعرة"], ["👦 طفل", "~١٤٠٠-٢٠٠٠"]].map(([a, b]) => (
            <span key={a} style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <b style={{ color: t.accent }}>{a}</b><span style={{ color: t.secondary }}>{b}</span>
            </span>
          ))}
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 11, color: t.secondary, textAlign: "center" }}>
          ⚠️ يرجى إعلام الموظف بأي حساسية غذائية قبل الطلب. السعرات الحرارية إرشادية. المصدر: الهيئة العامة للغذاء والدواء (SFDA).
        </p>
        <p style={{ margin: 0, fontSize: 10, color: t.secondary, opacity: 0.7, textAlign: "center" }}>
          {r.name}{r.address_ar ? ` · ${r.address_ar}` : ""} · آخر تحديث {today} · Powered by MenuLink
        </p>
      </footer>
    </div>
  );
}
