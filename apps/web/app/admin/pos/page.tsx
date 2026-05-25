import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import PosDashboard from "./pos-dashboard";

export default async function AdminPosPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "pos_bridge"))) notFound();

  const sb = createClient();
  const [
    { data: outbox },
    { data: syncEvents },
    { data: posSettings },
    { data: itemMap },
    { data: menuItems },
    { data: branches },
  ] = await Promise.all([
    sb
      .from("pos_outbox")
      .select("*")
      .eq("restaurant_id", me.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(100),
    sb
      .from("pos_sync_events")
      .select("*")
      .eq("restaurant_id", me.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(100),
    sb
      .from("pos_settings")
      .select("*")
      .eq("restaurant_id", me.restaurant_id)
      .maybeSingle(),
    sb
      .from("pos_item_map")
      .select("restaurant_id, menu_item_id, pos_item_id, pos_variant_key, notes")
      .eq("restaurant_id", me.restaurant_id),
    sb
      .from("menu_items")
      .select("id, name_ar, is_active")
      .eq("restaurant_id", me.restaurant_id)
      .eq("is_active", true),
    sb
      .from("restaurant_branches")
      .select("id, name_ar")
      .eq("restaurant_id", me.restaurant_id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">مراقبة نقاط البيع</h1>
      <p className="text-sm text-neutral-500">
        حالة المزامنة مع نظام نقاط البيع — الطلبات المرسلة، الأخطاء، ربط الأصناف.
      </p>
      <PosDashboard
        restaurantId={me.restaurant_id}
        outbox={outbox ?? []}
        syncEvents={syncEvents ?? []}
        posSettings={posSettings}
        itemMap={itemMap ?? []}
        menuItems={(menuItems ?? []) as { id: string; name_ar: string; is_active: boolean }[]}
        branches={(branches ?? []) as { id: string; name_ar: string }[]}
      />
    </div>
  );
}
