"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type BranchRow = {
  id: string;
  restaurant_id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
  whatsapp: string | null;
  phone: string | null;
  address_ar: string | null;
  address_en: string | null;
  lat: number | null;
  lng: number | null;
  supports_delivery: boolean;
  supports_pickup: boolean;
  supports_dine_in: boolean;
  supports_car: boolean;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

type Props = {
  restaurantId: string;
  initialBranches: BranchRow[];
};

const EMPTY_FORM = {
  name_ar: "",
  name_en: "",
  slug: "",
  whatsapp: "",
  phone: "",
  address_ar: "",
  address_en: "",
  supports_delivery: true,
  supports_pickup: true,
  supports_dine_in: false,
  supports_car: false,
};

type FormState = typeof EMPTY_FORM;

export default function BranchesEditor({ restaurantId, initialBranches }: Props) {
  const [branches, setBranches] = useState<BranchRow[]>(initialBranches);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(b: BranchRow) {
    setEditingId(b.id);
    setForm({
      name_ar: b.name_ar,
      name_en: b.name_en ?? "",
      slug: b.slug,
      whatsapp: b.whatsapp ?? "",
      phone: b.phone ?? "",
      address_ar: b.address_ar ?? "",
      address_en: b.address_en ?? "",
      supports_delivery: b.supports_delivery,
      supports_pickup: b.supports_pickup,
      supports_dine_in: b.supports_dine_in,
      supports_car: b.supports_car,
    });
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/g, "-")
      .replace(/^-+|-+$/g, "")
      || "branch";
  }

  async function save() {
    if (!form.name_ar.trim()) {
      setError("اسم الفرع بالعربي مطلوب");
      return;
    }
    const slug = form.slug.trim() || autoSlug(form.name_ar);
    setSaving(true);
    setError(null);
    const sb = createClient();

    const payload = {
      restaurant_id: restaurantId,
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim() || null,
      slug,
      whatsapp: form.whatsapp.trim() || null,
      phone: form.phone.trim() || null,
      address_ar: form.address_ar.trim() || null,
      address_en: form.address_en.trim() || null,
      supports_delivery: form.supports_delivery,
      supports_pickup: form.supports_pickup,
      supports_dine_in: form.supports_dine_in,
      supports_car: form.supports_car,
    };

    if (editingId) {
      const { error: err } = await sb
        .from("restaurant_branches")
        .update(payload)
        .eq("id", editingId);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      setBranches((arr) =>
        arr.map((b) => (b.id === editingId ? { ...b, ...payload } : b))
      );
    } else {
      const nextSort = (branches[branches.length - 1]?.sort_order ?? 0) + 10;
      const { data, error: err } = await sb
        .from("restaurant_branches")
        .insert({ ...payload, sort_order: nextSort })
        .select("*")
        .single();
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      setBranches((arr) => [...arr, data as BranchRow]);
    }
    setSaving(false);
    closeForm();
  }

  async function toggleActive(b: BranchRow) {
    if (b.is_default && b.is_active) return;
    const sb = createClient();
    const { error: err } = await sb
      .from("restaurant_branches")
      .update({ is_active: !b.is_active })
      .eq("id", b.id);
    if (err) return;
    setBranches((arr) =>
      arr.map((x) => (x.id === b.id ? { ...x, is_active: !x.is_active } : x))
    );
  }

  async function setDefault(b: BranchRow) {
    if (b.is_default) return;
    const sb = createClient();
    // Remove default from current default
    await sb
      .from("restaurant_branches")
      .update({ is_default: false })
      .eq("restaurant_id", restaurantId)
      .eq("is_default", true);
    // Set new default
    const { error: err } = await sb
      .from("restaurant_branches")
      .update({ is_default: true, is_active: true })
      .eq("id", b.id);
    if (err) return;
    setBranches((arr) =>
      arr.map((x) => ({
        ...x,
        is_default: x.id === b.id,
        is_active: x.id === b.id ? true : x.is_active,
      }))
    );
  }

  async function deleteBranch(b: BranchRow) {
    if (b.is_default) return;
    if (!confirm(`حذف فرع "${b.name_ar}"؟ لا يمكن التراجع.`)) return;
    const sb = createClient();
    const { error: err } = await sb
      .from("restaurant_branches")
      .delete()
      .eq("id", b.id);
    if (err) {
      alert(err.message);
      return;
    }
    setBranches((arr) => arr.filter((x) => x.id !== b.id));
  }

  const serviceFlags: { key: keyof FormState; label: string; icon: string }[] = [
    { key: "supports_pickup", label: "استلام", icon: "🏪" },
    { key: "supports_delivery", label: "توصيل", icon: "🛵" },
    { key: "supports_dine_in", label: "جلوس", icon: "🪑" },
    { key: "supports_car", label: "سيارة", icon: "🚗" },
  ];

  return (
    <div className="space-y-4">
      <button
        onClick={openAdd}
        className="h-11 px-5 rounded-xl bg-brand-primary text-white font-extrabold hover:opacity-90 active:translate-y-px"
      >
        + إضافة فرع
      </button>

      {/* Branch list */}
      {branches.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">🏢</div>
          <p className="text-sm text-neutral-600">لم تضف أي فرع بعد.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {branches.map((b) => (
            <li
              key={b.id}
              className={
                "bg-white border rounded-xl p-4 space-y-3 " +
                (b.is_active
                  ? "border-neutral-200"
                  : "border-neutral-200 opacity-60")
              }
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold">{b.name_ar}</span>
                    {b.name_en && (
                      <span className="text-sm text-neutral-400" dir="ltr">
                        {b.name_en}
                      </span>
                    )}
                    {b.is_default && (
                      <span className="text-[10px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-full px-2 py-0.5 font-bold">
                        افتراضي
                      </span>
                    )}
                    {!b.is_active && (
                      <span className="text-[10px] bg-neutral-100 text-neutral-500 border border-neutral-200 rounded-full px-2 py-0.5">
                        معطّل
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1 space-y-0.5">
                    {b.whatsapp && (
                      <div dir="ltr" className="inline-block ml-3">
                        📱 {b.whatsapp}
                      </div>
                    )}
                    {b.address_ar && <div>📍 {b.address_ar}</div>}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {b.supports_pickup && (
                      <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                        🏪 استلام
                      </span>
                    )}
                    {b.supports_delivery && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                        🛵 توصيل
                      </span>
                    )}
                    {b.supports_dine_in && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                        🪑 جلوس
                      </span>
                    )}
                    {b.supports_car && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                        🚗 سيارة
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(b)}
                    className="h-9 px-3 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-semibold hover:bg-neutral-200"
                  >
                    ✏️ تعديل
                  </button>
                  {!b.is_default && (
                    <button
                      onClick={() => setDefault(b)}
                      className="h-9 px-3 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-semibold hover:bg-brand-primary/20"
                      title="تعيين كافتراضي"
                    >
                      ⭐
                    </button>
                  )}
                  <button
                    onClick={() => toggleActive(b)}
                    disabled={b.is_default && b.is_active}
                    className={
                      "h-9 px-3 rounded-lg text-xs font-semibold " +
                      (b.is_active
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "bg-green-50 text-green-700 hover:bg-green-100")
                    }
                    title={b.is_active ? "تعطيل" : "تفعيل"}
                  >
                    {b.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                  {!b.is_default && (
                    <button
                      onClick={() => deleteBranch(b)}
                      className="h-9 w-9 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                      title="حذف"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-bold">
                {editingId ? "تعديل الفرع" : "إضافة فرع جديد"}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Name AR */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  اسم الفرع (عربي) *
                </label>
                <input
                  type="text"
                  value={form.name_ar}
                  onChange={(e) => {
                    updateField("name_ar", e.target.value);
                    if (!editingId && !form.slug) {
                      updateField("slug", autoSlug(e.target.value));
                    }
                  }}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                  placeholder="مثال: فرع العزيزية"
                />
              </div>

              {/* Name EN */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  اسم الفرع (إنجليزي)
                </label>
                <input
                  type="text"
                  value={form.name_en}
                  onChange={(e) => updateField("name_en", e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                  dir="ltr"
                  placeholder="e.g. Aziziyah Branch"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  الرابط (slug)
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm font-mono"
                  dir="ltr"
                  placeholder="aziziyah"
                />
              </div>

              {/* WhatsApp + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    واتساب
                  </label>
                  <input
                    type="text"
                    value={form.whatsapp}
                    onChange={(e) => updateField("whatsapp", e.target.value)}
                    className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm font-mono"
                    dir="ltr"
                    placeholder="966500000000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    هاتف
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm font-mono"
                    dir="ltr"
                    placeholder="0114000000"
                  />
                </div>
              </div>

              {/* Address AR */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  العنوان (عربي)
                </label>
                <input
                  type="text"
                  value={form.address_ar}
                  onChange={(e) => updateField("address_ar", e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                  placeholder="حي العزيزية، شارع الأمير فيصل"
                />
              </div>

              {/* Address EN */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  العنوان (إنجليزي)
                </label>
                <input
                  type="text"
                  value={form.address_en}
                  onChange={(e) => updateField("address_en", e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                  dir="ltr"
                  placeholder="Al Aziziyah, Prince Faisal St."
                />
              </div>

              {/* Service types */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-2">
                  أنواع الخدمة
                </label>
                <div className="flex gap-3 flex-wrap">
                  {serviceFlags.map((s) => (
                    <label
                      key={s.key}
                      className={
                        "flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors " +
                        (form[s.key]
                          ? "border-brand-primary bg-brand-primary/5"
                          : "border-neutral-200 hover:border-neutral-300")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={form[s.key] as boolean}
                        onChange={(e) =>
                          updateField(s.key, e.target.checked as never)
                        }
                        className="accent-brand-primary"
                      />
                      <span className="text-sm">
                        {s.icon} {s.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="p-4 border-t border-neutral-100 flex gap-2">
              <button
                onClick={closeForm}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold hover:bg-neutral-50"
              >
                إلغاء
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {saving
                  ? "جاري الحفظ..."
                  : editingId
                    ? "حفظ التعديلات"
                    : "إضافة الفرع"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
