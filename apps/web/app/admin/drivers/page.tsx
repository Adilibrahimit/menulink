import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import DriversEditor from "./drivers-editor";

export default async function AdminDriversPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "drivers"))) notFound();

  const sb = createClient();
  const [{ data: drivers }, { data: branches }] = await Promise.all([
    sb
      .from("drivers")
      .select("*")
      .eq("restaurant_id", me.restaurant_id)
      .order("created_at"),
    sb
      .from("restaurant_branches")
      .select("id, name_ar, is_default, is_active")
      .eq("restaurant_id", me.restaurant_id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">إدارة السائقين</h1>
      <p className="text-sm text-neutral-500">
        أضف سائقين للمطعم وعيّنهم للفروع. عند تسليم طلب توصيل، اختر السائق من
        قائمة الطلبات لتتبع المسؤولية والتسوية.
      </p>
      <DriversEditor
        restaurantId={me.restaurant_id}
        initialDrivers={drivers ?? []}
        branches={branches ?? []}
      />
    </div>
  );
}
