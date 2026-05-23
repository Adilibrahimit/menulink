import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import LoyaltyCustomersTable from "./loyalty-customers-table";

export default async function AdminLoyaltyCustomersPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "loyalty"))) notFound();

  const sb = createClient();
  // Top-earning customers first. Limit to keep the page light; pagination
  // can come if a tenant has thousands of loyalty customers.
  const { data: customers } = await sb
    .from("customers")
    .select("id, name, phone, loyalty_points_balance, loyalty_lifetime_points, loyalty_tier, orders_count, lifetime_spend, last_seen_at, auth_user_id")
    .eq("restaurant_id", me.restaurant_id)
    .order("loyalty_lifetime_points", { ascending: false })
    .order("orders_count", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/admin/loyalty" className="text-xs text-neutral-500 hover:text-neutral-900">← الولاء</Link>
          <h1 className="text-xl font-bold mt-1">عملاء الولاء</h1>
          <p className="text-sm text-neutral-500 mt-1">
            أعلى ٢٠٠ عميل حسب النقاط مدى الحياة. عدّل الرصيد يدوياً عند الحاجة (للطلبات النقدية، الاسترجاعات، أو المكافآت VIP).
          </p>
        </div>
      </div>
      <LoyaltyCustomersTable
        initial={(customers ?? []) as Parameters<typeof LoyaltyCustomersTable>[0]["initial"]}
      />
    </div>
  );
}
