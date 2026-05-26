"use client";

import { toArabicDigits } from "@/lib/arabic";

type OrderEvent = {
  new_status: string;
  created_at: string;
};

const STEPS = [
  { key: "submitted", label: "جديد", icon: "📋" },
  { key: "confirmed", label: "مؤكد", icon: "✅" },
  { key: "preparing", label: "تجهيز", icon: "👨‍🍳" },
  { key: "ready", label: "جاهز", icon: "🎉" },
  { key: "delivered", label: "تم التسليم", icon: "📦" },
] as const;

const STATUS_INDEX: Record<string, number> = {};
STEPS.forEach((s, i) => { STATUS_INDEX[s.key] = i; });

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-SA", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrderStatusTracker({
  status,
  events,
}: {
  status: string;
  events: OrderEvent[];
}) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
        <span className="text-lg">❌</span>
        <span className="text-xs font-bold text-red-700">تم إلغاء الطلب</span>
      </div>
    );
  }

  const currentIdx = STATUS_INDEX[status] ?? 0;
  const eventMap = new Map<string, string>();
  events.forEach((e) => {
    if (e.new_status && e.created_at) eventMap.set(e.new_status, e.created_at);
  });

  return (
    <div className="flex items-start gap-0 overflow-x-auto py-2">
      {STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const ts = eventMap.get(step.key);
        const isLast = i === STEPS.length - 1;

        return (
          <div key={step.key} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div
                className={
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 transition-all " +
                  (done
                    ? isCurrent
                      ? "bg-[var(--brand)] text-white shadow-md animate-pulse"
                      : "bg-[var(--brand)] text-white"
                    : "bg-neutral-100 text-neutral-400")
                }
              >
                {step.icon}
              </div>
              <span
                className={
                  "text-[9px] font-bold mt-1 text-center leading-tight " +
                  (done ? "text-neutral-800" : "text-neutral-400")
                }
              >
                {step.label}
              </span>
              {ts && (
                <span className="text-[8px] text-neutral-400 mt-0.5" dir="ltr">
                  {toArabicDigits(formatTime(ts))}
                </span>
              )}
            </div>
            {!isLast && (
              <div
                className={
                  "flex-1 h-0.5 mt-4 mx-1 rounded-full transition-colors " +
                  (i < currentIdx ? "bg-[var(--brand)]" : "bg-neutral-200")
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
