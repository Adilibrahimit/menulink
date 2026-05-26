import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import TeamEditor from "./team-editor";

export default async function AdminTeamPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "branch_admins"))) notFound();

  const sb = createClient();

  const [{ data: admins }, { data: branches }] = await Promise.all([
    sb.rpc("get_restaurant_admins", { p_restaurant_id: me.restaurant_id }),
    sb
      .from("restaurant_branches")
      .select("id, name_ar, is_active")
      .eq("restaurant_id", me.restaurant_id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">إدارة الفريق</h1>
      <p className="text-sm text-neutral-500">
        أضف موظفين وحدد صلاحياتهم وربطهم بالفروع. حالياً البيانات فقط — تسجيل
        الدخول للموظفين سيُفعّل في تحديث قادم.
      </p>
      <TeamEditor
        restaurantId={me.restaurant_id}
        initialAdmins={admins ?? []}
        branches={branches ?? []}
      />
    </div>
  );
}
