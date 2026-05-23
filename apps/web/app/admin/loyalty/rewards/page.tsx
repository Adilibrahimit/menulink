import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import RewardsEditor from "./rewards-editor";

export default async function AdminLoyaltyRewardsPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "loyalty"))) notFound();

  const sb = createClient();
  const { data: rewards } = await sb
    .from("loyalty_rewards")
    .select("id, name_ar, description_ar, points_cost, min_tier, max_per_customer, active, sort_order, created_at")
    .eq("restaurant_id", me.restaurant_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/admin/loyalty" className="text-xs text-neutral-500 hover:text-neutral-900">← الولاء</Link>
          <h1 className="text-xl font-bold mt-1">المكافآت</h1>
          <p className="text-sm text-neutral-500 mt-1">
            عرّف ما يستطيع العميل استبداله بنقاطه. تظهر للعميل تلقائياً في صفحة المكافآت.
          </p>
        </div>
      </div>
      <RewardsEditor
        restaurantId={me.restaurant_id}
        initial={rewards ?? []}
      />
    </div>
  );
}
