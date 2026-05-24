import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { restaurant_id, customer_id, subscription } = await req.json();

  if (!restaurant_id || !subscription?.endpoint || !subscription?.keys) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const sb = createClient();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      restaurant_id,
      customer_id: customer_id || null,
      endpoint: subscription.endpoint,
      keys_p256dh: subscription.keys.p256dh,
      keys_auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
