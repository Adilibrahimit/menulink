"use client";

import type { OrderType } from "./types";

const ORDER_TYPES: { key: OrderType; icon: string; label: string; desc: string }[] = [
  { key: "delivery", icon: "🚗", label: "توصيل", desc: "نوصلك لباب بيتك" },
  { key: "pickup", icon: "🏪", label: "استلام من الفرع", desc: "جهّز طلبك وتعال استلمه" },
  { key: "dine_in", icon: "🪑", label: "تناول في المطعم", desc: "اطلب وأنت في المكان" },
  { key: "car", icon: "🚙", label: "استلام بالسيارة", desc: "نجيك للسيارة" },
];

export default function OrderTypeGate({
  restaurantName,
  logoUrl,
  onSelect,
}: {
  restaurantName: string;
  logoUrl: string | null;
  onSelect: (type: OrderType) => void;
}) {
  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6"
      dir="rtl"
      style={{ background: "var(--bg)" }}
    >
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={restaurantName}
          className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-lg mb-5"
        />
      )}

      <h1
        className="text-xl font-extrabold text-[var(--ink)] mb-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        كيف تبي تطلب؟
      </h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">اختر طريقة الاستلام</p>

      <div className="w-full max-w-sm space-y-3">
        {ORDER_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            className="w-full flex items-center gap-4 rounded-2xl border-2 border-[var(--card-border,#e5e7eb)] bg-[var(--card-bg,#fff)] px-4 py-4 hover:border-[var(--brand)] active:translate-y-px transition-colors"
          >
            <span className="text-3xl">{t.icon}</span>
            <div className="flex-1 min-w-0 text-right">
              <div
                className="font-extrabold text-[var(--ink)] text-base"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t.label}
              </div>
              <div className="text-xs text-[var(--text-secondary,#71717a)] mt-0.5">{t.desc}</div>
            </div>
            <span className="text-neutral-300 text-lg">←</span>
          </button>
        ))}
      </div>
    </div>
  );
}
