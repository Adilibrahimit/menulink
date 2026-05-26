"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { toArabicDigits } from "@/lib/arabic";
import SarSymbol from "../sar-symbol";
import OrderStatusTracker from "./order-status-tracker";

type OrderItem = {
  item_name: string;
  variant: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
};

type OrderEvent = {
  new_status: string;
  created_at: string;
};

type Order = {
  id: string;
  order_type: string;
  status: string;
  total: number;
  notes: string | null;
  created_at: string;
  items: OrderItem[];
  events: OrderEvent[];
};

const STATUS_AR: Record<string, { label: string; color: string }> = {
  submitted:  { label: "جديد",       color: "bg-blue-100 text-blue-800" },
  confirmed:  { label: "مؤكد",       color: "bg-sky-100 text-sky-800" },
  preparing:  { label: "قيد التجهيز", color: "bg-amber-100 text-amber-800" },
  ready:      { label: "جاهز",       color: "bg-green-100 text-green-800" },
  delivered:  { label: "تم التسليم",  color: "bg-neutral-100 text-neutral-700" },
  cancelled:  { label: "ملغي",       color: "bg-red-100 text-red-800" },
};

const ORDER_TYPE_AR: Record<string, string> = {
  delivery: "توصيل",
  pickup:   "استلام",
  dine_in:  "تناول في المطعم",
  car:      "سيارة",
};

const ACTIVE_STATUSES = new Set(["submitted", "confirmed", "preparing", "ready"]);

const toAr = toArabicDigits;

export default function OrdersClient({
  slug,
  signedIn,
  linked,
  orders: initialOrders,
  customerId,
  restaurantId,
}: {
  slug: string;
  signedIn: boolean;
  linked: boolean;
  orders: Order[];
  customerId: string | null;
  restaurantId: string;
}) {
  const [tab, setTab] = useState<"current" | "previous">("current");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  useEffect(() => {
    if (!customerId) return;
    const sb = createClient();
    const channel = sb
      .channel(`customer-orders:${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${customerId}`,
        },
        async (payload) => {
          const updated = payload.new as { id: string; status: string };
          const { data: freshEvents } = await sb
            .from("order_events")
            .select("new_status, created_at")
            .eq("order_id", updated.id)
            .order("created_at");
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updated.id
                ? {
                    ...o,
                    status: updated.status,
                    events: (freshEvents ?? []).map((e) => ({
                      new_status: e.new_status as string,
                      created_at: e.created_at as string,
                    })),
                  }
                : o
            )
          );
        }
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [customerId]);

  if (!signedIn) {
    return (
      <div className="p-4">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl">🛒</div>
          <p className="text-sm text-neutral-600" style={{ fontFamily: "var(--font-display)" }}>
            ادخل بحساب Google لرؤية طلباتك السابقة
          </p>
          <a
            href={`/m/${slug}/account`}
            className="inline-block h-10 px-5 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-bold leading-10 hover:bg-neutral-200"
            style={{ fontFamily: "var(--font-display)" }}
          >
            تسجيل دخول
          </a>
        </div>
      </div>
    );
  }

  if (!linked) {
    return (
      <div className="p-4">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl">📱</div>
          <p className="text-sm text-neutral-600" style={{ fontFamily: "var(--font-display)" }}>
            اربط رقم جوالك بحسابك لرؤية طلباتك
          </p>
          <a
            href={`/m/${slug}/account`}
            className="inline-block h-10 px-5 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-bold leading-10 hover:bg-neutral-200"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ربط الحساب
          </a>
        </div>
      </div>
    );
  }

  const currentOrders = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
  const previousOrders = orders.filter((o) => !ACTIVE_STATUSES.has(o.status));
  const shown = tab === "current" ? currentOrders : previousOrders;

  return (
    <div className="p-4 space-y-4">
      {/* Tabs */}
      <div className="flex bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <TabButton
          active={tab === "current"}
          label="الطلبات الحالية"
          count={currentOrders.length}
          onClick={() => setTab("current")}
        />
        <TabButton
          active={tab === "previous"}
          label="الطلبات السابقة"
          count={previousOrders.length}
          onClick={() => setTab("previous")}
        />
      </div>

      {/* Orders list */}
      {shown.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-2">{tab === "current" ? "✨" : "📦"}</div>
          <p className="text-sm text-neutral-500" style={{ fontFamily: "var(--font-display)" }}>
            {tab === "current" ? "لا توجد طلبات نشطة حالياً" : "لا توجد طلبات سابقة"}
          </p>
          {tab === "current" && (
            <a
              href={`/m/${slug}`}
              className="inline-block mt-3 h-10 px-5 rounded-xl bg-[var(--brand)] text-white text-sm font-bold leading-10"
              style={{ fontFamily: "var(--font-display)" }}
            >
              تصفح القائمة
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${
        active
          ? "bg-[var(--brand)] text-white"
          : "bg-white text-neutral-500 hover:bg-neutral-50"
      }`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {label}
      {count > 0 && (
        <span className={`mr-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
          active ? "bg-white/25 text-white" : "bg-neutral-200 text-neutral-600"
        }`}>
          {toAr(String(count))}
        </span>
      )}
    </button>
  );
}

function OrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const st = STATUS_AR[order.status] ?? { label: order.status, color: "bg-neutral-100 text-neutral-700" };
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh", day: "numeric", month: "short" });
  const timeStr = date.toLocaleTimeString("ar-SA", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-right"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>
              {st.label}
            </span>
            <span className="text-[11px] text-neutral-400">
              {ORDER_TYPE_AR[order.order_type] ?? order.order_type}
            </span>
            <span className="text-[10px] font-mono text-neutral-300" dir="ltr">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="text-xs text-neutral-500">
            {dateStr} · {timeStr}
          </div>
        </div>
        <div className="text-left shrink-0">
          <div className="font-extrabold text-neutral-900 flex items-center gap-0.5" style={{ fontFamily: "var(--font-display)" }}>
            {toAr(order.total.toFixed(2))} <SarSymbol size={14} />
          </div>
          <div className="text-[10px] text-neutral-400">
            {toAr(String(order.items.length))} أصناف
          </div>
        </div>
        <span className={`text-neutral-400 transition-transform ${expanded ? "rotate-90" : ""}`}>‹</span>
      </button>

      {expanded && (
        <div className="border-t border-neutral-100 px-4 py-3 space-y-2">
          {ACTIVE_STATUSES.has(order.status) && (
            <OrderStatusTracker status={order.status} events={order.events} />
          )}
          {order.status === "cancelled" && (
            <OrderStatusTracker status={order.status} events={order.events} />
          )}
          {order.items.map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-neutral-800" style={{ fontFamily: "var(--font-display)" }}>
                  {item.item_name}
                </div>
                {item.variant && (
                  <div className="text-[11px] text-neutral-500">{item.variant}</div>
                )}
              </div>
              <div className="text-left shrink-0 text-sm text-neutral-600">
                <span className="text-neutral-400">×{toAr(String(item.qty))}</span>
                {" "}
                <span className="inline-flex items-center gap-0.5">{toAr(item.line_total.toFixed(2))} <SarSymbol size={12} /></span>
              </div>
            </div>
          ))}
          {order.notes && (
            <div className="text-[11px] text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2 mt-1">
              💬 {order.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
