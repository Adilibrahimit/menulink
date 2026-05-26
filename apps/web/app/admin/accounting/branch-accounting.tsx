"use client";

import { useMemo, useState } from "react";

type OrderRow = {
  id: string;
  order_type: string;
  status: string;
  total: string;
  branch_id: string | null;
  cancellation_reason_id: string | null;
  created_at: string;
};

type Props = {
  orders: OrderRow[];
  branches: { id: string; name_ar: string }[];
};

function toRiyadhDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

function last7(): string { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); }
function last30(): string { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }
function todayStr(): string { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }); }

type BranchStats = {
  name: string;
  orders: number;
  revenue: number;
  delivered: number;
  cancelled: number;
  cancelRate: number;
  avgOrder: number;
  byType: Record<string, number>;
};

export default function BranchAccounting({ orders, branches }: Props) {
  const [dateFrom, setDateFrom] = useState(last30());
  const [dateTo, setDateTo] = useState(todayStr());

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const d = toRiyadhDate(o.created_at);
      return d >= dateFrom && d <= dateTo;
    });
  }, [orders, dateFrom, dateTo]);

  const { branchStats, consolidated } = useMemo(() => {
    const map: Record<string, BranchStats> = {};

    for (const b of branches) {
      map[b.id] = { name: b.name_ar, orders: 0, revenue: 0, delivered: 0, cancelled: 0, cancelRate: 0, avgOrder: 0, byType: {} };
    }
    map["__unassigned"] = { name: "غير محدد", orders: 0, revenue: 0, delivered: 0, cancelled: 0, cancelRate: 0, avgOrder: 0, byType: {} };

    let totalOrders = 0, totalRevenue = 0, totalDelivered = 0, totalCancelled = 0;

    for (const o of filtered) {
      const key = o.branch_id && map[o.branch_id] ? o.branch_id : "__unassigned";
      const rev = parseFloat(o.total);
      map[key].orders++;
      map[key].revenue += rev;
      if (o.status === "delivered") map[key].delivered++;
      if (o.status === "cancelled") map[key].cancelled++;
      map[key].byType[o.order_type] = (map[key].byType[o.order_type] ?? 0) + 1;

      totalOrders++;
      totalRevenue += rev;
      if (o.status === "delivered") totalDelivered++;
      if (o.status === "cancelled") totalCancelled++;
    }

    for (const s of Object.values(map)) {
      s.cancelRate = s.orders > 0 ? (s.cancelled / s.orders) * 100 : 0;
      s.avgOrder = s.orders > 0 ? s.revenue / s.orders : 0;
    }

    const branchStats = Object.entries(map)
      .filter(([, s]) => s.orders > 0)
      .sort(([, a], [, b]) => b.revenue - a.revenue);

    const consolidated = {
      orders: totalOrders,
      revenue: totalRevenue,
      delivered: totalDelivered,
      cancelled: totalCancelled,
      cancelRate: totalOrders > 0 ? (totalCancelled / totalOrders) * 100 : 0,
      avgOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    };

    return { branchStats, consolidated };
  }, [filtered, branches]);

  const maxRevenue = Math.max(...branchStats.map(([, s]) => s.revenue), 1);

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">من</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-brand-primary" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">إلى</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-brand-primary" />
        </div>
        <div className="flex gap-1">
          <button onClick={() => { setDateFrom(todayStr()); setDateTo(todayStr()); }}
            className="h-9 px-3 rounded-lg bg-neutral-100 text-xs font-semibold hover:bg-neutral-200">اليوم</button>
          <button onClick={() => { setDateFrom(last7()); setDateTo(todayStr()); }}
            className="h-9 px-3 rounded-lg bg-neutral-100 text-xs font-semibold hover:bg-neutral-200">٧ أيام</button>
          <button onClick={() => { setDateFrom(last30()); setDateTo(todayStr()); }}
            className="h-9 px-3 rounded-lg bg-neutral-100 text-xs font-semibold hover:bg-neutral-200">٣٠ يوم</button>
        </div>
      </div>

      {/* Consolidated KPIs */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <h3 className="text-sm font-bold mb-3">📊 الإجمالي المجمّع</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="إجمالي الطلبات" value={String(consolidated.orders)} color="blue" />
          <KpiCard label="الإيرادات" value={`${consolidated.revenue.toFixed(0)} ر.س`} color="green" />
          <KpiCard label="متوسط الطلب" value={`${consolidated.avgOrder.toFixed(1)} ر.س`} color="purple" />
          <KpiCard label="تم التسليم" value={String(consolidated.delivered)} color="emerald" />
          <KpiCard label="ملغي" value={String(consolidated.cancelled)} color="rose" />
          <KpiCard label="نسبة الإلغاء" value={`${consolidated.cancelRate.toFixed(1)}%`} color="amber" />
        </div>
      </div>

      {/* Branch comparison */}
      {branchStats.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold">🏢 مقارنة الفروع</h3>
          {branchStats.map(([id, s]) => {
            const revPct = (s.revenue / maxRevenue) * 100;
            const orderPct = consolidated.orders > 0 ? (s.orders / consolidated.orders) * 100 : 0;
            return (
              <div key={id} className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏢</span>
                    <span className="font-bold">{s.name}</span>
                    <span className="text-[10px] bg-neutral-100 text-neutral-500 rounded-full px-2 py-0.5">
                      {orderPct.toFixed(0)}% من الطلبات
                    </span>
                  </div>
                  <span className="text-lg font-bold text-green-700">{s.revenue.toFixed(0)} ر.س</span>
                </div>

                {/* Revenue bar */}
                <div className="h-3 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500/70" style={{ width: `${revPct}%` }} />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <MiniStat label="الطلبات" value={String(s.orders)} />
                  <MiniStat label="متوسط الطلب" value={`${s.avgOrder.toFixed(1)} ر.س`} />
                  <MiniStat label="تم التسليم" value={String(s.delivered)} />
                  <MiniStat label="نسبة الإلغاء" value={`${s.cancelRate.toFixed(1)}%`} warn={s.cancelRate > 10} />
                </div>

                {/* Order type breakdown */}
                {Object.keys(s.byType).length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(s.byType).map(([type, count]) => (
                      <span key={type} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                        {TYPE_LABEL[type] ?? type}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">💰</div>
          <p className="text-sm text-neutral-600">لا توجد طلبات في هذه الفترة.</p>
        </div>
      )}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  delivery: "توصيل",
  pickup: "استلام",
  dine_in: "في المطعم",
  car: "سيارة",
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
};

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl px-3 py-3 text-center`}>
      <div className={`text-xl font-bold ${c.text}`}>{value}</div>
      <div className="text-[10px] text-neutral-500 font-semibold mt-0.5">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-neutral-50 rounded-lg px-3 py-2 text-center">
      <div className={`text-sm font-bold ${warn ? "text-rose-600" : "text-neutral-800"}`}>{value}</div>
      <div className="text-[10px] text-neutral-400">{label}</div>
    </div>
  );
}
