import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

const SEGMENT_STYLE: Record<string, string> = {
  Champion: "bg-amber-100 text-amber-800",
  Loyal:    "bg-green-100 text-green-800",
  "At-Risk":"bg-orange-100 text-orange-800",
  Lost:     "bg-red-100 text-red-700",
  New:      "bg-blue-100 text-blue-800",
  Prospect: "bg-neutral-100 text-neutral-600",
};

export default async function CustomersPage() {
  const me = await requireOwner();
  const sb = createClient();

  const [{ data: rfm }, { data: ltv }] = await Promise.all([
    sb.from("v_customer_rfm").select("*").eq("restaurant_id", me.restaurant_id).order("monetary", { ascending: false }),
    sb.from("v_customer_ltv").select("customer_id, lifetime_value, avg_order_value, first_order_at").eq("restaurant_id", me.restaurant_id),
  ]);

  const ltvByCustomer = new Map((ltv ?? []).map((r: any) => [r.customer_id, r]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">العملاء</h1>
      <p className="text-sm text-neutral-500">
        كل عميل مع شريحة RFM وقيمته المالية مدى الحياة. اضغط الجوال للاتصال أو واتساب.
      </p>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <Th>العميل</Th>
              <Th>الجوال</Th>
              <Th>شريحة</Th>
              <Th>طلبات</Th>
              <Th>إجمالي</Th>
              <Th>متوسط</Th>
              <Th>آخر طلب</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(rfm ?? []).map((r: any) => {
              const l = ltvByCustomer.get(r.customer_id) as any;
              return (
                <tr key={r.customer_id} className="hover:bg-neutral-50">
                  <Td>{r.name ?? "—"}</Td>
                  <Td>
                    <a className="text-brand-primary hover:underline" href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                      {r.phone}
                    </a>
                  </Td>
                  <Td>
                    {r.segment && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SEGMENT_STYLE[r.segment] ?? "bg-neutral-100"}`}>
                        {r.segment}
                      </span>
                    )}
                  </Td>
                  <Td>{r.frequency}</Td>
                  <Td>{r.monetary} ر.س</Td>
                  <Td>{l?.avg_order_value ?? "—"} ر.س</Td>
                  <Td>{r.recency_days != null ? `قبل ${r.recency_days} يوم` : "—"}</Td>
                </tr>
              );
            })}
            {(!rfm || rfm.length === 0) && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-neutral-500">
                  لا يوجد عملاء بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-right px-3 py-2 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
