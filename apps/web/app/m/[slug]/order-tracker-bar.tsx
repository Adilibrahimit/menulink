"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { isActive } from "@/lib/order-status";
import {
  fetchOrderStatus,
  readTracked,
  untrackOrder,
  type OrderStatusSnapshot,
} from "@/lib/order-tracking";
import OrderStatusView, { OrderStatusSummary } from "./order-status-view";

const POLL_MS = 20_000;

/**
 * Bottom bar showing the live status of orders this device placed — including
 * guest orders, which previously had no post-checkout feedback at all.
 *
 * Polls rather than subscribing: Realtime on `orders` needs a SELECT policy a
 * guest doesn't have, whereas get_order_status is an anon SECURITY DEFINER read
 * keyed on the order id. Polling stops while the tab is hidden so a phone left
 * on the menu page doesn't sit there waking the radio.
 */
export default function OrderTrackerBar({
  restaurantId,
  slug,
  version,
}: {
  restaurantId: string;
  slug: string;
  /** Bump to re-read localStorage right after an order is placed. */
  version: number;
}) {
  const [snaps, setSnaps] = useState<OrderStatusSnapshot[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const tracked = readTracked(restaurantId);
    if (tracked.length === 0) {
      setSnaps([]);
      return;
    }
    const results = await Promise.all(tracked.map((t) => fetchOrderStatus(t.orderId)));
    const live: OrderStatusSnapshot[] = [];
    results.forEach((snap, i) => {
      if (!snap) {
        // Order vanished (or the id is bad) — stop asking about it.
        untrackOrder(restaurantId, tracked[i].orderId);
        return;
      }
      if (isActive(snap.status)) live.push(snap);
      else untrackOrder(restaurantId, snap.order_id); // delivered / cancelled: done
    });
    setSnaps(live);
  }, [restaurantId]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      void refresh();
      timer = setInterval(() => void refresh(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, version]);

  if (snaps.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 pb-2 pointer-events-none" dir="rtl">
      <div className="mx-auto max-w-md space-y-2 pointer-events-auto">
        {snaps.map((snap) => {
          const open = expandedId === snap.order_id;
          return (
            <div
              key={snap.order_id}
              className="rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.14)] border border-black/5 overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(open ? null : snap.order_id)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-sm text-neutral-800"
                style={{ fontFamily: "var(--font-display)" }}
                aria-expanded={open}
              >
                <OrderStatusSummary snap={snap} />
                <span className={"text-neutral-400 transition-transform shrink-0 " + (open ? "rotate-180" : "")}>▲</span>
              </button>

              {open && (
                <div className="px-3.5 pb-3.5 border-t border-neutral-100 pt-3">
                  <OrderStatusView snap={snap} />
                  <div className="flex items-center gap-2 mt-1">
                    <Link
                      href={`/m/${slug}/track/${snap.order_id}`}
                      className="flex-1 h-10 rounded-xl bg-[var(--brand)] text-white text-xs font-extrabold grid place-items-center"
                    >
                      صفحة تتبع الطلب
                    </Link>
                    <button
                      onClick={() => {
                        untrackOrder(restaurantId, snap.order_id);
                        void refresh();
                      }}
                      className="h-10 px-3 rounded-xl border border-neutral-200 text-xs text-neutral-500"
                    >
                      إخفاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
