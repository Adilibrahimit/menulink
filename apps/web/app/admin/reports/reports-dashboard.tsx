"use client";

import { useMemo, useState } from "react";

type OrderItem = { id: string; item_name: string; qty: number; unit_price: number; line_total: number };
type CustomerInfo = { name: string | null; phone: string };
type OrderRow = {
  id: string;
  order_type: string;
  status: string;
  total: string;
  branch_id: string | null;
  driver_id: string | null;
  cancellation_reason_id: string | null;
  business_date: string | null;
  daily_order_number: number | null;
  created_at: string;
  customers: CustomerInfo | CustomerInfo[] | null;
  order_items: OrderItem[] | null;
};
type BranchOption = { id: string; name_ar: string };
type DriverOption = { id: string; name: string };

type Props = {
  orders: OrderRow[];
  branches: BranchOption[];
  drivers: DriverOption[];
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  delivery: "توصيل",
  pickup: "استلام",
  dine_in: "في المطعم",
  car: "سيارة",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "جديد",
  confirmed: "مؤكد",
  preparing: "تجهيز",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

function toRiyadhDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

function last7Days(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function last30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

export default function ReportsDashboard({ orders, branches, drivers }: Props) {
  const [dateFrom, setDateFrom] = useState(last7Days());
  const [dateTo, setDateTo] = useState(todayStr());
  const [branchFilter, setBranchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const d = toRiyadhDate(o.created_at);
      if (d < dateFrom || d > dateTo) return false;
      if (branchFilter !== "all" && o.branch_id !== branchFilter) return false;
      if (typeFilter !== "all" && o.order_type !== typeFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo, branchFilter, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const revenue = filtered.reduce((s, o) => s + parseFloat(o.total), 0);
    const avgOrder = total > 0 ? revenue / total : 0;
    const cancelled = filtered.filter((o) => o.status === "cancelled").length;
    const delivered = filtered.filter((o) => o.status === "delivered").length;
    const cancelRate = total > 0 ? (cancelled / total) * 100 : 0;

    const byType: Record<string, { count: number; revenue: number }> = {};
    const byStatus: Record<string, number> = {};
    const byBranch: Record<string, { count: number; revenue: number }> = {};
    const byDriver: Record<string, { count: number; revenue: number }> = {};
    const byDate: Record<string, { count: number; revenue: number }> = {};
    const topItems: Record<string, { name: string; qty: number; revenue: number }> = {};

    for (const o of filtered) {
      const t = o.order_type;
      byType[t] = byType[t] ?? { count: 0, revenue: 0 };
      byType[t].count++;
      byType[t].revenue += parseFloat(o.total);

      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

      const bName = branches.find((b) => b.id === o.branch_id)?.name_ar ?? "غير محدد";
      byBranch[bName] = byBranch[bName] ?? { count: 0, revenue: 0 };
      byBranch[bName].count++;
      byBranch[bName].revenue += parseFloat(o.total);

      if (o.driver_id) {
        const dName = drivers.find((d) => d.id === o.driver_id)?.name ?? "غير محدد";
        byDriver[dName] = byDriver[dName] ?? { count: 0, revenue: 0 };
        byDriver[dName].count++;
        byDriver[dName].revenue += parseFloat(o.total);
      }

      const d = toRiyadhDate(o.created_at);
      byDate[d] = byDate[d] ?? { count: 0, revenue: 0 };
      byDate[d].count++;
      byDate[d].revenue += parseFloat(o.total);

      for (const item of o.order_items ?? []) {
        topItems[item.item_name] = topItems[item.item_name] ?? { name: item.item_name, qty: 0, revenue: 0 };
        topItems[item.item_name].qty += item.qty;
        topItems[item.item_name].revenue += item.line_total;
      }
    }

    const topItemsList = Object.values(topItems).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const dailyData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));

    return { total, revenue, avgOrder, cancelled, delivered, cancelRate, byType, byStatus, byBranch, byDriver, topItemsList, dailyData };
  }, [filtered, branches, drivers]);

  return (
    <div className="space-y-4">
      {/* Filters */}
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
        {branches.length > 1 && (
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 mb-1">الفرع</label>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              className="h-9 px-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-brand-primary">
              <option value="all">كل الفروع</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">نوع الطلب</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 px-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-brand-primary">
            <option value="all">الكل</option>
            {Object.entries(ORDER_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">الحالة</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-brand-primary">
            <option value="all">الكل</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <button onClick={() => { setDateFrom(todayStr()); setDateTo(todayStr()); }}
            className="h-9 px-3 rounded-lg bg-neutral-100 text-xs font-semibold hover:bg-neutral-200">اليوم</button>
          <button onClick={() => { setDateFrom(last7Days()); setDateTo(todayStr()); }}
            className="h-9 px-3 rounded-lg bg-neutral-100 text-xs font-semibold hover:bg-neutral-200">٧ أيام</button>
          <button onClick={() => { setDateFrom(last30Days()); setDateTo(todayStr()); }}
            className="h-9 px-3 rounded-lg bg-neutral-100 text-xs font-semibold hover:bg-neutral-200">٣٠ يوم</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="إجمالي الطلبات" value={String(stats.total)} color="blue" />
        <KpiCard label="الإيرادات" value={`${stats.revenue.toFixed(0)} ر.س`} color="green" />
        <KpiCard label="متوسط الطلب" value={`${stats.avgOrder.toFixed(1)} ر.س`} color="purple" />
        <KpiCard label="تم التسليم" value={String(stats.delivered)} color="emerald" />
        <KpiCard label="ملغي" value={String(stats.cancelled)} color="rose" />
        <KpiCard label="نسبة الإلغاء" value={`${stats.cancelRate.toFixed(1)}%`} color="amber" />
      </div>

      {/* Breakdown Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Order Type */}
        <BreakdownCard title="حسب نوع الطلب" icon="📦">
          {Object.entries(stats.byType).map(([type, data]) => (
            <BreakdownRow key={type} label={ORDER_TYPE_LABEL[type] ?? type} count={data.count} revenue={data.revenue} total={stats.total} />
          ))}
        </BreakdownCard>

        {/* By Status */}
        <BreakdownCard title="حسب الحالة" icon="📋">
          {Object.entries(stats.byStatus).map(([status, count]) => (
            <BreakdownRow key={status} label={STATUS_LABEL[status] ?? status} count={count} total={stats.total} />
          ))}
        </BreakdownCard>

        {/* By Branch */}
        {Object.keys(stats.byBranch).length > 1 && (
          <BreakdownCard title="حسب الفرع" icon="🏢">
            {Object.entries(stats.byBranch).map(([name, data]) => (
              <BreakdownRow key={name} label={name} count={data.count} revenue={data.revenue} total={stats.total} />
            ))}
          </BreakdownCard>
        )}

        {/* By Driver */}
        {Object.keys(stats.byDriver).length > 0 && (
          <BreakdownCard title="حسب السائق" icon="🛵">
            {Object.entries(stats.byDriver).map(([name, data]) => (
              <BreakdownRow key={name} label={name} count={data.count} revenue={data.revenue} total={stats.total} />
            ))}
          </BreakdownCard>
        )}
      </div>

      {/* Daily Trend */}
      {stats.dailyData.length > 1 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">📈 الترند اليومي</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-100">
                  <th className="text-right py-2 font-medium">التاريخ</th>
                  <th className="text-center py-2 font-medium w-20">الطلبات</th>
                  <th className="text-left py-2 font-medium w-24">الإيرادات</th>
                  <th className="text-left py-2 font-medium">التوزيع</th>
                </tr>
              </thead>
              <tbody>
                {stats.dailyData.map(([date, data]) => {
                  const maxRev = Math.max(...stats.dailyData.map(([, d]) => d.revenue));
                  const pct = maxRev > 0 ? (data.revenue / maxRev) * 100 : 0;
                  return (
                    <tr key={date} className="border-b border-neutral-50 last:border-0">
                      <td className="py-2 text-right font-mono text-neutral-600" dir="ltr">{date}</td>
                      <td className="py-2 text-center font-semibold">{data.count}</td>
                      <td className="py-2 text-left font-semibold">{data.revenue.toFixed(0)} ر.س</td>
                      <td className="py-2">
                        <div className="h-4 rounded-full bg-neutral-100 overflow-hidden">
                          <div className="h-full rounded-full bg-brand-primary/70" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Items */}
      {stats.topItemsList.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">🏆 الأصناف الأكثر طلباً</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-100">
                  <th className="text-right py-2 font-medium">#</th>
                  <th className="text-right py-2 font-medium">الصنف</th>
                  <th className="text-center py-2 font-medium w-16">الكمية</th>
                  <th className="text-left py-2 font-medium w-24">الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {stats.topItemsList.map((item, i) => (
                  <tr key={item.name} className="border-b border-neutral-50 last:border-0">
                    <td className="py-2 text-right text-neutral-400">{i + 1}</td>
                    <td className="py-2 text-right font-medium">{item.name}</td>
                    <td className="py-2 text-center">{item.qty}</td>
                    <td className="py-2 text-left font-semibold">{item.revenue.toFixed(0)} ر.س</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm text-neutral-600">لا توجد طلبات بهذه الفلاتر.</p>
        </div>
      )}
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700" },
  green:   { bg: "bg-green-50",   border: "border-green-200",   text: "text-green-700" },
  purple:  { bg: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-700" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700" },
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

function BreakdownCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <h3 className="text-sm font-bold mb-3">{icon} {title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BreakdownRow({ label, count, revenue, total }: { label: string; count: number; revenue?: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-neutral-700 w-24 truncate">{label}</span>
      <div className="flex-1 h-5 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full rounded-full bg-brand-primary/60" style={{ width: `${pct}%`, minWidth: pct > 0 ? "4px" : "0" }} />
      </div>
      <span className="text-xs font-semibold text-neutral-800 w-8 text-left">{count}</span>
      {revenue !== undefined && (
        <span className="text-[10px] text-neutral-500 w-16 text-left">{revenue.toFixed(0)} ر.س</span>
      )}
    </div>
  );
}
