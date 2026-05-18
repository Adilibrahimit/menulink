import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import NewPaymentForm from "./new-payment-form";

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  mada: "مدى",
  cash: "نقدي",
  card: "بطاقة",
  manual: "يدوي",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { tenant?: string };
}) {
  await requireOps();
  const sb = createClient();

  const [{ data: tenants }, { data: payments }] = await Promise.all([
    sb.from("restaurants")
      .select("id, name, slug, subscriptions(id, plan, amount_sar, status)")
      .order("name"),
    sb.from("payments")
      .select("id, amount_sar, method, paid_at, reference, notes, subscription_id, subscriptions(restaurants(name, slug))")
      .order("paid_at", { ascending: false })
      .limit(30),
  ]);

  const tenantOptions = (tenants ?? []).map((t: any) => ({
    restaurant_id: t.id,
    name: t.name,
    slug: t.slug,
    subscription_id: Array.isArray(t.subscriptions) ? t.subscriptions[0]?.id : t.subscriptions?.id,
    amount_sar: Array.isArray(t.subscriptions) ? t.subscriptions[0]?.amount_sar : t.subscriptions?.amount_sar,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">المدفوعات</h1>
      <p className="text-sm text-neutral-400">
        كل دفعة تُسجَّل هنا تُحدّث تلقائياً حالة اشتراك المطعم إلى "نشط" وتُمدد فترة الاشتراك سنة (أو شهر).
      </p>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <h2 className="font-semibold mb-3">تسجيل دفعة جديدة</h2>
        <NewPaymentForm tenants={tenantOptions} defaultTenantId={searchParams.tenant} />
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <h2 className="font-semibold px-4 py-3 border-b border-neutral-800">آخر ٣٠ دفعة</h2>
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/70 text-neutral-400 border-b border-neutral-800">
            <tr>
              <Th>المطعم</Th>
              <Th>المبلغ</Th>
              <Th>الطريقة</Th>
              <Th>مرجع</Th>
              <Th>التاريخ</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(payments ?? []).map((p: any) => {
              const sub = Array.isArray(p.subscriptions) ? p.subscriptions[0] : p.subscriptions;
              const rest = sub?.restaurants;
              const tenantName = Array.isArray(rest) ? rest[0]?.name : rest?.name;
              return (
                <tr key={p.id} className="hover:bg-neutral-900/50">
                  <Td>{tenantName ?? "—"}</Td>
                  <Td className="font-semibold">{p.amount_sar} ر.س</Td>
                  <Td>{METHOD_LABEL[p.method] ?? p.method}</Td>
                  <Td className="text-xs text-neutral-400">{p.reference ?? "—"}</Td>
                  <Td className="text-xs text-neutral-400">{new Date(p.paid_at).toLocaleDateString("ar-SA")}</Td>
                </tr>
              );
            })}
            {(!payments || payments.length === 0) && (
              <tr><td colSpan={5} className="py-6 text-center text-neutral-500">لا توجد دفعات بعد.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-right px-3 py-2 font-medium text-xs">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
