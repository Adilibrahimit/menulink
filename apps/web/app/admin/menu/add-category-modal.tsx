"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function AddCategoryModal({
  restaurantId,
  nextSort,
  onClose,
  onCreated,
}: {
  restaurantId: string;
  nextSort: number;
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const sb = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [emoji, setEmoji] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!nameAr.trim()) return setErr("الاسم العربي مطلوب");

    setBusy(true);
    const slug =
      nameEn.trim()
        ? nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        : `cat-${Date.now()}`;

    const { error } = await sb.from("menu_categories").insert({
      restaurant_id: restaurantId,
      slug,
      name_ar: nameAr.trim(),
      name_en: nameEn.trim() || null,
      emoji: emoji.trim() || null,
      sort: nextSort,
    });

    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onCreated("أضيفت الفئة ✓");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-md p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">إضافة فئة</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl">×</button>
        </div>

        {err && <p className="rounded-md bg-red-50 text-red-700 text-sm p-3">{err}</p>}

        <label className="block">
          <span className="block text-xs font-medium text-neutral-700 mb-1">الاسم بالعربية</span>
          <input
            type="text"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder="مثال: المقبلات"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary"
            autoFocus
          />
        </label>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-brand-primary hover:underline"
        >
          {showAdvanced ? "إخفاء الحقول المتقدمة −" : "إظهار الحقول المتقدمة +"}
        </button>

        {showAdvanced && (
          <div className="space-y-3 border-t border-neutral-100 pt-3">
            <label className="block">
              <span className="block text-xs font-medium text-neutral-700 mb-1">الاسم بالإنجليزية (اختياري)</span>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g., Appetizers"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary text-left"
                dir="ltr"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-neutral-700 mb-1">إيموجي (اختياري)</span>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🍔"
                maxLength={4}
                className="w-20 rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary text-center"
              />
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-neutral-600 hover:bg-neutral-100"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-brand-primary text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "جاري الإضافة..." : "إضافة الفئة"}
          </button>
        </div>
      </form>
    </div>
  );
}
