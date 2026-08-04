"use client";

import { useState } from "react";
import { DAY_KEYS, DAY_LABELS_AR, windowsFor, type DayHours, type HoursJson } from "@/lib/hours";

/**
 * Week-grid editor for hours_json. Used twice:
 *   /admin/info     — the restaurant default
 *   /admin/branches — a per-branch override (blank = inherit the restaurant's)
 *
 * Emits exactly the shape lib/hours.ts and public.is_within_hours() read:
 *   { "sun": "12:00-23:00", "mon": ["12:00-15:00","18:00-02:00"], "fri": "closed" }
 * A day the owner never touches is omitted, which means OPEN — same fail-open
 * rule as the rest of the stack.
 */

type Mode = "open24" | "closed" | "windows";

function modeOf(entry: DayHours): Mode {
  const wins = windowsFor(entry);
  if (wins.length === 0) return "open24";
  const first = wins[0].toLowerCase();
  if (first === "closed" || first === "مغلق") return "closed";
  if (first === "24/7" || first === "24-7" || first === "مفتوح") return "open24";
  return "windows";
}

function windowsOf(entry: DayHours): string[] {
  const wins = windowsFor(entry).filter((w) => modeOf(w) === "windows");
  return wins.length ? wins : ["12:00-23:00"];
}

export default function HoursEditor({
  value,
  onChange,
  inheritLabel,
}: {
  value: HoursJson;
  onChange: (next: HoursJson) => void;
  /** Shown on the "not set" state, e.g. "يتبع أوقات المطعم". */
  inheritLabel?: string;
}) {
  const hours = value ?? {};
  const configured = value != null && Object.keys(hours).length > 0;
  const [copySource, setCopySource] = useState<string>("sun");

  function setDay(day: string, entry: DayHours) {
    const next = { ...hours };
    if (entry == null) delete next[day];
    else next[day] = entry;
    onChange(Object.keys(next).length ? next : null);
  }

  function setMode(day: string, mode: Mode) {
    if (mode === "closed") setDay(day, "closed");
    else if (mode === "open24") setDay(day, "24/7");
    else setDay(day, windowsOf(hours[day])[0]);
  }

  /**
   * Never writes a half-empty window.
   *
   * Clearing one of the two <input type="time"> fields used to save "14:00-" or
   * "-23:00". Nothing in the stack can parse those, and unparseable means OPEN
   * (the deliberate fail-open rule) — so an owner who fumbled a field got a
   * restaurant that silently never closes, which is the exact opposite of what
   * they were trying to configure. Keep the previous side instead.
   */
  function setWindow(day: string, idx: number, from: string, to: string) {
    const wins = [...windowsOf(hours[day])];
    const [prevFrom = "", prevTo = ""] = (wins[idx] ?? "").split("-").map((s) => s.trim());
    wins[idx] = `${from || prevFrom}-${to || prevTo}`;
    setDay(day, wins.length === 1 ? wins[0] : wins);
  }

  function addWindow(day: string) {
    setDay(day, [...windowsOf(hours[day]), "18:00-02:00"]);
  }

  function removeWindow(day: string, idx: number) {
    const wins = windowsOf(hours[day]).filter((_, i) => i !== idx);
    setDay(day, wins.length === 0 ? "closed" : wins.length === 1 ? wins[0] : wins);
  }

  function copyToAll() {
    const src = hours[copySource];
    if (src == null) return;
    const next: Record<string, DayHours> = {};
    for (const d of DAY_KEYS) next[d] = src;
    onChange(next);
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 p-4 text-center space-y-2">
        <p className="text-sm text-neutral-600">
          {inheritLabel ?? "لم تُحدَّد أوقات عمل — الطلبات مفتوحة طوال الوقت."}
        </p>
        <button
          type="button"
          onClick={() => onChange(Object.fromEntries(DAY_KEYS.map((d) => [d, "12:00-23:00"])))}
          className="h-10 px-4 rounded-xl bg-[var(--brand,#ac0015)] text-white text-sm font-bold"
        >
          تحديد أوقات العمل
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-neutral-500">انسخ من</span>
        <select
          value={copySource}
          onChange={(e) => setCopySource(e.target.value)}
          className="h-8 rounded-lg border border-neutral-300 px-2"
        >
          {DAY_KEYS.map((d) => (
            <option key={d} value={d}>{DAY_LABELS_AR[d]}</option>
          ))}
        </select>
        <button type="button" onClick={copyToAll} className="h-8 px-3 rounded-lg border border-neutral-300 font-semibold">
          لكل الأيام
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="h-8 px-3 rounded-lg border border-neutral-300 text-neutral-500 mr-auto"
        >
          إلغاء التحديد
        </button>
      </div>

      {DAY_KEYS.map((day) => {
        const entry = hours[day];
        const mode = modeOf(entry);
        const wins = windowsOf(entry);
        return (
          <div key={day} className="rounded-xl border border-neutral-200 p-2.5 flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-sm font-bold text-neutral-800">{DAY_LABELS_AR[day]}</span>

            <select
              value={mode}
              onChange={(e) => setMode(day, e.target.value as Mode)}
              className="h-9 rounded-lg border border-neutral-300 px-2 text-sm"
            >
              <option value="windows">أوقات محددة</option>
              <option value="open24">٢٤ ساعة</option>
              <option value="closed">مغلق</option>
            </select>

            {mode === "windows" && (
              <div className="flex flex-wrap items-center gap-1.5">
                {wins.map((w, i) => {
                  const [from = "", to = ""] = w.split("-").map((s) => s.trim());
                  return (
                    <span key={i} className="inline-flex items-center gap-1">
                      <input
                        type="time"
                        value={from}
                        onChange={(e) => setWindow(day, i, e.target.value, to)}
                        className="h-9 rounded-lg border border-neutral-300 px-1.5 text-sm"
                      />
                      <span className="text-neutral-400 text-xs">→</span>
                      <input
                        type="time"
                        value={to}
                        onChange={(e) => setWindow(day, i, from, e.target.value)}
                        className="h-9 rounded-lg border border-neutral-300 px-1.5 text-sm"
                      />
                      {wins.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWindow(day, i)}
                          className="h-9 w-8 rounded-lg border border-neutral-300 text-neutral-500"
                          aria-label="حذف الفترة"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
                {/* Split shifts are the norm here — around prayer, or a
                    lunch/dinner break. One window per day was the old limit. */}
                <button
                  type="button"
                  onClick={() => addWindow(day)}
                  className="h-9 px-2.5 rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-600"
                >
                  + فترة
                </button>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[11px] text-neutral-500 leading-relaxed">
        الفترة التي تتجاوز منتصف الليل مدعومة (مثال ٦:٠٠ م → ٢:٠٠ ص). اليوم غير المحدَّد يعتبر مفتوحاً.
      </p>
    </div>
  );
}
