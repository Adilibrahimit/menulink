"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import UnsplashPicker from "./unsplash-picker";
import { optimizeImage, fetchAndOptimize } from "./optimize-image";

type Cat = { id: string; name_ar: string };

export default function AddItemModal({
  restaurantId,
  categories,
  defaultCategoryId,
  onClose,
  onCreated,
}: {
  restaurantId: string;
  categories: Cat[];
  defaultCategoryId?: string;
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const sb = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? "");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [price, setPrice] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showUnsplash, setShowUnsplash] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  async function pickImage(f: File | null) {
    if (!f) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErr("حجم الصورة أكبر من 10 ميغا");
      return;
    }
    if (!f.type.startsWith("image/")) {
      setErr("الملف يجب أن يكون صورة");
      return;
    }
    setErr(null);
    setOptimizing(true);
    try {
      const optimized = await optimizeImage(f);
      setImageFile(optimized);
      setImagePreview(URL.createObjectURL(optimized));
    } catch {
      setImageFile(f);
      setImagePreview(URL.createObjectURL(f));
    }
    setOptimizing(false);
  }

  async function pickFromUnsplash(url: string) {
    setShowUnsplash(false);
    setErr(null);
    setOptimizing(true);
    try {
      const optimized = await fetchAndOptimize(url);
      setImageFile(optimized);
      setImagePreview(URL.createObjectURL(optimized));
    } catch {
      setErr("فشل تحميل الصورة من الإنترنت");
    }
    setOptimizing(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!categoryId) return setErr("اختر فئة");
    if (!nameAr.trim()) return setErr("الاسم العربي مطلوب");
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) return setErr("السعر غير صحيح");

    setBusy(true);

    const slug = `item-${Date.now()}`;
    const { data: it, error: e1 } = await sb
      .from("menu_items")
      .insert({
        restaurant_id: restaurantId,
        category_id: categoryId,
        slug,
        name_ar: nameAr.trim(),
        name_en: nameEn.trim() || null,
        description_ar: descriptionAr.trim() || null,
        sort: 999,
      })
      .select("id")
      .single();

    if (e1 || !it) {
      setBusy(false);
      setErr(e1?.message ?? "تعذّر إنشاء الصنف");
      return;
    }

    const { error: e2 } = await sb.from("menu_item_variants").insert({
      menu_item_id: it.id,
      variant_key: "single",
      variant_label_ar: "",
      price: priceNum,
      sort: 1,
    });

    if (e2) {
      setBusy(false);
      setErr(`الصنف أُنشئ، لكن فشل السعر: ${e2.message}`);
      return;
    }

    if (imageFile) {
      const ext = (imageFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${restaurantId}/${it.id}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("menu-images")
        .upload(path, imageFile, { upsert: true, contentType: imageFile.type });
      if (upErr) {
        setBusy(false);
        setErr(`الصنف أُنشئ، لكن فشل رفع الصورة: ${upErr.message}`);
        return;
      }
      const { data: pub } = sb.storage.from("menu-images").getPublicUrl(path);
      await sb.from("menu_items").update({ image_url: pub.publicUrl }).eq("id", it.id);
    }

    setBusy(false);
    onCreated("أضيف الصنف ✓");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">إضافة صنف</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl">×</button>
        </div>

        {err && <p className="rounded-md bg-red-50 text-red-700 text-sm p-3">{err}</p>}

        <Field label="الفئة">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary"
          >
            {categories.length === 0 && <option value="">— لا توجد فئات —</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name_ar}</option>
            ))}
          </select>
        </Field>

        <Field label="الاسم بالعربية">
          <input
            type="text"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder="مثال: برجر دجاج"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary"
            autoFocus
          />
        </Field>

        <Field label="السعر (ر.س)">
          <input
            type="number"
            step="0.5"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="25"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary text-left"
            dir="ltr"
          />
        </Field>

        <Field label="صورة الصنف">
          <div className="flex items-center gap-3">
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="" className="w-16 h-16 rounded-lg object-cover border border-neutral-200" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-neutral-50 border border-dashed border-neutral-300 flex items-center justify-center text-2xl text-neutral-300">
                📷
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={optimizing}
                  className="rounded-md bg-neutral-100 hover:bg-neutral-200 text-xs px-2.5 py-1.5"
                >
                  📁 من الجهاز
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnsplash(true)}
                  disabled={optimizing}
                  className="rounded-md bg-blue-50 hover:bg-blue-100 text-xs px-2.5 py-1.5 text-blue-700"
                >
                  🔍 بحث صور
                </button>
              </div>
              {imageFile && (
                <button
                  type="button"
                  onClick={() => pickImage(null)}
                  className="text-[11px] text-red-600 hover:underline self-start"
                >
                  إزالة
                </button>
              )}
            </div>
          </div>
          {optimizing && <p className="text-[11px] text-blue-600 mt-1 font-bold">جاري تحسين الصورة...</p>}
          <p className="text-[11px] text-neutral-500 mt-1">يتم ضغط وتحسين الصور تلقائياً</p>
        </Field>

        {showUnsplash && (
          <UnsplashPicker
            onPick={pickFromUnsplash}
            onClose={() => setShowUnsplash(false)}
          />
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-brand-primary hover:underline"
        >
          {showAdvanced ? "إخفاء الحقول المتقدمة −" : "إظهار الحقول المتقدمة +"}
        </button>

        {showAdvanced && (
          <div className="space-y-3 border-t border-neutral-100 pt-3">
            <Field label="الاسم بالإنجليزية (اختياري)">
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g., Chicken Burger"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary text-left"
                dir="ltr"
              />
            </Field>
            <Field label="الوصف (اختياري)">
              <textarea
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                rows={2}
                placeholder="مثال: قطعة دجاج مقلية مع خس وطماطم وصوص خاص"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary"
              />
            </Field>
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
            disabled={busy || categories.length === 0}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-brand-primary text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "جاري الإضافة..." : "إضافة الصنف"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
