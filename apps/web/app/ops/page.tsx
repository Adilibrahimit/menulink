import Link from "next/link";
import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "بانتظار الدفع",
  active: "نشط",
  overdue: "متأخر",
  cancelled: "ملغي",
};
const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-amber-900/40 text-amber-300 border-amber-800",
  active: "bg-green-900/40 text-green-300 border-green-800",
  overdue: "bg-red-900/40 text-red-300 border-red-800",
  cancelled: "bg-neutral-800 text-neutral-400 border-neutral-700",
};

export default async function OpsHome() {
  await requireOps();
  const sb = createClient();

  const { data: tenants, error } = await sb
    .from("restaurants")
    .select(
      "id, slug, name, whatsapp_phone, is_active, is_published, created_at, subscriptions(plan, status, amount_sar, current_period_end, last_payment_at)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="rounded-md bg-red-900/40 border border-red-800 text-red-300 text-sm p-3">
        {error.message}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">المطاعم</h1>
        <Link
          href="/ops/tenants/new"
          className="rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-semibold hover:bg-white"
        >
          + إضافة مطعم
        </Link>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/70 text-neutral-400 border-b border-neutral-800">
            <tr>
              <Th>المطعم</Th>
              <Th>الـ slug</Th>
              <Th>الاشتراك</Th>
              <Th>المبلغ</Th>
              <Th>ينتهي في</Th>
              <Th>الحالة</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(tenants ?? []).map((t: any) => {
              const sub = Array.isArray(t.subscriptions) ? t.subscriptions[0] : t.subscriptions;
              const status = sub?.status ?? "—";
              return (
                <tr key={t.id} className="hover:bg-neutral-900/50">
                  <Td>
                    <div className="font-medium text-neutral-100">{t.name}</div>
                    <div className="text-xs text-neutral-500">{t.whatsapp_phone}</div>
                  </Td>
                  <Td className="text-neutral-400 font-mono text-xs">{t.slug}</Td>
                  <Td>{sub?.plan ? (sub.plan === "yearly" ? "سنوي" : "شهري") : "—"}</Td>
                  <Td>{sub?.amount_sar ? `${sub.amount_sar} ر.س` : "—"}</Td>
                  <Td className="text-neutral-400 text-xs">
                    {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("ar-SA") : "—"}
                  </Td>
                  <Td>
                    {status !== "—" && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] ?? ""}`}>
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    )}
                    {!t.is_published && (
                      <span className="block text-[10px] text-neutral-500 mt-1">غير منشور</span>
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/ops/tenants/${t.id}`}
                      className="text-neutral-300 hover:text-neutral-100 text-xs"
                    >
                      تفاصيل ←
                    </Link>
                  </Td>
                </tr>
              );
            })}
            {(!tenants || tenants.length === 0) && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-neutral-500">
                  لا يوجد مطاعم بعد. اضغط "إضافة مطعم" للبدء.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-right px-3 py-2 font-medium text-xs">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}
