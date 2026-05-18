"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { CategoryWithItems } from "./page";

type Toast = { kind: "ok" | "err"; text: string } | null;

export default function MenuEditor({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: CategoryWithItems[];
}) {
  const router = useRouter();
  const sb = createClient();
  const [toast, setToast] = useState<Toast>(null);
  const [pending, startTransition] = useTransition();

  function notify(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  // ---- Category mutations -------------------------------------------------
  async function addCategory() {
    const name = window.prompt("اسم الفئة الجديدة:");
    if (!name) return;
    const slug = window.prompt("معرّف الفئة (slug, إنجليزي):", `cat-${Date.now()}`);
    if (!slug) return;
    const sort = initial.length + 1;
    const { error } = await sb
      .from("menu_categories")
      .insert({ restaurant_id: restaurantId, slug, name_ar: name, sort });
    if (error) notify("err", error.message);
    else {
      notify("ok", "أضيفت الفئة");
      refresh();
    }
  }

  async function renameCategory(catId: string, current: string) {
    const name = window.prompt("الاسم الجديد:", current);
    if (!name || name === current) return;
    const { error } = await sb.from("menu_categories").update({ name_ar: name }).eq("id", catId);
    if (error) notify("err", error.message);
    else { notify("ok", "تم"); refresh(); }
  }

  async function toggleCategoryActive(catId: string, current: boolean) {
    const { error } = await sb.from("menu_categories").update({ is_active: !current }).eq("id", catId);
    if (error) notify("err", error.message);
    else refresh();
  }

  async function deleteCategory(catId: string, name: string) {
    if (!window.confirm(`حذف "${name}" مع كل أصنافها؟`)) return;
    const { error } = await sb.from("menu_categories").delete().eq("id", catId);
    if (error) notify("err", error.message);
    else { notify("ok", "حُذفت"); refresh(); }
  }

  // ---- Item mutations -----------------------------------------------------
  async function addItem(catId: string) {
    const name = window.prompt("اسم الصنف:");
    if (!name) return;
    const priceStr = window.prompt("السعر الواحد (ريال):", "10");
    if (!priceStr) return;
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0) {
      notify("err", "سعر غير صحيح");
      return;
    }
    const slug = `item-${Date.now()}`;
    const { data: it, error: e1 } = await sb
      .from("menu_items")
      .insert({ restaurant_id: restaurantId, category_id: catId, slug, name_ar: name, sort: 999 })
      .select("id")
      .single();
    if (e1 || !it) { notify("err", e1?.message ?? "تعذّر الإضافة"); return; }
    const { error: e2 } = await sb
      .from("menu_item_variants")
      .insert({ menu_item_id: it.id, variant_key: "single", variant_label_ar: "", price, sort: 1 });
    if (e2) notify("err", e2.message);
    else { notify("ok", "أضيف الصنف"); refresh(); }
  }

  async function renameItem(itemId: string, current: string) {
    const name = window.prompt("الاسم الجديد:", current);
    if (!name || name === current) return;
    const { error } = await sb.from("menu_items").update({ name_ar: name }).eq("id", itemId);
    if (error) notify("err", error.message);
    else { notify("ok", "تم"); refresh(); }
  }

  async function toggleItemActive(itemId: string, current: boolean) {
    const { error } = await sb.from("menu_items").update({ is_active: !current }).eq("id", itemId);
    if (error) notify("err", error.message);
    else refresh();
  }

  async function deleteItem(itemId: string, name: string) {
    if (!window.confirm(`حذف الصنف "${name}"؟`)) return;
    const { error } = await sb.from("menu_items").delete().eq("id", itemId);
    if (error) notify("err", error.message);
    else { notify("ok", "حُذف"); refresh(); }
  }

  // ---- Variant price update ----------------------------------------------
  async function updatePrice(variantId: string, priceStr: string) {
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0) {
      notify("err", "سعر غير صحيح");
      refresh();
      return;
    }
    const { error } = await sb.from("menu_item_variants").update({ price }).eq("id", variantId);
    if (error) notify("err", error.message);
    else notify("ok", "سعر محدّث");
  }

  return (
    <div className="space-y-4">
      {toast && (
        <p
          className={`rounded-md text-sm p-3 ${
            toast.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {toast.text}
        </p>
      )}

      <button
        onClick={addCategory}
        className="rounded-md bg-brand-primary text-white px-3 py-2 text-sm font-semibold hover:opacity-90"
      >
        + إضافة فئة
      </button>

      {initial.length === 0 && (
        <p className="text-neutral-500 text-sm">لا توجد فئات بعد. اضغط "إضافة فئة" للبدء.</p>
      )}

      {initial.map((c) => (
        <section
          key={c.id}
          className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3"
        >
          <header className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{c.emoji || "🍽️"}</span>
              <h2 className={`font-semibold ${c.is_active ? "" : "text-neutral-400 line-through"}`}>
                {c.name_ar}
              </h2>
              {!c.is_active && <span className="text-xs text-neutral-400">(مخفي)</span>}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => addItem(c.id)} className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200">
                + صنف
              </button>
              <button onClick={() => renameCategory(c.id, c.name_ar)} className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200">
                تعديل
              </button>
              <button onClick={() => toggleCategoryActive(c.id, c.is_active)} className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200">
                {c.is_active ? "إخفاء" : "إظهار"}
              </button>
              <button onClick={() => deleteCategory(c.id, c.name_ar)} className="px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">
                حذف
              </button>
            </div>
          </header>

          {c.items.length === 0 && (
            <p className="text-neutral-400 text-sm">لا توجد أصناف في هذه الفئة.</p>
          )}

          <ul className="divide-y divide-neutral-100">
            {c.items.map((it) => (
              <li key={it.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <div className={`font-medium ${it.is_active ? "" : "text-neutral-400 line-through"}`}>
                    {it.name_ar}
                  </div>
                  {it.description_ar && (
                    <div className="text-xs text-neutral-500">{it.description_ar}</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {it.variants.map((v) => (
                      <label key={v.id} className="flex items-center gap-1 text-xs bg-neutral-50 rounded px-2 py-1">
                        <span className="text-neutral-600">{v.variant_label_ar || v.variant_key}</span>
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          defaultValue={Number(v.price)}
                          onBlur={(e) => updatePrice(v.id, e.target.value)}
                          className="w-16 px-1 py-0.5 rounded border border-neutral-300 outline-none focus:border-brand-primary text-left"
                        />
                        <span className="text-neutral-400">ر.س</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <button onClick={() => renameItem(it.id, it.name_ar)} className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200">
                    اسم
                  </button>
                  <button onClick={() => toggleItemActive(it.id, it.is_active)} className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200">
                    {it.is_active ? "إخفاء" : "إظهار"}
                  </button>
                  <button onClick={() => deleteItem(it.id, it.name_ar)} className="px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {pending && <p className="text-xs text-neutral-400">يحدّث…</p>}
    </div>
  );
}
