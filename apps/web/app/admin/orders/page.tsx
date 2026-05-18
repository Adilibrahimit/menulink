import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import OrdersLive from "./orders-live";

export default async function OrdersPage() {
  const me = await requireOwner();
  const sb = createClient();

  const { data: orders } = await sb
    .from("orders")
    .select("id, order_type, channel, status, subtotal, delivery_fee, total, address, notes, created_at, customers(name, phone)")
    .eq("restaurant_id", me.restaurant_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الطلبات</h1>
      <p className="text-sm text-neutral-500">آخر ١٠٠ طلب. التحديث مباشر — لا تحتاج لإعادة تحميل الصفحة.</p>
      <OrdersLive restaurantId={me.restaurant_id} initial={orders ?? []} />
    </div>
  );
}
