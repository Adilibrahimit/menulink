"use client";

import { toArabicDigits } from "@/lib/arabic";
import {
  ORDER_STEPS,
  STATUS_ICON,
  STATUS_LABEL_AR,
  finalStepLabel,
  stepIndex,
  type OrderStatus,
} from "@/lib/order-status";
import type { OrderStatusSnapshot } from "@/lib/order-tracking";

/**
 * The 5-step progress view. Rendered by BOTH the bar on the menu page and the
 * shareable /track page, so the two can never disagree.
 */
export default function OrderStatusView({ snap }: { snap: OrderStatusSnapshot }) {
  const current = stepIndex(snap.status);
  const cancelled = snap.status === "cancelled";
  const eventAt = new Map(snap.events.map((e) => [e.new_status, e.created_at]));

  if (cancelled) {
    return (
      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-center">
        <div className="text-3xl mb-1">{STATUS_ICON.cancelled}</div>
        <p className="font-extrabold text-rose-800" style={{ fontFamily: "var(--font-display)" }}>
          تم إلغاء الطلب
        </p>
        <p className="text-xs text-rose-600 mt-1">تواصل مع المطعم لمعرفة التفاصيل</p>
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {ORDER_STEPS.map((step, i) => {
        const done = i <= current;
        const isNow = i === current;
        const label = step === "delivered" ? finalStepLabel(snap.order_type) : STATUS_LABEL_AR[step as OrderStatus];
        const at = eventAt.get(step) ?? (step === "submitted" ? snap.created_at : null);
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={
                  "w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs transition-colors " +
                  (done ? "bg-[var(--brand)] text-white" : "bg-neutral-200 text-neutral-400")
                }
              >
                {done ? "✓" : i + 1}
              </span>
              {i < ORDER_STEPS.length - 1 && (
                <span className={"w-0.5 flex-1 min-h-[18px] " + (i < current ? "bg-[var(--brand)]" : "bg-neutral-200")} />
              )}
            </div>
            <div className="pb-3 flex-1">
              <p
                className={
                  "text-sm leading-tight " +
                  (isNow ? "font-extrabold text-[var(--brand)]" : done ? "font-bold text-neutral-800" : "text-neutral-400")
                }
                style={{ fontFamily: "var(--font-display)" }}
              >
                {STATUS_ICON[step as OrderStatus]} {label}
              </p>
              {at && done && (
                <p className="text-[11px] text-neutral-400 mt-0.5" dir="ltr">
                  {new Date(at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact one-liner for the bar. */
export function OrderStatusSummary({ snap }: { snap: OrderStatusSnapshot }) {
  const label =
    snap.status === "delivered"
      ? finalStepLabel(snap.order_type)
      : STATUS_LABEL_AR[snap.status as OrderStatus] ?? snap.status;
  const num = snap.daily_order_number;
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="text-base shrink-0">{STATUS_ICON[snap.status as OrderStatus] ?? "🍽️"}</span>
      <span className="truncate">
        {num != null && <>طلب #{toArabicDigits(String(num))} · </>}
        <span className="font-extrabold">{label}</span>
      </span>
    </span>
  );
}
