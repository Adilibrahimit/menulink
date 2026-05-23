"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type CatalogRow = {
  key: string;
  name_ar: string;
  description_ar: string | null;
  category: "operations" | "growth" | "integrations";
  default_price_sar: number;
  trial_days: number;
  is_default: boolean;
  sort_order: number;
};

type AddonRow = {
  addon_key: string;
  enabled: boolean;
  trial_ends_at: string | null;
  price_override_sar: number | null;
  notes: string | null;
};

type RowState = {
  enabled: boolean;
  trial_ends_at: string;        // YYYY-MM-DD or ""
  price_override_sar: string;   // numeric string or ""
  notes: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
};

const CATEGORY_LABEL: Record<CatalogRow["category"], string> = {
  operations:   "العمليات",
  growth:       "النمو",
  integrations: "الربط مع أنظمة",
};

const CATEGORY_ORDER: CatalogRow["category"][] = ["operations", "growth", "integrations"];

function rowStateFrom(addon: AddonRow | undefined): RowState {
  return {
    enabled: addon?.enabled ?? false,
    trial_ends_at: addon?.trial_ends_at ? addon.trial_ends_at.slice(0, 10) : "",
    price_override_sar: addon?.price_override_sar != null ? String(addon.price_override_sar) : "",
    notes: addon?.notes ?? "",
    dirty: false,
    saving: false,
    error: null,
  };
}

export default function AddonManager({
  restaurantId,
  catalog,
  initial,
}: {
  restaurantId: string;
  catalog: CatalogRow[];
  initial: AddonRow[];
}) {
  const initialMap = useMemo(() => {
    const m: Record<string, AddonRow> = {};
    for (const a of initial) m[a.addon_key] = a;
    return m;
  }, [initial]);

  const [state, setState] = useState<Record<string, RowState>>(() => {
    const s: Record<string, RowState> = {};
    for (const c of catalog) s[c.key] = rowStateFrom(initialMap[c.key]);
    return s;
  });

  function patch(key: string, p: Partial<RowState>) {
    setState((s) => ({ ...s, [key]: { ...s[key], ...p, dirty: true } }));
  }

  function setTrialPreset(key: string, days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    patch(key, { trial_ends_at: d.toISOString().slice(0, 10) });
  }

  async function save(c: CatalogRow) {
    const cur = state[c.key];
    setState((s) => ({ ...s, [c.key]: { ...s[c.key], saving: true, error: null } }));
    const sb = createClient();
    const payload = {
      restaurant_id: restaurantId,
      addon_key: c.key,
      enabled: cur.enabled,
      trial_ends_at: cur.trial_ends_at ? new Date(cur.trial_ends_at).toISOString() : null,
      price_override_sar: cur.price_override_sar.trim() ? Number(cur.price_override_sar) : null,
      notes: cur.notes.trim() || null,
    };
    const { error: err } = await sb
      .from("subscription_addons")
      .upsert(payload, { onConflict: "restaurant_id,addon_key" });
    setState((s) => ({
      ...s,
      [c.key]: {
        ...s[c.key],
        saving: false,
        dirty: err ? s[c.key].dirty : false,
        error: err ? err.message : null,
      },
    }));
  }

  const byCategory: Record<string, CatalogRow[]> = {};
  for (const c of catalog) (byCategory[c.category] ??= []).push(c);

  return (
    <div className="space-y-5">
      {CATEGORY_ORDER.map((cat) => {
        const rows = byCategory[cat] ?? [];
        if (rows.length === 0) return null;
        return (
          <div key={cat} className="space-y-2">
            <h3 className="text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
              {CATEGORY_LABEL[cat]}
            </h3>
            <ul className="space-y-2">
              {rows.map((c) => {
                const s = state[c.key];
                return (
                  <li
                    key={c.key}
                    className={
                      "rounded-xl border p-3 " +
                      (s.enabled
                        ? "bg-neutral-800/60 border-neutral-700"
                        : "bg-neutral-900 border-neutral-800")
                    }
                  >
                    {/* Header row */}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-100">{c.name_ar}</span>
                          <code className="text-[10px] text-neutral-500 font-mono">{c.key}</code>
                          {c.is_default && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-800">
                              أساسي
                            </span>
                          )}
                        </div>
                        {c.description_ar && (
                          <p className="text-xs text-neutral-400 leading-relaxed mt-1">
                            {c.description_ar}
                          </p>
                        )}
                        <div className="text-[10px] text-neutral-500 mt-1.5">
                          {c.default_price_sar > 0
                            ? `السعر الافتراضي: ${c.default_price_sar} ر.س/شهر`
                            : "مجاناً"}
                          {c.trial_days > 0 && (
                            <> · تجربة {c.trial_days} يوم متاحة</>
                          )}
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 select-none">
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          onChange={(e) => patch(c.key, { enabled: e.target.checked })}
                          className="w-5 h-5 accent-green-500"
                        />
                        <span className="text-xs text-neutral-300">
                          {s.enabled ? "مفعّل" : "معطّل"}
                        </span>
                      </label>
                    </div>

                    {/* Advanced fields */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-1">
                          ينتهي التجربة في
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="date"
                            value={s.trial_ends_at}
                            onChange={(e) => patch(c.key, { trial_ends_at: e.target.value })}
                            className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 h-8 text-xs text-neutral-100 outline-none focus:border-neutral-500"
                          />
                          {c.trial_days > 0 && (
                            <button
                              type="button"
                              onClick={() => setTrialPreset(c.key, c.trial_days)}
                              className="px-2 h-8 rounded bg-neutral-800 border border-neutral-700 text-[10px] text-neutral-300 hover:bg-neutral-700"
                              title={`+${c.trial_days} يوم`}
                            >
                              +{c.trial_days}ي
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-1">
                          سعر مخصص لهذا المطعم
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={s.price_override_sar}
                          onChange={(e) => patch(c.key, { price_override_sar: e.target.value })}
                          placeholder={c.default_price_sar > 0 ? String(c.default_price_sar) : "0"}
                          className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 h-8 text-xs text-neutral-100 outline-none focus:border-neutral-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-1">ملاحظات</label>
                        <input
                          type="text"
                          value={s.notes}
                          onChange={(e) => patch(c.key, { notes: e.target.value })}
                          placeholder="—"
                          className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 h-8 text-xs text-neutral-100 outline-none focus:border-neutral-500"
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                      {s.error ? (
                        <p className="text-[11px] text-rose-300">{s.error}</p>
                      ) : (
                        <span className="text-[10px] text-neutral-600">
                          {s.dirty ? "تغييرات غير محفوظة" : "محفوظ"}
                        </span>
                      )}
                      <button
                        onClick={() => save(c)}
                        disabled={!s.dirty || s.saving}
                        className="px-3 h-8 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-semibold disabled:opacity-40"
                      >
                        {s.saving ? "..." : "حفظ"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
