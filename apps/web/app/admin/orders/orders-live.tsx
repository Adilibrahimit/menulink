"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type CustomerInfo = { name: string | null; phone: string };
type OrderRow = {
  id: string;
  order_type: string;
  channel: string;
  status: string;
  subtotal: string;
  delivery_fee: string;
  total: string;
  address: string | null;
  notes: string | null;
  car_plate: string | null;
  car_color: string | null;
  car_arrived_at: string | null;
  table_label: string | null;
  created_at: string;
  customers: CustomerInfo | CustomerInfo[] | null;
};

const STATUSES = ["submitted", "confirmed", "preparing", "ready", "delivered", "cancelled"] as const;
const STATUS_LABEL_AR: Record<string, string> = {
  submitted: "جديد",
  confirmed: "مؤكد",
  preparing: "تجهيز",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};
const ORDER_TYPE_LABEL: Record<string, string> = {
  delivery: "توصيل",
  pickup: "استلام",
  dine_in: "في المطعم",
  car: "سيارة",
};

function getCustomer(o: OrderRow): CustomerInfo | null {
  if (!o.customers) return null;
  return Array.isArray(o.customers) ? o.customers[0] ?? null : o.customers;
}

// "Today" in Riyadh as a YYYY-MM-DD string — used both for filtering and the export URL.
function todayRiyadhISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}
function isToday(iso: string): boolean {
  const d = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  return d === todayRiyadhISO();
}

/* ---------------- Persistent sound alert ---------------- */
/** Web Audio bell-tone generator. Loops until stop() is called. No mp3 file needed. */
function useAlertSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const unlockedRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  // Must be called inside a user gesture (button click) at least once to allow autoplay.
  function unlock() {
    if (unlockedRef.current) return;
    const ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!ctor) return;
    ctxRef.current = new ctor();
    // Some browsers create the context suspended — resume on this gesture.
    ctxRef.current?.resume().catch(() => {});
    unlockedRef.current = true;
  }

  function beep() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    // Two-note "doorbell" chime: G5 then E5.
    const notes = [
      { freq: 784, start: 0,    dur: 0.18 },
      { freq: 659, start: 0.22, dur: 0.28 },
    ];
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + n.start;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);
      osc.start(t);
      osc.stop(t + n.dur);
    });
  }

  function start() {
    if (!unlockedRef.current || playing) return;
    setPlaying(true);
    beep(); // immediate first ring
    intervalRef.current = window.setInterval(beep, 1800);
  }

  function stop() {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current != null) clearInterval(intervalRef.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return { unlock, start, stop, playing, unlocked: () => unlockedRef.current };
}

