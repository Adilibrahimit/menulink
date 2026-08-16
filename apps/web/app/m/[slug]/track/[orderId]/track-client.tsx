"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toArabicDigits } from "@/lib/arabic";
import { isActive } from "@/lib/order-status";
import { fetchOrderStatus, trackOrder, type OrderStatusSnapshot } from "@/lib/order-tracking";
import OrderStatusView from "../../order-status-view";

const POLL_MS = 20_000;

export default function TrackClient({
  slug,
  orderId,
  initial,
}: {
  slug: string;
  orderId: string;
  initial: OrderStatusSnapshot;
}) {
  const [snap, setSnap] = useState<OrderStatusSnapshot>(initial);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchOrderStatus(orderId);
    if (next) setSnap(next);
  }, [orderId]);

  // Opening the link on a second device (the person collecting the order)
  // should add it to that device's bar too.
  useEffect(() => {
    trackOrder(initial.restaurant_id, orderId, String(initial.daily_order_number ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isActive(snap.status)) return; // finished: stop polling
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(() => void refresh(), POLL_MS); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const onVis = () => (document.visibilityState === "visible" ? (void refresh(), start()) : stop());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [refresh, snap.status]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL bar still has the link */
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--bg,#fff8f6)] px-4 py-6" dir="rtl">
      <div className="mx-auto max-w-md space-y-4">
        <header className="text-center">
          <p className="text-xs text-neutral-500">{snap.restaurant_name}</p>
          <h1
            className="text-2xl font-extrabold text-neutral-900 mt-0.5"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {snap.daily_order_number != null
              ? `طلب #${toArabicDigits(String(snap.daily_order_number))}`
              : "تتبع الطلب"}
          </h1>
          {snap.branch_name_ar && (
            <p className="text-xs text-neutral-500 mt-1">🏢 {snap.branch_name_ar}</p>
          )}
          {snap.table_label && (
            <p className="text-xs text-neutral-500 mt-0.5">🪑 طاولة {snap.table_label}</p>
          )}
        </header>

        <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
          <OrderStatusView snap={snap} />
        </section>

        {snap.total != null && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-neutral-500">الإجمالي</span>
            <span className="font-extrabold text-neutral-900">
              {toArabicDigits(Number(snap.total).toFixed(2))} ر.س
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 h-11 rounded-2xl border border-neutral-300 bg-white text-sm font-bold text-neutral-700"
          >
            {copied ? "تم نسخ الرابط ✓" : "📋 نسخ الرابط"}
          </button>
          <Link
            href={`/m/${slug}`}
            className="flex-1 h-11 rounded-2xl bg-[var(--brand,#ac0015)] text-white text-sm font-extrabold grid place-items-center"
          >
            العودة للقائمة
          </Link>
        </div>

        <p className="text-[11px] text-neutral-400 text-center">
          تتحدّث الحالة تلقائياً. احفظ الرابط أو أرسله لمن سيستلم الطلب.
        </p>
      </div>
    </main>
  );
}
