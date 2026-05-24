"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { ALLERGENS } from "@/lib/allergens";
import type { CategoryWithItems } from "./page";
import AddItemModal from "./add-item-modal";
import AddCategoryModal from "./add-category-modal";
import ModifiersPanel from "./modifiers-panel";

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
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [addItemFor, setAddItemFor] = useState<string | null>(null);
  const [nutritionOpen, setNutritionOpen] = useState<string | null>(null);
  const [modifiersOpen, setModifiersOpen] = useState<string | null>(null);

  function notify(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  // ---- Category mutations -------------------------------------------------
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

  async function reorderCategories(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const ids = initial.map((c) => c.id);
    const [moved] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, moved);
    const updates = ids.map((id, i) =>
      sb.from("menu_categories").update({ sort: i + 1 }).eq("id", id)
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    if (err?.error) notify("err", err.error.message);
    refresh();
  }

  async function reorderItems(catItems: typeof initial[0]["items"], fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const ids = catItems.map((it) => it.id);
    const [moved] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, moved);
    const updates = ids.map((id, i) =>
      sb.from("menu_items").update({ sort: i + 1 }).eq("id", id)
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    if (err?.error) notify("err", err.error.message);
    refresh();
  }

  // ---- Item mutations -----------------------------------------------------
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

  // ---- Image upload (Supabase Storage menu-images bucket) ---------------
  async function uploadImage(itemId: string, file: File) {
    if (file.size > 5 * 1024 * 1024) {
      notify("err", "حجم الصورة أكبر من 5 ميغا");
      return;
    }
    if (!file.type.startsWith("image/")) {
      notify("err", "الملف يجب أن يكون صورة");
      return;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    // Path: <restaurant_id>/<item_id>-<random>.<ext>  — random keeps caches
    // honest when the owner replaces an image with the same filename.
    const path = `${restaurantId}/${itemId}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await sb.storage
      .from("menu-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      notify("err", upErr.message);
      return;
    }
    const { data } = sb.storage.from("menu-images").getPublicUrl(path);
    const { error: updateErr } = await sb
      .from("menu_items")
      .update({ image_url: data.publicUrl })
      .eq("id", itemId);
    if (updateErr) {
      notify("err", updateErr.message);
      return;
    }
    notify("ok", "صورة محدّثة");
    refresh();
  }

  async function removeImage(itemId: string) {
    if (!window.confirm("حذف الصورة من هذا الصنف؟")) return;
    const { error } = await sb
      .from("menu_items")
      .update({ image_url: null })
      .eq("id", itemId);
    if (error) notify("err", error.message);
    else {
      notify("ok", "حُذفت");
      refresh();
    }
  }

  // ---- Nutrition fields ---------------------------------------------------
  async function updateNutrition(itemId: string, field: string, value: unknown) {
    const { error } = await sb.from("menu_items").update({ [field]: value }).eq("id", itemId);
    if (error) notify("err", error.message);
    else notify("ok", "محدّث");
  }

  async function toggleAllergen(itemId: string, current: string[] | null, key: string) {
    const arr = current ?? [];
    const next = arr.includes(key) ? arr.filter((a) => a !== key) : [...arr, key];
    await updateNutrition(itemId, "allergens_json", next.length > 0 ? next : null);
    refresh();
  }

  // ---- Variant mutations --------------------------------------------------
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

  async function renameVariant(variantId: string, current: string) {
    const label = window.prompt("الاسم الجديد:", current);
    if (!label || label === current) return;
    const { error } = await sb.from("menu_item_variants").update({ variant_label_ar: label }).eq("id", variantId);
    if (error) notify("err", error.message);
    else { notify("ok", "تم"); refresh(); }
  }

  async function deleteVariant(variantId: string, label: string) {
    if (!window.confirm(`حذف "${label}"؟`)) return;
    const { error } = await sb.from("menu_item_variants").delete().eq("id", variantId);
    if (error) notify("err", error.message);
    else { notify("ok", "حُذف"); refresh(); }
  }

  async function addVariant(itemId: string, existingCount: number) {
    const label = window.prompt("اسم الحجم/النوع (مثل: وسط، كبير، علبة):");
    if (!label) return;
    const priceStr = window.prompt("السعر بالريال:");
    if (!priceStr) return;
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0) {
      notify("err", "سعر غير صحيح");
      return;
    }
    const key = label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_؀-ۿ]/g, "") || `v_${Date.now()}`;
    const { error } = await sb.from("menu_item_variants").insert({
      menu_item_id: itemId,
      variant_key: key,
      variant_label_ar: label.trim(),
      price,
      sort: existingCount + 1,
    });
    if (error) notify("err", error.message);
    else { notify("ok", "أُضيف"); refresh(); }
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

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowAddCategory(true)}
          className="rounded-md bg-brand-primary text-white px-3 py-2 text-sm font-semibold hover:opacity-90"
        >
          + إضافة فئة
        </button>
        {initial.length > 0 && (
          <button
            onClick={() => setAddItemFor("*")}
            className="rounded-md bg-neutral-900 text-white px-3 py-2 text-sm font-semibold hover:opacity-90"
          >
            + إضافة صنف
          </button>
        )}
      </div>

      {initial.length === 0 && (
        <p className="text-neutral-500 text-sm">لا توجد فئات بعد. اضغط "إضافة فئة" للبدء.</p>
      )}

      {initial.map((c, ci) => (
        <section
          key={c.id}
          className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3"
        >
          <header className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => reorderCategories(ci, ci - 1)}
                  disabled={ci === 0}
                  className="w-6 h-6 flex items-center justify-center rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-600 disabled:opacity-30 disabled:hover:bg-neutral-100"
                  title="رفع"
                >▲</button>
                <button
                  onClick={() => reorderCategories(ci, ci + 1)}
                  disabled={ci === initial.length - 1}
                  className="w-6 h-6 flex items-center justify-center rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-600 disabled:opacity-30 disabled:hover:bg-neutral-100"
                  title="خفض"
                >▼</button>
              </div>
              <span className="text-xl">{c.emoji || "🍽️"}</span>
              <h2 className={`font-semibold ${c.is_active ? "" : "text-neutral-400 line-through"}`}>
                {c.name_ar}
              </h2>
              {!c.is_active && <span className="text-xs text-neutral-400">(مخفي)</span>}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => setAddItemFor(c.id)} className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200">
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
            {c.items.map((it, ii) => (
              <li key={it.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                {/* Sort arrows */}
                <div className="flex flex-col gap-0.5 justify-center shrink-0">
                  <button
                    onClick={() => reorderItems(c.items, ii, ii - 1)}
                    disabled={ii === 0}
                    className="w-5 h-5 flex items-center justify-center rounded bg-neutral-100 hover:bg-neutral-200 text-[10px] text-neutral-600 disabled:opacity-30 disabled:hover:bg-neutral-100"
                    title="رفع"
                  >▲</button>
                  <button
                    onClick={() => reorderItems(c.items, ii, ii + 1)}
                    disabled={ii === c.items.length - 1}
                    className="w-5 h-5 flex items-center justify-center rounded bg-neutral-100 hover:bg-neutral-200 text-[10px] text-neutral-600 disabled:opacity-30 disabled:hover:bg-neutral-100"
                    title="خفض"
                  >▼</button>
                </div>
                {/* Image thumbnail / upload */}
                <label className="shrink-0 cursor-pointer group relative w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 hover:border-brand-primary">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(it.id, f);
                      e.target.value = "";
                    }}
                  />
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.image_url}
                      alt={it.name_ar}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xl text-neutral-400">
                      📷
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[10px] opacity-0 group-hover:opacity-100">
                    تغيير
                  </span>
                </label>

                <div className="flex-1 min-w-[160px]">
                  <div className={`font-medium ${it.is_active ? "" : "text-neutral-400 line-through"}`}>
                    {it.name_ar}
                  </div>
                  {it.description_ar && (
                    <div className="text-xs text-neutral-500">{it.description_ar}</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {it.variants.map((v) => (
                      <div key={v.id} className="flex items-center gap-1 text-xs bg-neutral-50 rounded px-2 py-1 border border-neutral-200">
                        <button
                          onClick={() => renameVariant(v.id, v.variant_label_ar || v.variant_key)}
                          className="text-neutral-600 hover:text-brand-primary cursor-pointer font-medium"
                          title="تعديل الاسم"
                        >
                          {v.variant_label_ar || v.variant_key}
                        </button>
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          defaultValue={Number(v.price)}
                          onBlur={(e) => updatePrice(v.id, e.target.value)}
                          className="w-16 px-1 py-0.5 rounded border border-neutral-300 outline-none focus:border-brand-primary text-left"
                        />
                        <span className="text-neutral-400">ر.س</span>
                        <button
                          onClick={() => deleteVariant(v.id, v.variant_label_ar || v.variant_key)}
                          className="text-red-400 hover:text-red-600 mr-0.5"
                          title="حذف"
                        >✕</button>
                      </div>
                    ))}
                    <button
                      onClick={() => addVariant(it.id, it.variants.length)}
                      className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-1 hover:bg-green-100"
                    >
                      + حجم/نوع
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <button onClick={() => renameItem(it.id, it.name_ar)} className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200">
                    اسم
                  </button>
                  {it.image_url && (
                    <button onClick={() => removeImage(it.id)} className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200" title="إزالة الصورة">
                      صورة ✕
                    </button>
                  )}
                  <button
                    onClick={() => setModifiersOpen(modifiersOpen === it.id ? null : it.id)}
                    className={
                      "px-2 py-1 rounded " +
                      (modifiersOpen === it.id
                        ? "bg-indigo-100 text-indigo-800"
                        : it.modifiers_json
                          ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          : "bg-neutral-100 hover:bg-neutral-200")
                    }
                  >
                    🧩 إضافات
                  </button>
                  <button
                    onClick={() => setNutritionOpen(nutritionOpen === it.id ? null : it.id)}
                    className={
                      "px-2 py-1 rounded " +
                      (nutritionOpen === it.id
                        ? "bg-amber-100 text-amber-800"
                        : "bg-neutral-100 hover:bg-neutral-200")
                    }
                  >
                    🔥 سعرات
                  </button>
                  <button onClick={() => toggleItemActive(it.id, it.is_active)} className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200">
                    {it.is_active ? "إخفاء" : "إظهار"}
                  </button>
                  <button onClick={() => deleteItem(it.id, it.name_ar)} className="px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">
                    حذف
                  </button>
                </div>

                {/* Modifiers panel (expanded) */}
                {modifiersOpen === it.id && (
                  <ModifiersPanel
                    itemId={it.id}
                    initial={it.modifiers_json}
                    onSaved={() => { notify("ok", "إضافات محدّثة"); refresh(); }}
                    onError={(msg) => notify("err", msg)}
                  />
                )}

                {/* Nutrition panel (expanded) */}
                {nutritionOpen === it.id && (
                  <div className="w-full mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-amber-800 mb-0.5">سعرات (kcal)</label>
                        <input
                          type="number" min="0"
                          defaultValue={it.calories_kcal ?? ""}
                          onBlur={(e) => updateNutrition(it.id, "calories_kcal", e.target.value ? Number(e.target.value) : null)}
                          className="w-full h-8 rounded-lg border border-amber-300 bg-white px-2 text-sm outline-none focus:border-brand-primary"
                          placeholder="مثال: 350"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-amber-800 mb-0.5">صوديوم (ملجم)</label>
                        <input
                          type="number" min="0"
                          defaultValue={it.sodium_mg ?? ""}
                          onBlur={(e) => updateNutrition(it.id, "sodium_mg", e.target.value ? Number(e.target.value) : null)}
                          className="w-full h-8 rounded-lg border border-amber-300 bg-white px-2 text-sm outline-none focus:border-brand-primary"
                          placeholder="مثال: 1500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-amber-800 mb-0.5">كافيين (ملجم)</label>
                        <input
                          type="number" min="0"
                          defaultValue={it.caffeine_mg ?? ""}
                          onBlur={(e) => updateNutrition(it.id, "caffeine_mg", e.target.value ? Number(e.target.value) : null)}
                          className="w-full h-8 rounded-lg border border-amber-300 bg-white px-2 text-sm outline-none focus:border-brand-primary"
                          placeholder="للمشروبات"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-amber-800 mb-1.5">مسببات الحساسية (SFDA 14)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {ALLERGENS.map((a) => {
                          const active = (it.allergens_json ?? []).includes(a.key);
                          return (
                            <button
                              key={a.key}
                              type="button"
                              onClick={() => toggleAllergen(it.id, it.allergens_json, a.key)}
                              className={
                                "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition-colors " +
                                (active
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300")
                              }
                            >
                              <span>{a.icon}</span>
                              <span>{a.label_ar}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {pending && <p className="text-xs text-neutral-400">يحدّث…</p>}

      {showAddCategory && (
        <AddCategoryModal
          restaurantId={restaurantId}
          nextSort={initial.length + 1}
          onClose={() => setShowAddCategory(false)}
          onCreated={(msg) => {
            setShowAddCategory(false);
            notify("ok", msg);
            refresh();
          }}
        />
      )}

      {addItemFor && (
        <AddItemModal
          restaurantId={restaurantId}
          categories={initial.map((c) => ({ id: c.id, name_ar: c.name_ar }))}
          defaultCategoryId={addItemFor === "*" ? undefined : addItemFor}
          onClose={() => setAddItemFor(null)}
          onCreated={(msg) => {
            setAddItemFor(null);
            notify("ok", msg);
            refresh();
          }}
        />
      )}
    </div>
  );
}
