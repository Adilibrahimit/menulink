import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import OrdersLive from "./orders-live";

export default async function OrdersPage() {
  const me = await requireOwner();
  const sb = createClient();

  // Pull last 200 to cover several days of today-filter switching without re-fetching.
  // The OrdersLive client component then filters in-memory based on the toggle state.
  const [{ data: orders }, { data: rest }, excelEnabled, pushEnabled] = await Promise.all([
    sb
      .from("orders")
      .select("id, customer_id, order_type, channel, status, subtotal, delivery_fee, total, address, notes, car_plate, car_color, car_arrived_at, table_label, created_at, customers(name, phone)")
      .eq("restaurant_id", me.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(200),
    sb
      .from("restaurants")
      .select("slug")
      .eq("id", me.restaurant_id)
      .single(),
    hasAddon(me.restaurant_id, "excel_export"),
    hasAddon(me.restaurant_id, "push_marketing"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الطلبات</h1>
      <p className="text-sm text-neutral-500">
        التحديث مباشر — كل طلب جديد يظهر تلقائياً. فعّل الصوت لتلقي إشعارات صوتية.
      </p>
      <OrdersLive
        restaurantId={me.restaurant_id}
        restaurantSlug={rest?.slug ?? "report"}
        initial={orders ?? []}
        excelEnabled={excelEnabled}
        pushEnabled={pushEnabled}
      />
    </div>
  );
}