export default function OrdersLive({
  restaurantId,
  initial,
  restaurantSlug,
  excelEnabled,
}: {
  restaurantId: string;
  initial: OrderRow[];
  restaurantSlug: string;
  excelEnabled: boolean;
}) {
  const [rows, setRows] = useState<OrderRow[]>(initial);
  const [todayOnly, setTodayOnly] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const alert = useAlertSound();

  // Filter shown rows
  const visibleRows = useMemo(() => {
    if (!todayOnly) return rows;
    return rows.filter((r) => isToday(r.created_at));
  }, [rows, todayOnly]);

  // Tab title reflects unseen new-order count so backgrounded tabs still surface the alert
  useEffect(() => {
    const base = "الطلبات · MenuLink";
    document.title = unseenCount > 0 ? `(${unseenCount}) 🔔 ${base}` : base;
  }, [unseenCount]);

  // Realtime subscription
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`orders:${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          const fresh = payload.new as OrderRow;
          const { data: cust } = await sb
            .from("customers")
            .select("name, phone")
            .eq("id", (fresh as any).customer_id)
            .single();
          setRows((r) => [{ ...fresh, customers: cust as any }, ...r].slice(0, 200));
          setUnseenCount((n) => n + 1);
          if (soundEnabled) alert.start();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const fresh = payload.new as OrderRow;
          let justArrived = false;
          setRows((r) => {
            const prev = r.find((o) => o.id === fresh.id);
            // REPLICA IDENTITY isn't FULL here, so payload.old doesn't include
            // prior values — diff against the current in-memory row instead.
            if (prev && !prev.car_arrived_at && fresh.car_arrived_at) {
              justArrived = true;
            }
            return r.map((o) => (o.id === fresh.id ? { ...o, ...fresh } : o));
          });
          if (justArrived) {
            setUnseenCount((n) => n + 1);
            if (soundEnabled) alert.start();
          }
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
    // soundEnabled in deps so the handler captures the current setting; alert is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, soundEnabled]);

  async function setStatus(id: string, status: string) {
    const sb = createClient();
    await sb.from("orders").update({ status }).eq("id", id);
    setRows((r) => r.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  function acknowledge() {
    alert.stop();
    setUnseenCount(0);
  }

  function enableSound() {
    alert.unlock();         // must run inside this click handler
    setSoundEnabled(true);
  }

  const today = todayRiyadhISO();
  const exportUrl = todayOnly
    ? `/api/admin/export/orders?from=${today}&to=${today}`
    : `/api/admin/export/orders`;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={todayOnly}
            onChange={(e) => setTodayOnly(e.target.checked)}
            className="w-4 h-4 accent-brand-primary"
          />
          <span className="text-sm font-semibold">طلبات اليوم فقط</span>
        </label>
        <span className="text-xs text-neutral-500">
          {visibleRows.length} من {rows.length}
        </span>

        <div className="flex-1" />

        {!soundEnabled ? (
          <button
            onClick={enableSound}
            className="px-3 h-9 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-sm font-semibold hover:bg-amber-100"
            title="فعّل الإشعار الصوتي ليرن عند وصول طلب جديد"
          >
            🔔 فعّل الصوت
          </button>
        ) : alert.playing ? (
          <button
            onClick={acknowledge}
            className="px-3 h-9 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 animate-pulse"
          >
            🛎️ إيقاف الجرس ({unseenCount} طلب جديد)
          </button>
        ) : (
          <span className="px-3 h-9 inline-flex items-center rounded-lg bg-green-50 text-green-800 border border-green-200 text-xs">
            🔔 الصوت مفعّل
          </span>
        )}

        {excelEnabled && (
          <a
            href={exportUrl}
            className="px-3 h-9 inline-flex items-center rounded-lg bg-[#1B4332] text-white text-sm font-semibold hover:opacity-90"
          >
            📊 تنزيل Excel
          </a>
        )}
      </div>

      {/* Live banner (when bell is ringing) */}
      {alert.playing && (
        <button
          onClick={acknowledge}
          className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold text-base shadow-lg hover:bg-rose-700 active:translate-y-px"
        >
          🚨 طلب جديد! اضغط لإيقاف الجرس
        </button>
      )}

      {/* Orders list */}
      {visibleRows.length === 0 ? (
        <p className="text-neutral-500 text-sm bg-white border border-neutral-200 rounded-xl p-6 text-center">
          {todayOnly ? "لا توجد طلبات اليوم بعد." : "لا توجد طلبات بعد."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleRows.map((o) => {
            const cust = getCustomer(o);
            const waitingAtCurb =
              o.order_type === "car" &&
              !!o.car_arrived_at &&
              o.status !== "delivered" &&
              o.status !== "cancelled";
            return (
              <li
                key={o.id}
                className={
                  "rounded-xl p-3 flex items-start justify-between gap-3 flex-wrap border " +
                  (waitingAtCurb
                    ? "bg-amber-50 border-amber-300 ring-2 ring-amber-300/50"
                    : "bg-white border-neutral-200")
                }
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold flex flex-wrap items-center gap-2">
                    <span>
                      {cust?.name ?? "—"}{" "}
                      <span className="text-neutral-400 font-normal">· {cust?.phone ?? "—"}</span>
                    </span>
                    {o.table_label && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 rounded-full px-2 py-0.5">
                        🪑 طاولة {o.table_label}
                      </span>
                    )}
                    {waitingAtCurb && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-amber-500 text-amber-950 rounded-full px-2 py-0.5">
                        🚗 وصل العميل
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {new Date(o.created_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} ·{" "}
                    {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}
                  </div>
                  {o.address && <div className="text-xs text-neutral-600 mt-1">📍 {o.address}</div>}
                  {o.order_type === "car" && (o.car_plate || o.car_color) && (
                    <div className="text-xs text-neutral-700 mt-1">
                      🚗 <span dir="ltr">{o.car_plate ?? "—"}</span>
                      {o.car_color && <span> · {o.car_color}</span>}
                    </div>
                  )}
                  {o.notes && <div className="text-xs text-amber-700 mt-1">📝 {o.notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-brand-primary">{o.total} ر.س</span>
                  <select
                    value={o.status}
                    onChange={(e) => setStatus(o.id, e.target.value)}
                    className="text-xs border border-neutral-300 rounded px-2 py-1 outline-none focus:border-brand-primary"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL_AR[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
