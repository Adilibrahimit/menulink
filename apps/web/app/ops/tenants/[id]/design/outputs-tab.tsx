"use client";

// Outputs tab — print-ready menu outputs for a tenant.
//   * Print links: open /print/[slug]/[size] in a new tab (browser print-to-PDF)
//       a4 / a3 -> full booklet menu (DS-10); poster -> signature poster (DS-11)
//   * Poster overrides (DS-12): pin the poster's hero (signature dish) + offer,
//       overriding the automatic price-rank curation. Saved to restaurants via
//       the browser client (same pattern as design-form.tsx).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type PosterItem = { id: string; name_ar: string; category_ar: string };

const OUTPUTS = [
  { size: "a4", label: "القائمة A4", hint: "قائمة كاملة عمودية" },
  { size: "a3", label: "القائمة A3", hint: "قائمة كاملة عريضة" },
  { size: "poster", label: "بوستر A4", hint: "صفحة واحدة مميّزة (طبق التوقيع + عرض)" },
] as const;

export default function OutputsTab({
  tenantId, slug, heroItemId, offerItemId, posterItems,
}: {
  tenantId: string;
  slug: string;
  heroItemId: string | null;
  offerItemId: string | null;
  posterItems: PosterItem[];
}) {
  return (
    <div className="space-y-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">المخرجات المطبوعة</h3>
          <p className="text-[11px] text-neutral-500 mt-1">
            تُفتح في تبويب جديد للطباعة أو الحفظ كـ PDF. تُبنى من بيانات القائمة الحالية.
          </p>
        </div>
        <ul className="divide-y divide-neutral-800">
          {OUTPUTS.map((o) => (
            <li key={o.size} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm text-neutral-100">{o.label}</div>
                <div className="text-[11px] text-neutral-500">{o.hint}</div>
              </div>
              <a
                href={`/print/${slug}/${o.size}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs rounded bg-neutral-100 text-neutral-900 px-3 py-1.5 font-semibold hover:bg-white"
              >
                فتح ↗
              </a>
            </li>
          ))}
        </ul>
      </div>

      <PosterOverrides
        tenantId={tenantId}
        heroItemId={heroItemId}
        offerItemId={offerItemId}
        posterItems={posterItems}
      />
    </div>
  );
}

function PosterOverrides({
  tenantId, heroItemId, offerItemId, posterItems,
}: {
  tenantId: string;
  heroItemId: string | null;
  offerItemId: string | null;
  posterItems: PosterItem[];
}) {
  const router = useRouter();
  const sb = createClient();
  const [hero, setHero] = useState(heroItemId ?? "");
  const [offer, setOffer] = useState(offerItemId ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const { error } = await sb
      .from("restaurants")
      .update({ poster_hero_item_id: hero || null, poster_offer_item_id: offer || null })
      .eq("id", tenantId);
    setBusy(false);
    if (error) { setMsg({ kind: "err", text: error.message }); return; }
    setMsg({ kind: "ok", text: "تم الحفظ ✓" });
    router.refresh();
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">تخصيص البوستر</h3>
        <p className="text-[11px] text-neutral-500 mt-1">
          اختر طبق التوقيع وعرض اليوم في بوستر A4. «تلقائي» = الأغلى سعراً تلقائياً.
        </p>
      </div>

      {msg && (
        <p className={`rounded-md text-sm p-2.5 ${msg.kind === "ok"
          ? "bg-green-900/40 border border-green-800 text-green-300"
          : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>
      )}

      {posterItems.length === 0 ? (
        <p className="text-xs text-neutral-500">
          لا توجد أصناف بصور بعد — البوستر يستخدم الأصناف التي تحتوي صورة فقط.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ItemSelect label="طبق التوقيع (Hero)" value={hero} onChange={setHero} items={posterItems} />
            <ItemSelect label="عرض اليوم (Offer)" value={offer} onChange={setOffer} items={posterItems} />
          </div>
          <button onClick={save} disabled={busy}
            className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60">
            {busy ? "..." : "حفظ"}
          </button>
          <p className="text-[10px] text-neutral-600">
            إذا حُذف الصنف المختار أو أزيلت صورته، يعود البوستر للاختيار التلقائي.
          </p>
        </>
      )}
    </div>
  );
}

function ItemSelect({
  label, value, onChange, items,
}: {
  label: string; value: string; onChange: (v: string) => void; items: PosterItem[];
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-400 mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400">
        <option value="">تلقائي (الأغلى سعراً)</option>
        {items.map((it) => (
          <option key={it.id} value={it.id}>{it.category_ar} · {it.name_ar}</option>
        ))}
      </select>
    </label>
  );
}
