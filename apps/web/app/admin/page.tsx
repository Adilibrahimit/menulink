import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import DashboardChart from "./dashboard-chart";

export default async function DashboardPage() {
  const me = await requireAdmin();
  const sb = createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

  const [{ count: ordersToday }, { count: ordersTotal }, { data: dailyRows }, { data: segments }, { data: recent }] =
    await Promise.all([
      sb.from("orders").select("*", { count: "exact", head: true })
        .eq("restaurant_id", me.restaurant_id)
        .gte("created_at", today.toISOString()),
      sb.from("orders").select("*", { count: "exact", head: true })
        .eq("restaurant_id", me.restaurant_id),
      sb.from("v_revenue_daily")
        .select("day, orders, revenue, unique_customers")
        .eq("restaurant_id", me.restaurant_id)
        .gte("day", fourteenDaysAgo.toISOString().slice(0, 10))
        .order("day", { ascending: true }),
      sb.from("v_customer_rfm").select("segment").eq("restaurant_id", me.restaurant_id),
      sb.from("orders")
        .select("id, order_type, total, created_at, customers(name, phone)")
        .eq("restaurant_id", me.restaurant_id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const segmentCounts = (segments ?? []).reduce<Record<string, number>>((acc, r: any) => {
    const key = r.segment ?? "Prospect";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const todayIso = today.toISOString().slice(0, 10);
  const revenueToday =
    (dailyRows ?? []).find((r: any) => r.day === todayIso)?.revenue ?? "0.00";

  // Build a dense 14-day series so the chart shows zero-days too
  const dense: { day: string; orders: number; revenue: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const row = (dailyRows ?? []).find((r: any) => r.day === iso);
    dense.push({
      day: iso,
      orders: row ? Number(row.orders) : 0,
      revenue: row ? Number(row.revenue) : 0,
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-neutral-900">اللوحة</h1>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="طلبات اليوم" value={String(ordersToday ?? 0)} />
        <StatCard label="إيراد اليوم" value={`${revenueToday} ر.س`} />
        <StatCard label="إجمالي الطلبات" value={String(ordersTotal ?? 0)} />
        <StatCard label="عملاء مميزون" value={String(segmentCounts["Champion"] ?? 0)} />
      </section>

      <DashboardChart data={dense} />

      <section className="bg-white rounded-xl border border-neutral-200 p-4">
        <h2 className="font-semibold mb-3">شرائح العملاء</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {["Champion", "Loyal", "At-Risk", "Lost", "New", "Prospect"].map((s) => (
            <span key={s} className="px-3 py-1 rounded-full bg-neutral-100">
              {s}: <b>{segmentCounts[s] ?? 0}</b>
            </span>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-neutral-200 p-4">
        <h2 className="font-semibold mb-3">آخر ٥ طلبات</h2>
        {(!recent || recent.length === 0) && (
          <p className="text-neutral-500 text-sm">لا توجد طلبات بعد.</p>
        )}
        <ul className="divide-y divide-neutral-100">
          {(recent ?? []).map((o: any) => (
            <li key={o.id} className="py-2 flex items-center justify-between text-sm">
              <span>
                <b>{o.customers?.name ?? "—"}</b>
                <span className="text-neutral-500"> · {o.customers?.phone ?? "—"}</span>
              </span>
              <span className="text-neutral-700">
                {o.total} ر.س · {labelForOrderType(o.order_type)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-bold text-neutral-900 mt-1">{value}</div>
    </div>
  );
}

function labelForOrderType(t: string) {
  return t === "delivery" ? "توصيل" : t === "pickup" ? "استلام" : t === "dine_in" ? "في المطعم" : t;
}
