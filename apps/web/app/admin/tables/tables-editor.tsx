"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { generatePosterDataUrl, triggerDownload } from "@/lib/menu-qr-poster";

type TableRow = {
  id: string;
  label: string;
  sort_order: number;
  created_at: string;
};

type Props = {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  logoUrl: string | null;
  taglineAr: string | null;
  primaryColor: string;
  initialTables: TableRow[];
};

export default function TablesEditor({
  restaurantId,
  restaurantName,
  slug,
  logoUrl,
  taglineAr,
  primaryColor,
  initialTables,
}: Props) {
  const [tables, setTables] = useState<TableRow[]>(initialTables);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  async function addTable() {
    const label = newLabel.trim();
    if (!label) {
      setError("اكتب رقم أو اسم الطاولة.");
      return;
    }
    if (tables.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      setError("هذه الطاولة موجودة مسبقاً.");
      return;
    }
    setError(null);
    const sb = createClient();
    const nextSort = (tables[tables.length - 1]?.sort_order ?? 0) + 10;
    const { data, error: err } = await sb
      .from("restaurant_tables")
      .insert({ restaurant_id: restaurantId, label, sort_order: nextSort })
      .select("id, label, sort_order, created_at")
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    setTables((t) => [...t, data as TableRow]);
    setNewLabel("");
  }

  async function deleteTable(id: string) {
    if (!confirm("احذف هذه الطاولة؟ لن يعمل رمز QR الخاص بها بعد الحذف.")) return;
    const sb = createClient();
    const { error: err } = await sb.from("restaurant_tables").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    setTables((t) => t.filter((x) => x.id !== id));
  }

  async function swap(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= tables.length) return;
    const a = tables[index];
    const b = tables[j];
    // Optimistic UI swap
    const next = [...tables];
    next[index] = { ...b, sort_order: a.sort_order };
    next[j] = { ...a, sort_order: b.sort_order };
    setTables(next);
    // Persist
    const sb = createClient();
    await Promise.all([
      sb.from("restaurant_tables").update({ sort_order: b.sort_order }).eq("id", a.id),
      sb.from("restaurant_tables").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
  }

  function startEdit(t: TableRow) {
    setEditingId(t.id);
    setEditingValue(t.label);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingValue("");
    setEditError(null);
  }

  async function saveEdit(t: TableRow) {
    const label = editingValue.trim();
    if (!label) {
      setEditError("اكتب رقم أو اسم الطاولة.");
      return;
    }
    // No change → just close
    if (label === t.label) {
      cancelEdit();
      return;
    }
    // Unique among the OTHER rows (case-insensitive)
    if (tables.some((x) => x.id !== t.id && x.label.toLowerCase() === label.toLowerCase())) {
      setEditError("هذه الطاولة موجودة مسبقاً.");
      return;
    }
    setEditError(null);
    const sb = createClient();
    const { error: err } = await sb
      .from("restaurant_tables")
      .update({ label })
      .eq("id", t.id);
    if (err) {
      // Most common cause: unique-constraint race. Surface it inline.
      setEditError(err.message);
      return;
    }
    setTables((arr) => arr.map((x) => (x.id === t.id ? { ...x, label } : x)));
    cancelEdit();
  }

  async function downloadPoster(t: TableRow) {
    setBusyId(t.id);
    try {
      const { dataUrl } = await generatePosterDataUrl({
        slug,
        restaurantName,
        logoUrl,
        taglineAr,
        primaryColor,
        tableLabel: t.label,
      });
      triggerDownload(dataUrl, `${slug}-table-${slugifyLabel(t.label)}-poster.png`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-2">
        <label className="block text-xs font-semibold text-neutral-700">
          إضافة طاولة جديدة
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTable();
            }}
            placeholder='مثال: 1 · A1 · بجانب النافذة'
            className="flex-1 h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
          <button
            onClick={addTable}
            className="h-11 px-5 rounded-xl bg-brand-primary text-white font-extrabold hover:opacity-90 active:translate-y-px"
            style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
          >
            إضافة
          </button>
        </div>
        {error && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* List */}
      {tables.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">🪑</div>
          <p className="text-sm text-neutral-600">لم تضف أي طاولة بعد.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tables.map((t, i) => {
            const isEditing = editingId === t.id;
            return (
              <li
                key={t.id}
                className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-3 flex-wrap"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shrink-0">
                  🪑
                </div>
                <div className="flex-1 min-w-[160px]">
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-extrabold text-neutral-700 shrink-0"
                          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
                        >
                          طاولة
                        </span>
                        <input
                          type="text"
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(t);
                            else if (e.key === "Escape") cancelEdit();
                          }}
                          className="flex-1 min-w-0 h-9 rounded-lg border border-neutral-200 px-2 outline-none focus:border-brand-primary text-sm"
                        />
                        <button
                          onClick={() => saveEdit(t)}
                          className="w-9 h-9 rounded-lg bg-green-600 text-white font-bold hover:opacity-90"
                          aria-label="حفظ"
                          title="حفظ"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                          aria-label="إلغاء"
                          title="إلغاء"
                        >
                          ✕
                        </button>
                      </div>
                      {editError && (
                        <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                          {editError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(t)}
                        className="text-right font-extrabold text-neutral-900 hover:text-brand-primary transition-colors"
                        style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
                        title="اضغط للتعديل"
                      >
                        طاولة {t.label} <span className="text-neutral-300 text-sm">✏️</span>
                      </button>
                      <div className="text-[11px] text-neutral-500 font-mono break-all" dir="ltr">
                        /m/{slug}?table={encodeURIComponent(t.label)}
                      </div>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => swap(i, -1)}
                      disabled={i === 0}
                      className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
                      aria-label="رفع"
                      title="رفع"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => swap(i, 1)}
                      disabled={i === tables.length - 1}
                      className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
                      aria-label="إنزال"
                      title="إنزال"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => downloadPoster(t)}
                      disabled={busyId === t.id}
                      className="h-9 px-3 rounded-lg bg-brand-primary text-white text-xs font-extrabold hover:opacity-90 disabled:opacity-60"
                      style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
                    >
                      {busyId === t.id ? "..." : "⬇ بطاقة QR"}
                    </button>
                    <button
                      onClick={() => deleteTable(t.id)}
                      className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                      aria-label="حذف"
                      title="حذف"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function slugifyLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9؀-ۿ]+/g, "-").replace(/^-+|-+$/g, "") || "table";
}
