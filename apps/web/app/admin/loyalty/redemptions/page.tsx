import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import RedemptionsList from "./redemptions-list";

export default async function AdminLoyaltyRedemptionsPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "loyalty"))) notFound();

  const sb = createClient();
  // Pull last 100; client component filters by status. RLS scopes to this
  // tenant via owner_all_loyalty_redemptions.
  const { data: rows } = await sb
    .from("loyalty_redemptions")
    .select("id, points_cost, status, redeemed_at, fulfilled_at, cancelled_at, notes, customer_id, reward_id, loyalty_rewards(name_ar), customers(name, phone)")
    .eq("restaurant_id", me.restaurant_id)
    .order("redeemed_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/admin/loyalty" className="text-xs text-neutral-500 hover:text-neutral-900">← الولاء</Link>
          <h1 className="text-xl font-bold mt-1">طلبات الاستبدال</h1>
          <p className="text-sm text-neutral-500 mt-1">
            عند تسليم المكافأة للعميل اضغط "تم التسليم". لو فيه مشكلة (نفاد، إلخ) اضغط "إلغاء" وترجع النقاط للعميل تلقائياً.
          </p>
        </div>
      </div>
      <RedemptionsList
        restaurantId={me.restaurant_id}
        initial={(rows ?? []) as unknown as Parameters<typeof RedemptionsList>[0]["initial"]}
      />
    </div>
  );
}
