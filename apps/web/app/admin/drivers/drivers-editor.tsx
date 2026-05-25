"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type DriverRow = {
  id: string;
  restaurant_id: string;
  branch_id: string | null;
  name: string;
  phone: string | null;
  driver_type: "internal" | "external" | "aggregator";
  is_active: boolean;
  created_at: string;
};

type BranchOption = {
  id: string;
  name_ar: string;
  is_default: boolean;
  is_active: boolean;
};

type Props = {
  restaurantId: string;
  initialDrivers: DriverRow[];
  branches: BranchOption[];
};

const DRIVER_TYPE_LABEL: Record<string, string> = {
  internal: "داخلي",
  external: "خارجي",
  aggregator: "مجمّع",
};

const DRIVER_TYPE_ICON: Record<string, string> = {
  internal: "🛵",
  external: "🚗",
  aggregator: "📦",
};

const EMPTY_FORM = {
  name: "",
  phone: "",
  driver_type: "internal" as "internal" | "external" | "aggregator",
  branch_id: "" as string,
};

type FormState = typeof EMPTY_FORM;

export default function DriversEditor({ restaurantId, initialDrivers, branches }: Props) {
  const [drivers, setDrivers] = useState<DriverRow[]>(initialDrivers);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, branch_id: branches.find((b) => b.is_default)?.id ?? "" });
    setError(null);
    setShowForm(true);
  }

  function openEdit(d: DriverRow) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      phone: d.phone ?? "",
      driver_type: d.driver_type,
      branch_id: d.branch_id ?? "",
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

  async function save() {
    if (!form.name.trim()) {
      setError("اسم السائق مطلوب");
      return;
    }
    setSaving(true);
    setError(null);
    const sb = createClient();

    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      driver_type: form.driver_type,
      branch_id: form.branch_id || null,
    };

    if (editingId) {
      const { error: err } = await sb
        .from("drivers")
        .update(payload)
        .eq("id", editingId);
      if (err) { setError(err.message); setSaving(false); return; }
      setDrivers((arr) => arr.map((d) => (d.id === editingId ? { ...d, ...payload } : d)));
    } else {
      const { data, error: err } = await sb
        .from("drivers")
        .insert(payload)
        .select("*")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setDrivers((arr) => [...arr, data as DriverRow]);
    }
    setSaving(false);
    closeForm();
  }

  async function toggleActive(d: DriverRow) {
    const sb = createClient();
    const { error: err } = await sb
      .from("drivers")
      .update({ is_active: !d.is_active })
      .eq("id", d.id);
    if (err) return;
    setDrivers((arr) => arr.map((x) => (x.id === d.id ? { ...x, is_active: !x.is_active } : x)));
  }

  async function deleteDriver(d: DriverRow) {
    if (!confirm(`حذف السائق "${d.name}"؟`)) return;
    const sb = createClient();
    const { error: err } = await sb.from("drivers").delete().eq("id", d.id);
    if (err) { alert(err.message); return; }
    setDrivers((arr) => arr.filter((x) => x.id !== d.id));
  }

  function branchName(id: string | null) {
    if (!id) return "كل الفروع";
    return branches.find((b) => b.id === id)?.name_ar ?? "—";
  }

  const filtered = drivers.filter((d) => {
    if (filter === "active") return d.is_active;
    if (filter === "inactive") return !d.is_active;
    return true;
  });

  const activeCount = drivers.filter((d) => d.is_active).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={openAdd}
          className="h-11 px-5 rounded-xl bg-brand-primary text-white font-extrabold hover:opacity-90 active:translate-y-px"
        >
          + إضافة سائق
        </button>
        <div className="flex-1" />
        <span className="text-xs text-neutral-500">
          {activeCount} نشط · {drivers.length} إجمالي
        </span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="h-9 px-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-brand-primary"
        >
          <option value="all">الكل</option>
          <option value="active">نشط</option>
          <option value="inactive">معطّل</option>
        </select>
      </div>

      {/* Driver list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">🛵</div>
          <p className="text-sm text-neutral-600">
            {drivers.length === 0 ? "لم تضف أي سائق بعد." : "لا يوجد سائقين بهذا الفلتر."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => (
            <li
              key={d.id}
              className={
                "bg-white border rounded-xl p-4 flex items-center gap-4 flex-wrap " +
                (d.is_active ? "border-neutral-200" : "border-neutral-200 opacity-60")
              }
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xl shrink-0">
                {DRIVER_TYPE_ICON[d.driver_type] ?? "🛵"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-neutral-900">{d.name}</span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                    {DRIVER_TYPE_LABEL[d.driver_type]}
                  </span>
                  {!d.is_active && (
                    <span className="text-[10px] bg-neutral-100 text-neutral-500 border border-neutral-200 rounded-full px-2 py-0.5">
                      معطّل
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-3">
                  {d.phone && <span dir="ltr">📱 {d.phone}</span>}
                  <span>🏢 {branchName(d.branch_id)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openEdit(d)}
                  className="h-9 px-3 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-semibold hover:bg-neutral-200"
                >
                  ✏️ تعديل
                </button>
                <button
                  onClick={() => toggleActive(d)}
                  className={
                    "h-9 px-3 rounded-lg text-xs font-semibold " +
                    (d.is_active
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "bg-green-50 text-green-700 hover:bg-green-100")
                  }
                >
                  {d.is_active ? "تعطيل" : "تفعيل"}
                </button>
                <button
                  onClick={() => deleteDriver(d)}
                  className="h-9 w-9 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                  title="حذف"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" dir="rtl">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-bold">
                {editingId ? "تعديل سائق" : "إضافة سائق جديد"}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  اسم السائق *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                  placeholder="أحمد محمد"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  رقم الجوال
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm font-mono"
                  dir="ltr"
                  placeholder="0500000000"
                />
              </div>

              {/* Driver type */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-2">
                  نوع السائق
                </label>
                <div className="flex gap-2">
                  {(["internal", "external", "aggregator"] as const).map((t) => (
                    <label
                      key={t}
                      className={
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors text-sm " +
                        (form.driver_type === t
                          ? "border-brand-primary bg-brand-primary/5 font-semibold"
                          : "border-neutral-200 hover:border-neutral-300")
                      }
                    >
                      <input
                        type="radio"
                        name="driver_type"
                        value={t}
                        checked={form.driver_type === t}
                        onChange={() => updateField("driver_type", t)}
                        className="sr-only"
                      />
                      {DRIVER_TYPE_ICON[t]} {DRIVER_TYPE_LABEL[t]}
                    </label>
                  ))}
                </div>
              </div>

              {/* Branch */}
              {branches.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    الفرع
                  </label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => updateField("branch_id", e.target.value)}
                    className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                  >
                    <option value="">كل الفروع</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name_ar}
                        {b.is_default ? " (افتراضي)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة السائق"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
