import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

type Row = {
  restaurant_id: string;
  name: string;
  slug: string;
  menu_only: boolean;
  total_views: number;
  device_days: number;
  views_30d: number;
  device_days_30d: number;
  orders_total: number;
  orders_30d: number;
  last_visit_at: string | null;
};

export const dynamic = "force-dynamic";

export default async function OpsAnalytics() {
  await requireOps();
  const sb = createClient();

  const { data, error } = await sb
    .from("v_tenant_engagement")
    .select("*")
    .order("total_views", { ascending: false })
    .order("orders_total", { ascending: false });

  if (error) {
    return (
      <p className="rounded-md bg-red-900/40 border border-red-800 text-red-300 text-sm p-3">
        {error.message}
      </p>
    );
  }

  const rows = (data ?? []) as Row[];
  const totalViews = rows.reduce((s, r) => s + (r.total_views ?? 0), 0);
  const totalOrders = rows.reduce((s, r) => s + (r.orders_total ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">التحليلات</h1>
        <div className="text-xs text-neutral-400">
          {totalViews.toLocaleString("ar-SA")} مشاهدة · {totalOrders.toLocaleString("ar-SA")} طلب
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/70 text-neutral-400 border-b border-neutral-800">
            <tr>
              <Th>المطعم</Th>
              <Th>النوع</Th>
              <Th>المشاهدات</Th>
              <Th>أجهزة/يوم *</Th>
              <Th>مشاهدات ٣٠ يوم</Th>
              <Th>الطلبات</Th>
              <Th>آخر زيارة</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {rows.map((r) => (
              <tr key={r.restaurant_id} className="hover:bg-neutral-900/50">
                <Td>
                  <div className="font-medium text-neutral-100">{r.name}</div>
                  <div className="text-xs text-neutral-500 font-mono">{r.slug}</div>
                </Td>
                <Td>
                  {r.menu_only ? (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-sky-800 bg-sky-900/40 text-sky-300">
                      عرض فقط
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-green-800 bg-green-900/40 text-green-300">
                      طلبات
                    </span>
                  )}
                </Td>
                <Td className="text-neutral-100 font-semibold">{r.total_views.toLocaleString("ar-SA")}</Td>
                <Td className="text-neutral-300">{r.device_days.toLocaleString("ar-SA")}</Td>
                <Td className="text-neutral-400">{r.views_30d.toLocaleString("ar-SA")}</Td>
                <Td>
                  <span className="text-neutral-200">{r.orders_total.toLocaleString("ar-SA")}</span>
                  {r.orders_30d > 0 && (
                    <span className="text-[10px] text-neutral-500 mr-1">({r.orders_30d} / ٣٠ي)</span>
                  )}
                </Td>
                <Td className="text-neutral-400 text-xs">
                  {r.last_visit_at ? new Date(r.last_visit_at).toLocaleDateString("ar-SA") : "—"}
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-neutral-500">
                  لا توجد بيانات زيارات بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-neutral-500 leading-relaxed">
        * <b>أجهزة/يوم</b> = عدد الأجهزة المختلفة التي فتحت القائمة يومياً (بصمة مجزّأة لـ IP+المتصفح،
        بدون تخزين IP خام). ليست عدد الأشخاص الفعليين — شبكات الجوال السعودية تشارك نفس الـ IP بين كثير
        من المستخدمين، فالرقم تقديري للأسفل. تُحذف بيانات الزيارات تلقائياً بعد ٩٠ يوماً. لا تُحتسب زيارات
        روبوتات معاينة الروابط (واتساب/تيليجرام…).
      </p>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-right px-3 py-2 font-medium text-xs whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 whitespace-nowrap ${className}`}>{children}</td>;
}
