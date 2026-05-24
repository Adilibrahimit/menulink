import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import { redirect } from "next/navigation";
import BroadcastClient from "./broadcast-client";

export default async function BroadcastPage() {
  const me = await requireOwner();
  const pushEnabled = await hasAddon(me.restaurant_id, "push_marketing");
  if (!pushEnabled) redirect("/admin");

  const sb = createClient();

  const [{ data: history }, { data: subCount }] = await Promise.all([
    sb
      .from("push_broadcasts")
      .select("id, title, body, segment_filter, recipient_count, delivered_count, failed_count, created_at")
      .eq("restaurant_id", me.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(50),
    sb
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", me.restaurant_id),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الإشعارات والتسويق</h1>
      <p className="text-sm text-neutral-500">
        أرسل إشعارات Push لعملائك حسب الشريحة. عدد المشتركين: {subCount?.length ?? 0}
      </p>
      <BroadcastClient
        restaurantId={me.restaurant_id}
        history={history ?? []}
        subscriberCount={(subCount as unknown as { count: number })?.count ?? 0}
      />
    </div>
  );
}
