"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { toArabicDigits } from "@/lib/arabic";

export type TrackingState = {
  orderId: string;
  plate: string;
  color: string;
  arrived: boolean;
};

export default function TrackingSheet({
  tracking,
  restaurantName,
  onClose,
  onArrived,
  onClear,
}: {
  tracking: TrackingState;
  restaurantName: string;
  onClose: () => void;
  onArrived: () => void;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [arrived, setArrived] = useState(tracking.arrived);
  const [error, setError] = useState<string | null>(null);

  async function fireArrived() {
    setBusy(true);
    setError(null);
    try {
      const sb = createClient();
      const { data, error: err } = await sb.rpc("mark_arrived", {
        p_order_id: tracking.orderId,
        p_plate: tracking.plate,
      });
      if (err) throw err;
      const result = data as { ok: boolean; reason: string | null } | null;
      if (result?.ok) {
        setArrived(true);
        onArrived();
      } else {
        setError(
          result?.reason === "plate_mismatch"
            ? "تعذر التحقق من اللوحة. تواصل مع المطعم عبر واتساب."
            : result?.reason === "not_found"
              ? "الطلب غير موجود."
              : "تعذر إرسال الإشعار. أعد المحاولة.",
        );
      }
    } catch {
      setError("تعذر الاتصال. تحقق من الإنترنت وأعد المحاولة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl">
      <div onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🚗</span>
          <div className="flex-1 min-w-0">
            <h2
              className="font-extrabold text-lg leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              طلب استلام بالسيارة
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">{restaurantName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {(tracking.plate || tracking.color) && (
          <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-3 space-y-1.5 text-sm">
            {tracking.plate && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">رقم اللوحة</span>
                <span className="font-bold" dir="ltr">{tracking.plate}</span>
              </div>
            )}
            {tracking.color && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">لون السيارة</span>
                <span className="font-bold">{tracking.color}</span>
              </div>
            )}
          </div>
        )}

        {arrived ? (
          <>
            <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center">
              <div className="text-3xl mb-1">✅</div>
              <p
                className="font-extrabold text-green-800 text-base"
                style={{ fontFamily: "var(--font-display)" }}
              >
                أبلغنا المطعم بوصولك
              </p>
              <p className="text-xs text-green-700 mt-1 leading-relaxed">
                سيخرج إليك الموظف بطلبك خلال دقائق.
              </p>
            </div>
            <button
              onClick={onClear}
              className="w-full h-11 rounded-2xl bg-neutral-100 text-neutral-700 font-bold text-sm hover:bg-neutral-200"
            >
              إنهاء
            </button>
          </>
        ) : (
          <>
            <button
              onClick={fireArrived}
              disabled={busy}
              className="w-full h-14 rounded-2xl bg-[var(--brand)] text-white font-extrabold text-base hover:opacity-90 disabled:opacity-60 active:translate-y-px shadow-md"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {busy ? "جاري الإرسال..." : "🚗 وصلت إلى المطعم"}
            </button>
            {error && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            <button
              onClick={onClear}
              className="w-full h-10 rounded-xl text-neutral-500 text-xs hover:bg-neutral-50"
            >
              إلغاء التتبع
            </button>
          </>
        )}
      </div>
    </div>
  );
}
