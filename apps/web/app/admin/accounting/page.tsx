import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import BranchAccounting from "./branch-accounting";

export default async function AdminAccountingPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "branch_accounting"))) notFound();

  const sb = createClient();
  const [{ data: orders }, { data: branches }] = await Promise.all([
    sb
      .from("orders")
      .select("id, order_type, status, total, branch_id, cancellation_reason_id, created_at")
      .eq("restaurant_id", me.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(1000),
    sb
      .from("restaurant_branches")
      .select("id, name_ar")
      .eq("restaurant_id", me.restaurant_id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">حسابات الفروع</h1>
      <p className="text-sm text-neutral-500">
        إيرادات وطلبات كل فرع — مقارنة أداء الفروع ونظرة مجمّعة للمالك.
      </p>
      <BranchAccounting
        orders={orders ?? []}
        branches={(branches ?? []) as { id: string; name_ar: string }[]}
      />
    </div>
  );
}
