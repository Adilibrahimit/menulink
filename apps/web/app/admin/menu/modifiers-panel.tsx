"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ModifierConfig, ModifierGroup, ModifierOption } from "@/lib/types";

type Props = {
  itemId: string;
  initial: ModifierConfig | null;
  onSaved: () => void;
  onError: (msg: string) => void;
};

const EMPTY_CONFIG: ModifierConfig = {
  groups: [],
  notesEnabled: true,
  notesMaxLength: 200,
  notesPlaceholder: "مثال: بدون بصل، حار قليلاً...",
};

function newGroup(): ModifierGroup {
  return {
    key: `g_${Date.now()}`,
    label: "",
    type: "multi",
    required: false,
    max: 99,
    options: [],
  };
}

function newOption(): ModifierOption {
  return { label: "", priceDelta: 0 };
}

export default function ModifiersPanel({ itemId, initial, onSaved, onError }: Props) {
  const sb = createClient();
  const [config, setConfig] = useState<ModifierConfig>(initial ?? EMPTY_CONFIG);
  const [saving, setSaving] = useState(false);

  function updateGroup(idx: number, patch: Partial<ModifierGroup>) {
    setConfig((c) => ({
      ...c,
      groups: c.groups.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    }));
  }

  function removeGroup(idx: number) {
    setConfig((c) => ({ ...c, groups: c.groups.filter((_, i) => i !== idx) }));
  }

  function addGroup() {
    setConfig((c) => ({ ...c, groups: [...c.groups, newGroup()] }));
  }

  function updateOption(gIdx: number, oIdx: number, patch: Partial<ModifierOption>) {
    setConfig((c) => ({
      ...c,
      groups: c.groups.map((g, gi) =>
        gi === gIdx
          ? { ...g, options: g.options.map((o, oi) => (oi === oIdx ? { ...o, ...patch } : o)) }
          : g,
      ),
    }));
  }

  function removeOption(gIdx: number, oIdx: number) {
    setConfig((c) => ({
      ...c,
      groups: c.groups.map((g, gi) =>
        gi === gIdx ? { ...g, options: g.options.filter((_, oi) => oi !== oIdx) } : g,
      ),
    }));
  }

  function addOption(gIdx: number) {
    setConfig((c) => ({
      ...c,
      groups: c.groups.map((g, gi) =>
        gi === gIdx ? { ...g, options: [...g.options, newOption()] } : g,
      ),
    }));
  }

  async function save() {
    setSaving(true);
    const cleaned = config.groups.length === 0 && config.notesEnabled
      ? null
      : config;
    const { error } = await sb
      .from("menu_items")
      .update({ modifiers_json: cleaned })
      .eq("id", itemId);
    setSaving(false);
    if (error) onError(error.message);
    else onSaved();
  }

  async function clear() {
    setSaving(true);
    const { error } = await sb
      .from("menu_items")
      .update({ modifiers_json: null })
      .eq("id", itemId);
    setSaving(false);
    if (error) onError(error.message);
    else {
      setConfig(EMPTY_CONFIG);
      onSaved();
    }
  }

  return (
    <div className="w-full mt-2 bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-indigo-800">مجموعات الإضافات</h4>
        <button
          type="button"
          onClick={addGroup}
          className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
        >
          + مجموعة جديدة
        </button>
      </div>

      {config.groups.length === 0 && (
        <p className="text-[11px] text-indigo-500">لا توجد إضافات. اضغط "مجموعة جديدة" لإضافة.</p>
      )}

      {config.groups.map((g, gi) => (
        <div key={g.key} className="bg-white border border-indigo-100 rounded-lg p-2 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={g.label}
              onChange={(e) => updateGroup(gi, { label: e.target.value })}
              placeholder="اسم المجموعة (مثل: نوع الأرز)"
              className="flex-1 min-w-[140px] h-7 text-xs rounded border border-indigo-200 px-2 outline-none focus:border-indigo-500"
            />
            <select
              value={g.type}
              onChange={(e) => updateGroup(gi, { type: e.target.value as "single" | "multi" })}
              className="h-7 text-[10px] rounded border border-indigo-200 px-1"
            >
              <option value="single">اختيار واحد</option>
              <option value="multi">متعدد</option>
            </select>
            <label className="flex items-center gap-1 text-[10px] text-indigo-700">
              <input
                type="checkbox"
                checked={g.required}
                onChange={(e) => updateGroup(gi, { required: e.target.checked })}
              />
              مطلوب
            </label>
            {g.type === "multi" && (
              <label className="flex items-center gap-1 text-[10px] text-indigo-700">
                حد أقصى:
                <input
                  type="number"
                  min={1}
                  value={g.max}
                  onChange={(e) => updateGroup(gi, { max: Number(e.target.value) || 99 })}
                  className="w-10 h-6 text-[10px] rounded border border-indigo-200 px-1 text-center"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => removeGroup(gi)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100"
            >
              حذف
            </button>
          </div>

          {/* Options list */}
          <div className="space-y-1">
            {g.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={o.label}
                  onChange={(e) => updateOption(gi, oi, { label: e.target.value })}
                  placeholder="اسم الخيار"
                  className="flex-1 min-w-[100px] h-6 text-[11px] rounded border border-neutral-200 px-1.5 outline-none focus:border-indigo-400"
                />
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    step="0.5"
                    value={o.priceDelta}
                    onChange={(e) => updateOption(gi, oi, { priceDelta: Number(e.target.value) || 0 })}
                    className="w-14 h-6 text-[11px] rounded border border-neutral-200 px-1 text-left outline-none focus:border-indigo-400"
                  />
                  <span className="text-[9px] text-neutral-400">ر.س</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeOption(gi, oi)}
                  className="text-[10px] text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addOption(gi)}
            className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          >
            + خيار
          </button>
        </div>
      ))}

      {/* Notes toggle */}
      <label className="flex items-center gap-2 text-[11px] text-indigo-700">
        <input
          type="checkbox"
          checked={config.notesEnabled}
          onChange={(e) => setConfig((c) => ({ ...c, notesEnabled: e.target.checked }))}
        />
        السماح بملاحظات العميل
      </label>

      {/* Save / Clear */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "يحفظ..." : "حفظ"}
        </button>
        {initial && (
          <button
            type="button"
            onClick={clear}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            مسح الكل
          </button>
        )}
      </div>
    </div>
  );
}
