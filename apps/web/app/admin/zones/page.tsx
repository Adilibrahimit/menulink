import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import ZonesEditor from "./zones-editor";

export default async function AdminZonesPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "delivery_zones"))) notFound();

  const sb = createClient();
  const [{ data: branches }, { data: zones }] = await Promise.all([
    sb
      .from("restaurant_branches")
      .select("id, name_ar, is_default, is_active, lat, lng")
      .eq("restaurant_id", me.restaurant_id)
      .eq("is_active", true)
      .order("sort_order"),
    sb
      .from("branch_service_areas")
      .select("*, restaurant_branches!inner(name_ar, restaurant_id)")
      .eq("restaurant_branches.restaurant_id", me.restaurant_id)
      .order("created_at"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">نطاقات التوصيل</h1>
      <p className="text-sm text-neutral-500">
        حدد نطاق التوصيل لكل فرع بالكيلومترات. الطلبات خارج النطاق تُحظر تلقائياً.
        يمكنك تعيين رسوم توصيل وحد أدنى للطلب لكل نطاق.
      </p>
      <ZonesEditor
        branches={branches ?? []}
        initialZones={zones ?? []}
      />
    </div>
  );
}
