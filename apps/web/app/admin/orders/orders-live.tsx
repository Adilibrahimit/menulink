"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type CustomerInfo = { name: string | null; phone: string };
type OrderItem = {
  id: string;
  item_name: string;
  variant: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
};
type DriverOption = { id: string; name: string; branch_id: string | null };
type BranchOption = { id: string; name_ar: string };
type OrderRow = {
  id: string;
  customer_id: string;
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
  driver_id: string | null;
  branch_id: string | null;
  created_at: string;
  customers: CustomerInfo | CustomerInfo[] | null;
  order_items: OrderItem[] | null;
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

type CancelReason = { id: string; reason_ar: string; reason_en: string | null };

export default function OrdersLive({
  restaurantId,
  initial,
  restaurantSlug,
  excelEnabled,
  pushEnabled = false,
  drivers = [],
  branches = [],
}: {
  restaurantId: string;
  initial: OrderRow[];
  restaurantSlug: string;
  excelEnabled: boolean;
  pushEnabled?: boolean;
  drivers?: DriverOption[];
  branches?: BranchOption[];
}) {
  const [rows, setRows] = useState<OrderRow[]>(initial);
  const [todayOnly, setTodayOnly] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const alert = useAlertSound();

  // Cancel-with-reason modal state
  const hasMultipleBranches = branches.length > 1;
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const [cancelModal, setCancelModal] = useState<{ orderId: string } | null>(null);
  const [cancelReasons, setCancelReasons] = useState<CancelReason[]>([]);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [cancelling, setCancelling] = useState(false);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleRows = useMemo(() => {
    let filtered = rows;
    if (todayOnly) filtered = filtered.filter((r) => isToday(r.created_at));
    if (branchFilter !== "all") filtered = filtered.filter((r) => r.branch_id === branchFilter);
    return filtered;
  }, [rows, todayOnly, branchFilter]);

  function branchName(id: string | null): string | null {
    if (!id) return null;
    return branches.find((b) => b.id === id)?.name_ar ?? null;
  }

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
          const [{ data: cust }, { data: items }] = await Promise.all([
            sb.from("customers").select("name, phone").eq("id", (fresh as any).customer_id).single(),
            sb.from("order_items").select("id, item_name, variant, qty, unit_price, line_total").eq("order_id", fresh.id),
          ]);
          setRows((r) => [{ ...fresh, customers: cust as any, order_items: items as any }, ...r].slice(0, 200));
          setExpanded((prev) => new Set(prev).add(fresh.id));
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

  async function openCancelModal(orderId: string) {
    setCancelModal({ orderId });
    setSelectedReason("");
    setOtherText("");
    const sb = createClient();
    const { data } = await sb
      .from("order_reasons")
      .select("id, reason_ar, reason_en")
      .eq("restaurant_id", restaurantId)
      .eq("actor_type", "restaurant")
      .eq("is_active", true)
      .order("sort_order");
    setCancelReasons(data ?? []);
  }

  async function confirmCancel() {
    if (!cancelModal) return;
    setCancelling(true);
    const sb = createClient();
    const reasonId = selectedReason === "__other__" ? null : selectedReason || null;
    const reasonText = selectedReason === "__other__" ? otherText.trim() || null : null;

    await sb.from("orders").update({ status: "cancelled", cancellation_reason_id: reasonId }).eq("id", cancelModal.orderId);
    await sb.from("order_events").insert({
      order_id: cancelModal.orderId,
      event_type: "cancellation",
      old_status: rows.find((o) => o.id === cancelModal.orderId)?.status ?? null,
      new_status: "cancelled",
      actor_type: "restaurant",
      reason_id: reasonId,
      reason_text: reasonText,
    });

    setRows((r) => r.map((o) => (o.id === cancelModal.orderId ? { ...o, status: "cancelled" } : o)));
    setCancelling(false);
    setCancelModal(null);
  }

  async function setStatus(id: string, status: string) {
    if (status === "cancelled") {
      openCancelModal(id);
      return;
    }

    const sb = createClient();
    await sb.from("orders").update({ status }).eq("id", id);
    setRows((r) => r.map((o) => (o.id === id ? { ...o, status } : o)));

    if (status === "ready" && pushEnabled) {
      const order = rows.find((o) => o.id === id);
      if (order?.customer_id) {
        fetch("/api/admin/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurant_id: restaurantId,
            customer_id: order.customer_id,
            title: "طلبك جاهز! 🎉",
            body: "تعال استلم طلبك من المطعم",
            url: `/m/${restaurantSlug}`,
          }),
        }).catch(() => {});
      }
    }
  }

  async function assignDriver(orderId: string, driverId: string | null) {
    const sb = createClient();
    await sb.from("orders").update({
      driver_id: driverId,
      assigned_driver_at: driverId ? new Date().toISOString() : null,
    }).eq("id", orderId);
    setRows((r) => r.map((o) => (o.id === orderId ? { ...o, driver_id: driverId } : o)));

    if (driverId) {
      const order = rows.find((o) => o.id === orderId);
      await sb.from("order_driver_assignments").insert({
        order_id: orderId,
        restaurant_id: restaurantId,
        branch_id: null,
        driver_id: driverId,
        cash_expected: order ? parseFloat(order.total) : 0,
      }).then(() => {}, () => {});
    }
  }

  function driverName(driverId: string | null): string | null {
    if (!driverId) return null;
    return drivers.find((d) => d.id === driverId)?.name ?? null;
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

        {hasMultipleBranches && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 px-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-brand-primary"
          >
            <option value="all">كل الفروع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name_ar}</option>
            ))}
          </select>
        )}

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
                  "rounded-xl overflow-hidden border " +
                  (waitingAtCurb
                    ? "bg-amber-50 border-amber-300 ring-2 ring-amber-300/50"
                    : "bg-white border-neutral-200")
                }
              >
                <button
                  onClick={() => toggleExpand(o.id)}
                  className="w-full p-3 flex items-start justify-between gap-3 flex-wrap text-right"
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-neutral-400 font-mono">#{o.id.slice(0, 6)}</span>
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
                      {hasMultipleBranches && branchName(o.branch_id) && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                          🏢 {branchName(o.branch_id)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {new Date(o.created_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} ·{" "}
                      {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type} ·{" "}
                      <span className="text-neutral-400">{o.order_items?.length ?? 0} أصناف</span>
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
                    <span className="text-neutral-400 text-xs">{expanded.has(o.id) ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Status + driver — always visible */}
                <div className="px-3 pb-2 flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-400">الحالة:</span>
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
                  {drivers.length > 0 && (o.order_type === "delivery" || o.order_type === "car") && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-neutral-400">🛵</span>
                      <select
                        value={o.driver_id ?? ""}
                        onChange={(e) => assignDriver(o.id, e.target.value || null)}
                        className={
                          "text-xs border rounded px-2 py-1 outline-none focus:border-brand-primary " +
                          (o.driver_id
                            ? "border-blue-300 bg-blue-50 text-blue-800 font-semibold"
                            : "border-neutral-300")
                        }
                      >
                        <option value="">— بدون سائق</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Expanded: order items */}
                {expanded.has(o.id) && o.order_items && o.order_items.length > 0 && (
                  <div className="border-t border-neutral-100 px-3 py-2 bg-neutral-50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-neutral-400">
                          <th className="text-right pb-1 font-medium">الصنف</th>
                          <th className="text-center pb-1 font-medium w-12">الكمية</th>
                          <th className="text-left pb-1 font-medium w-16">السعر</th>
                          <th className="text-left pb-1 font-medium w-16">المجموع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.order_items.map((item) => (
                          <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                            <td className="py-1.5 text-right">
                              <span className="font-medium">{item.item_name}</span>
                              {item.variant && (
                                <span className="text-neutral-500 mr-1 text-[10px]">({item.variant})</span>
                              )}
                            </td>
                            <td className="py-1.5 text-center">{item.qty}</td>
                            <td className="py-1.5 text-left">{item.unit_price} ر.س</td>
                            <td className="py-1.5 text-left font-semibold">{item.line_total} ر.س</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Cancel-with-reason modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" dir="rtl">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-bold">سبب الإلغاء</h3>
              <p className="text-xs text-neutral-500 mt-0.5">اختر سبب إلغاء الطلب</p>
            </div>
            <div className="p-5 space-y-3">
              {cancelReasons.map((r) => (
                <label
                  key={r.id}
                  className={
                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors " +
                    (selectedReason === r.id
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-neutral-200 hover:border-neutral-300")
                  }
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={r.id}
                    checked={selectedReason === r.id}
                    onChange={() => setSelectedReason(r.id)}
                    className="accent-brand-primary"
                  />
                  <span className="text-sm">{r.reason_ar}</span>
                </label>
              ))}
              <label
                className={
                  "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors " +
                  (selectedReason === "__other__"
                    ? "border-brand-primary bg-brand-primary/5"
                    : "border-neutral-200 hover:border-neutral-300")
                }
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value="__other__"
                  checked={selectedReason === "__other__"}
                  onChange={() => setSelectedReason("__other__")}
                  className="accent-brand-primary"
                />
                <span className="text-sm">سبب آخر</span>
              </label>
              {selectedReason === "__other__" && (
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="اكتب السبب..."
                  className="w-full border border-neutral-300 rounded-xl p-3 text-sm resize-none h-20 outline-none focus:border-brand-primary"
                />
              )}
            </div>
            <div className="p-4 border-t border-neutral-100 flex gap-2">
              <button
                onClick={() => setCancelModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold hover:bg-neutral-50"
              >
                رجوع
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelling || (!selectedReason)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelling ? "جاري الإلغاء..." : "تأكيد الإلغاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
