import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import ReportsDashboard from "./reports-dashboard";

export default async function AdminReportsPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "advanced_reports"))) notFound();

  const sb = createClient();
  const [{ data: orders }, { data: branches }, { data: drivers }] = await Promise.all([
    sb
      .from("orders")
      .select("id, order_type, status, total, branch_id, driver_id, cancellation_reason_id, business_date, daily_order_number, created_at, customers(name, phone), order_items(id, item_name, qty, unit_price, line_total)")
      .eq("restaurant_id", me.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(500),
    sb
      .from("restaurant_branches")
      .select("id, name_ar")
      .eq("restaurant_id", me.restaurant_id)
      .eq("is_active", true)
      .order("sort_order"),
    sb
      .from("drivers")
      .select("id, name")
      .eq("restaurant_id", me.restaurant_id)
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">التقارير المتقدمة</h1>
      <p className="text-sm text-neutral-500">
        تقارير تشغيلية حسب الفرع، نوع الطلب، السائق، الحالة، والفترة الزمنية.
      </p>
      <ReportsDashboard
        orders={orders ?? []}
        branches={(branches ?? []) as { id: string; name_ar: string }[]}
        drivers={(drivers ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
