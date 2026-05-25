import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import BranchesEditor from "./branches-editor";

export default async function AdminBranchesPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "multi_branch"))) notFound();

  const sb = createClient();
  const { data: branches } = await sb
    .from("restaurant_branches")
    .select("*")
    .eq("restaurant_id", me.restaurant_id)
    .order("sort_order")
    .order("created_at");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">إدارة الفروع</h1>
      <p className="text-sm text-neutral-500">
        أضف وعدّل فروع المطعم. كل فرع له رقم واتساب وعنوان وأنواع خدمة مستقلة.
      </p>
      <BranchesEditor
        restaurantId={me.restaurant_id}
        initialBranches={branches ?? []}
      />
    </div>
  );
}
