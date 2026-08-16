"use client";

import { DAY_KEYS, DAY_LABELS_AR, dayLabel, getOpenState, type HoursJson } from "@/lib/hours";

/**
 * Kept as a named re-export so existing call sites keep working. The parsing
 * itself now lives in lib/hours.ts, shared with the branch picker and mirrored
 * by public.is_within_hours() in migration 0080 (which is the real gate — this
 * is only the UX).
 */
export function isRestaurantOpen(
  hoursJson: HoursJson,
  tz?: string,
): { open: boolean; todayHours: string | null; nextOpenLabel: string | null } {
  const s = getOpenState(hoursJson, tz);
  return {
    open: s.open,
    todayHours: s.today.length ? dayLabel(s.today) : null,
    nextOpenLabel: s.nextOpenLabel,
  };
}

export default function ClosedPopup({
  restaurantName,
  hoursJson,
  timezone,
  onClose,
}: {
  restaurantName: string;
  hoursJson: HoursJson;
  timezone?: string;
  onClose: () => void;
}) {
  const { nextOpenLabel } = getOpenState(hoursJson, timezone);
  const todayKey = DAY_KEYS[new Date().getDay()];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="relative w-[90%] max-w-sm bg-white rounded-3xl shadow-xl p-6 space-y-4">
        <div className="text-center">
          <div className="text-5xl mb-2">🕐</div>
          <h2
            className="font-extrabold text-lg text-neutral-900"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {restaurantName} مغلق حالياً
          </h2>
          {/* Telling them WHEN we open beats a bare "we're closed" — the data
              is already here, so there's no reason not to. */}
          {nextOpenLabel && (
            <p
              className="text-sm font-bold text-[var(--brand)] mt-1.5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {nextOpenLabel}
            </p>
          )}
          <p className="text-sm text-neutral-600 mt-1" style={{ fontFamily: "var(--font-display)" }}>
            لا يمكن إضافة أصناف للسلة خارج أوقات العمل
          </p>
        </div>

        {hoursJson && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 space-y-1">
            <h3 className="text-xs font-bold text-neutral-500 mb-1" style={{ fontFamily: "var(--font-display)" }}>
              أوقات العمل
            </h3>
            {DAY_KEYS.map((d) => {
              const entry = hoursJson[d];
              if (entry == null) return null;
              const isToday = todayKey === d;
              return (
                <div
                  key={d}
                  className={`flex items-center justify-between text-sm py-0.5 ${isToday ? "font-bold text-[var(--brand)]" : "text-neutral-700"}`}
                >
                  <span>{DAY_LABELS_AR[d]}</span>
                  <span dir="ltr" className="text-xs">
                    {dayLabel(entry)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold active:translate-y-px shadow-md"
          style={{ fontFamily: "var(--font-display)" }}
        >
          حسناً
        </button>
      </div>
    </div>
  );
}
