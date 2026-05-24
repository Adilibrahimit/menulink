import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import { requireOwner } from "@/lib/auth";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:id.menulink@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_KEY || "",
  process.env.VAPID_PRIVATE_KEY || "",
);

export async function POST(req: NextRequest) {
  const user = await requireOwner();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { restaurant_id, title, body, url, segments } = await req.json();

  if (!restaurant_id || !title || !body) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  if (!(await hasAddon(restaurant_id, "push_marketing"))) {
    return NextResponse.json({ error: "addon not enabled" }, { status: 403 });
  }

  const sb = createClient();

  // Build query: get push subscriptions for targeted customers
  let query = sb
    .from("push_subscriptions")
    .select("endpoint, keys_p256dh, keys_auth, customer_id")
    .eq("restaurant_id", restaurant_id);

  // If segments specified, filter by RFM segment via customer join
  if (segments && segments.length > 0) {
    const { data: customers } = await sb
      .from("v_customer_rfm")
      .select("customer_id")
      .eq("restaurant_id", restaurant_id)
      .in("segment", segments);

    const customerIds = (customers ?? []).map((c: { customer_id: string }) => c.customer_id);
    if (customerIds.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, reason: "no_customers_in_segment" });
    }
    query = query.in("customer_id", customerIds);
  }

  const { data: subs } = await query;
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, reason: "no_subscriptions" });
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url || `/m/${(await sb.from("restaurants").select("slug").eq("id", restaurant_id).single()).data?.slug || ""}`,
  });

  let delivered = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          payload,
        );
        delivered++;
      } catch (err: unknown) {
        failed++;
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }),
  );

  // Clean up stale subscriptions (browser unsubscribed or revoked)
  if (staleEndpoints.length > 0) {
    await sb.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  // Record broadcast in history
  await sb.from("push_broadcasts").insert({
    restaurant_id,
    title,
    body,
    url,
    segment_filter: segments || [],
    recipient_count: subs.length,
    delivered_count: delivered,
    failed_count: failed,
    sent_by: user.id,
  });

  return NextResponse.json({ ok: true, sent: delivered, failed });
}
