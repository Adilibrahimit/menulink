import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import CustomersTable from "./customers-table";

const SEGMENT_KPI: {
  key: string;
  label: string;
  hint: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    key: "Champion",
    label: "⭐ Champions",
    hint: "الأعلى ولاءً — حافظ عليهم",
    color: "text-amber-900",
    bg: "bg-amber-50",
    border: "border-amber-300",
  },
  {
    key: "Loyal",
    label: "💚 Loyal",
    hint: "عملاء دائمون",
    color: "text-green-900",
    bg: "bg-green-50",
    border: "border-green-300",
  },
  {
    key: "New",
    label: "🆕 New",
    hint: "أول طلب لهم",
    color: "text-sky-900",
    bg: "bg-sky-50",
    border: "border-sky-300",
  },
  {
    key: "At-Risk",
    label: "⚠ At-Risk",
    hint: "غابوا ٣١-٦٠ يوم — أرسل عرض",
    color: "text-orange-900",
    bg: "bg-orange-50",
    border: "border-orange-300",
  },
  {
    key: "Lost",
    label: "🚨 Lost",
    hint: "أكثر من ٦٠ يوم — حملة استرجاع",
    color: "text-rose-900",
    bg: "bg-rose-50",
    border: "border-rose-300",
  },
];

export default async function CustomersPage() {
  const me = await requireOwner();
  const sb = createClient();

  const [{ data: rfm }, { data: ltv }] = await Promise.all([
    sb.from("v_customer_rfm").select("*").eq("restaurant_id", me.restaurant_id),
    sb.from("v_customer_ltv").select("customer_id, lifetime_value, avg_order_value, orders_count, first_order_at, last_order_at").eq("restaurant_id", me.restaurant_id),
  ]);

  const ltvByCust = new Map((ltv ?? []).map((r: any) => [r.customer_id, r]));
  const rows = (rfm ?? []).map((r: any) => {
    const l = ltvByCust.get(r.customer_id) as any;
    return {
      customer_id: r.customer_id as string,
      name: r.name as string | null,
      phone: r.phone as string,
      segment: r.segment as string | null,
      frequency: Number(r.frequency ?? 0),
      monetary: Number(r.monetary ?? 0),
      recency_days: r.recency_days as number | null,
      avg_order_value: l?.avg_order_value != null ? Number(l.avg_order_value) : null,
      lifetime_value: Number(l?.lifetime_value ?? r.monetary ?? 0),
      first_order_at: l?.first_order_at ?? null,
      last_order_at: r.last_order_at ?? null,
    };
  });

  // KPI counts
  const totalCustomers = rows.length;
  const totalRevenue = rows.reduce((s, r) => s + r.monetary, 0);
  const avgPerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const segCount: Record<string, number> = {};
  rows.forEach((r) => {
    const k = r.segment ?? "Prospect";
    segCount[k] = (segCount[k] ?? 0) + 1;
  });

  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">العملاء</h1>
      <p className="text-sm text-neutral-500">
        تحليل RFM (Recency · Frequency · Monetary) لكل عميل. اضغط الجوال للاتصال أو واتساب.
      </p>

      {/* Top-line KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard
          label="إجمالي العملاء"
          value={fmt(totalCustomers)}
          tone="bg-[#1B4332] text-white"
        />
        <KpiCard
          label="إجمالي الإيرادات"
          value={`${fmt(totalRevenue)} ر.س`}
          tone="bg-[#1B4332] text-white"
        />
        <KpiCard
          label="متوسط القيمة لكل عميل"
          value={`${fmt(avgPerCustomer)} ر.س`}
          tone="bg-[#1B4332] text-white"
        />
      </div>

      {/* Segment KPI cards with color coding */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {SEGMENT_KPI.map((s) => (
          <div
            key={s.key}
            className={`rounded-xl border-2 px-3 py-3 ${s.bg} ${s.border}`}
          >
            <div className={`text-2xl font-extrabold ${s.color}`}>
              {fmt(segCount[s.key] ?? 0)}
            </div>
            <div className={`text-sm font-semibold ${s.color}`}>{s.label}</div>
            <div className={`text-[11px] mt-0.5 ${s.color} opacity-75`}>{s.hint}</div>
          </div>
        ))}
      </div>

      <CustomersTable rows={rows} />
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-xl shadow-sm px-4 py-3 ${tone}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}
