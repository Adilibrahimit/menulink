"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPromotion, setPromotionActive, deletePromotion } from "./promotions-actions";

type Promo = {
  id: string; title_ar: string; subtitle_ar: string | null; badge_text_ar: string | null;
  priority: number; is_active: boolean; show_on_menu_home: boolean;
  starts_at: string | null; ends_at: string | null;
};

const I = "w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400";

export default function PromosTab({ restaurantId, promotions }: { restaurantId: string; promotions: Promo[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ titleAr: "", subtitleAr: "", badgeTextAr: "", imageUrl: "", priority: "0", startsAt: "", endsAt: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function create() {
    setBusy(true); setMsg(null);
    const res = await createPromotion({
      restaurantId, titleAr: form.titleAr, subtitleAr: form.subtitleAr, badgeTextAr: form.badgeTextAr,
      imageUrl: form.imageUrl, priority: parseInt(form.priority || "0", 10), startsAt: form.startsAt, endsAt: form.endsAt,
    });
    setBusy(false);
    if (res.error) { setMsg({ kind: "err", text: res.error }); return; }
    setMsg({ kind: "ok", text: "تم إنشاء العرض ✓" });
    setForm({ titleAr: "", subtitleAr: "", badgeTextAr: "", imageUrl: "", priority: "0", startsAt: "", endsAt: "" });
    router.refresh();
  }
  async function toggle(id: string, active: boolean) { setBusy(true); await setPromotionActive({ restaurantId, id, active }); setBusy(false); router.refresh(); }
  async function remove(id: string) { if (!confirm("حذف العرض؟")) return; setBusy(true); await deletePromotion({ restaurantId, id }); setBusy(false); router.refresh(); }

  return (
    <div className="space-y-6">
      {msg && <p className={`rounded-md text-sm p-3 ${msg.kind === "ok" ? "bg-green-900/40 border border-green-800 text-green-300" : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-sm">عرض جديد</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block"><span className="block text-xs text-neutral-400 mb-1">العنوان</span><input className={I} value={form.titleAr} onChange={(e) => set("titleAr", e.target.value)} placeholder="عرض اليوم" /></label>
          <label className="block"><span className="block text-xs text-neutral-400 mb-1">العنوان الفرعي</span><input className={I} value={form.subtitleAr} onChange={(e) => set("subtitleAr", e.target.value)} /></label>
          <label className="block"><span className="block text-xs text-neutral-400 mb-1">شارة</span><input className={I} value={form.badgeTextAr} onChange={(e) => set("badgeTextAr", e.target.value)} placeholder="جديد" /></label>
          <label className="block"><span className="block text-xs text-neutral-400 mb-1">الأولوية</span><input type="number" className={I} value={form.priority} onChange={(e) => set("priority", e.target.value)} /></label>
          <label className="block"><span className="block text-xs text-neutral-400 mb-1">رابط صورة (اختياري)</span><input className={I} value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} dir="ltr" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="block text-xs text-neutral-400 mb-1">يبدأ</span><input type="date" className={I} value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></label>
            <label className="block"><span className="block text-xs text-neutral-400 mb-1">ينتهي</span><input type="date" className={I} value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></label>
          </div>
        </div>
        <button onClick={create} disabled={busy} className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60">{busy ? "..." : "إنشاء العرض"}</button>
      </div>
      <div className="space-y-2">
        {promotions.length === 0 && <p className="text-sm text-neutral-500">لا توجد عروض.</p>}
        {promotions.map((p) => (
          <div key={p.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm text-neutral-100">{p.badge_text_ar ? `[${p.badge_text_ar}] ` : ""}{p.title_ar}{p.is_active ? "" : " · (موقوف)"}</div>
              {p.subtitle_ar && <div className="text-xs text-neutral-500">{p.subtitle_ar}</div>}
              <div className="text-[10px] text-neutral-600">أولوية {p.priority}{p.ends_at ? ` · ينتهي ${new Date(p.ends_at).toLocaleDateString("ar-SA")}` : ""}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggle(p.id, !p.is_active)} disabled={busy} className="text-xs rounded bg-neutral-800 border border-neutral-700 px-2 py-1 hover:bg-neutral-700 disabled:opacity-60">{p.is_active ? "إيقاف" : "تفعيل"}</button>
              <button onClick={() => remove(p.id)} disabled={busy} className="text-xs rounded border border-red-800/60 text-red-400 px-2 py-1 hover:bg-red-900/30 disabled:opacity-60">حذف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
