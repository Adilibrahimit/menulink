"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase-browser";

const ZoneMap = dynamic(() => import("./zone-map"), { ssr: false });

type BranchOption = {
  id: string;
  name_ar: string;
  is_default: boolean;
  is_active: boolean;
  lat: number | null;
  lng: number | null;
};

type ZoneRow = {
  id: string;
  branch_id: string;
  area_type: "radius" | "polygon";
  radius_km: number | null;
  polygon_geojson: unknown | null;
  delivery_fee: number;
  min_order: number;
  estimated_minutes: number | null;
  is_active: boolean;
  created_at: string;
  restaurant_branches: { name_ar: string; restaurant_id: string };
};

type Props = {
  branches: BranchOption[];
  initialZones: ZoneRow[];
};

const EMPTY_FORM = {
  branch_id: "",
  area_type: "radius" as "radius" | "polygon",
  radius_km: "5",
  delivery_fee: "0",
  min_order: "0",
  estimated_minutes: "30",
  polygon_geojson: null as unknown,
  branch_lat: null as number | null,
  branch_lng: null as number | null,
};

type FormState = typeof EMPTY_FORM;

export default function ZonesEditor({ branches, initialZones }: Props) {
  const [zones, setZones] = useState<ZoneRow[]>(initialZones);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    const b = branches.find((b) => b.is_default) ?? branches[0];
    setForm({
      ...EMPTY_FORM,
      branch_id: b?.id ?? "",
      branch_lat: b?.lat ?? null,
      branch_lng: b?.lng ?? null,
    });
    setError(null);
    setShowForm(true);
  }

  function openEdit(z: ZoneRow) {
    setEditingId(z.id);
    const b = branches.find((b) => b.id === z.branch_id);
    setForm({
      branch_id: z.branch_id,
      area_type: z.area_type,
      radius_km: String(z.radius_km ?? "5"),
      delivery_fee: String(z.delivery_fee),
      min_order: String(z.min_order),
      estimated_minutes: String(z.estimated_minutes ?? ""),
      polygon_geojson: z.polygon_geojson,
      branch_lat: b?.lat ?? null,
      branch_lng: b?.lng ?? null,
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

  function branchName(id: string) {
    return branches.find((b) => b.id === id)?.name_ar ?? "—";
  }

  async function save() {
    if (!form.branch_id) {
      setError("اختر الفرع");
      return;
    }
    if (form.area_type === "radius") {
      const radiusKm = parseFloat(form.radius_km);
      if (isNaN(radiusKm) || radiusKm <= 0) {
        setError("النطاق يجب أن يكون رقم أكبر من صفر");
        return;
      }
    }
    if (form.area_type === "polygon" && !form.polygon_geojson) {
      setError("ارسم حدود منطقة التوصيل على الخريطة");
      return;
    }
    setSaving(true);
    setError(null);
    const sb = createClient();

    if (form.branch_lat && form.branch_lng) {
      await sb
        .from("restaurant_branches")
        .update({ lat: form.branch_lat, lng: form.branch_lng })
        .eq("id", form.branch_id);
    }

    const payload = {
      branch_id: form.branch_id,
      area_type: form.area_type,
      radius_km: form.area_type === "radius" ? parseFloat(form.radius_km) : null,
      polygon_geojson: form.area_type === "polygon" ? form.polygon_geojson : null,
      delivery_fee: parseFloat(form.delivery_fee) || 0,
      min_order: parseFloat(form.min_order) || 0,
      estimated_minutes: form.estimated_minutes ? parseInt(form.estimated_minutes) : null,
    };

    if (editingId) {
      const { error: err } = await sb
        .from("branch_service_areas")
        .update(payload)
        .eq("id", editingId);
      if (err) { setError(err.message); setSaving(false); return; }
      setZones((arr) =>
        arr.map((z) =>
          z.id === editingId
            ? { ...z, ...payload, restaurant_branches: { ...z.restaurant_branches, name_ar: branchName(form.branch_id) } }
            : z
        )
      );
    } else {
      const { data, error: err } = await sb
        .from("branch_service_areas")
        .insert(payload)
        .select("*, restaurant_branches!inner(name_ar, restaurant_id)")
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setZones((arr) => [...arr, data as ZoneRow]);
    }
    setSaving(false);
    closeForm();
  }

  async function toggleActive(z: ZoneRow) {
    const sb = createClient();
    const { error: err } = await sb
      .from("branch_service_areas")
      .update({ is_active: !z.is_active })
      .eq("id", z.id);
    if (err) return;
    setZones((arr) => arr.map((x) => (x.id === z.id ? { ...x, is_active: !x.is_active } : x)));
  }

  async function deleteZone(z: ZoneRow) {
    if (!confirm("حذف نطاق التوصيل هذا؟")) return;
    const sb = createClient();
    const { error: err } = await sb.from("branch_service_areas").delete().eq("id", z.id);
    if (err) { alert(err.message); return; }
    setZones((arr) => arr.filter((x) => x.id !== z.id));
  }

  return (
    <div className="space-y-4">
      <button
        onClick={openAdd}
        className="h-11 px-5 rounded-xl bg-brand-primary text-white font-extrabold hover:opacity-90 active:translate-y-px"
      >
        + إضافة نطاق توصيل
      </button>

      {/* Zones per branch */}
      {zones.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">📍</div>
          <p className="text-sm text-neutral-600">لم تحدد أي نطاق توصيل بعد.</p>
          <p className="text-xs text-neutral-400 mt-1">
            أضف نطاق لكل فرع لتفعيل التوصيل حسب الموقع.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {zones.map((z) => (
            <li
              key={z.id}
              className={
                "bg-white border rounded-xl p-4 space-y-3 " +
                (z.is_active ? "border-neutral-200" : "border-neutral-200 opacity-60")
              }
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold">
                      {z.restaurant_branches?.name_ar ?? "—"}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5">
                      {z.area_type === "polygon" ? "🗺️ مضلع" : "⭕ نطاق دائري"}
                    </span>
                    {!z.is_active && (
                      <span className="text-[10px] bg-neutral-100 text-neutral-500 border border-neutral-200 rounded-full px-2 py-0.5">
                        معطّل
                      </span>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="flex gap-4 mt-3 flex-wrap">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
                      <div className="text-xl font-bold text-blue-700">{z.radius_km}</div>
                      <div className="text-[10px] text-blue-500 font-semibold">كم نطاق</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
                      <div className="text-xl font-bold text-green-700">
                        {z.delivery_fee > 0 ? `${z.delivery_fee} ر.س` : "مجاني"}
                      </div>
                      <div className="text-[10px] text-green-500 font-semibold">رسوم التوصيل</div>
                    </div>
                    {z.min_order > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
                        <div className="text-xl font-bold text-amber-700">{z.min_order} ر.س</div>
                        <div className="text-[10px] text-amber-500 font-semibold">حد أدنى</div>
                      </div>
                    )}
                    {z.estimated_minutes && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
                        <div className="text-xl font-bold text-purple-700">{z.estimated_minutes}</div>
                        <div className="text-[10px] text-purple-500 font-semibold">دقيقة</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(z)}
                    className="h-9 px-3 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-semibold hover:bg-neutral-200"
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => toggleActive(z)}
                    className={
                      "h-9 px-3 rounded-lg text-xs font-semibold " +
                      (z.is_active
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "bg-green-50 text-green-700 hover:bg-green-100")
                    }
                  >
                    {z.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                  <button
                    onClick={() => deleteZone(z)}
                    className="h-9 w-9 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                    title="حذف"
                  >
                    ✕
                  </button>
                </div>
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
                {editingId ? "تعديل نطاق التوصيل" : "إضافة نطاق توصيل"}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Branch */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الفرع *</label>
                <select
                  value={form.branch_id}
                  onChange={(e) => {
                    const b = branches.find((x) => x.id === e.target.value);
                    updateField("branch_id", e.target.value);
                    setForm((f) => ({ ...f, branch_id: e.target.value, branch_lat: b?.lat ?? null, branch_lng: b?.lng ?? null }));
                  }}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name_ar}{b.is_default ? " (افتراضي)" : ""}</option>
                  ))}
                </select>
              </div>

              {/* Area type toggle */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">نوع النطاق</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, area_type: "radius" }))}
                    className={"flex-1 h-10 rounded-xl text-xs font-bold border transition-colors " +
                      (form.area_type === "radius" ? "bg-brand-primary text-white border-brand-primary" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300")}
                  >
                    ⭕ نطاق دائري (كم)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, area_type: "polygon" }))}
                    className={"flex-1 h-10 rounded-xl text-xs font-bold border transition-colors " +
                      (form.area_type === "polygon" ? "bg-brand-primary text-white border-brand-primary" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300")}
                  >
                    🗺️ رسم حدود يدوي
                  </button>
                </div>
              </div>

              {/* Map */}
              <ZoneMap
                branchLat={form.branch_lat}
                branchLng={form.branch_lng}
                areaType={form.area_type}
                radiusKm={parseFloat(form.radius_km) || 5}
                polygonGeoJson={form.polygon_geojson}
                onBranchLocationChange={(lat, lng) => setForm((f) => ({ ...f, branch_lat: lat, branch_lng: lng }))}
                onPolygonChange={(gj) => setForm((f) => ({ ...f, polygon_geojson: gj }))}
              />

              {/* Radius (only for radius type) */}
              {form.area_type === "radius" && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">نطاق التوصيل (كم) *</label>
                  <input
                    type="number" step="0.5" min="0.5"
                    value={form.radius_km}
                    onChange={(e) => updateField("radius_km", e.target.value)}
                    className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                    dir="ltr"
                  />
                </div>
              )}

              {/* Delivery fee + Min order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">رسوم التوصيل (ر.س)</label>
                  <input
                    type="number" step="1" min="0"
                    value={form.delivery_fee}
                    onChange={(e) => updateField("delivery_fee", e.target.value)}
                    className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">حد أدنى للطلب (ر.س)</label>
                  <input
                    type="number" step="1" min="0"
                    value={form.min_order}
                    onChange={(e) => updateField("min_order", e.target.value)}
                    className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Estimated minutes */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الوقت المتوقع (دقيقة)</label>
                <input
                  type="number" step="5" min="5" placeholder="30"
                  value={form.estimated_minutes}
                  onChange={(e) => updateField("estimated_minutes", e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                  dir="ltr"
                />
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
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة النطاق"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
