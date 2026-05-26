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

  const { restaurant_id, customer_id, title, body, url } = await req.json();
  if (!restaurant_id || !customer_id || !title) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  if (!(await hasAddon(restaurant_id, "push_marketing"))) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const sb = createClient();
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, keys_p256dh, keys_auth")
    .eq("customer_id", customer_id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const { data: restaurant } = await sb
    .from("restaurants")
    .select("slug, logo_url")
    .eq("id", restaurant_id)
    .single();

  const payload = JSON.stringify({
    title,
    body: body || "",
    url: url || `/m/${restaurant?.slug || ""}`,
    icon: restaurant?.logo_url || undefined,
    badge: restaurant?.logo_url || undefined,
  });
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          payload,
        );
        sent++;
      } catch {
        // stale subscription — silent for single-customer push
      }
    }),
  );

  return NextResponse.json({ ok: true, sent });
}
