import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { updates } = await req.json() as {
    updates: Array<{
      pos_invoice_id: string;
      is_hold: boolean;
      is_paid: boolean;
      is_cancelled: boolean;
      payment_type?: string;
      paid_at?: string;
    }>;
  };

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "missing updates array" }, { status: 400 });
  }

  let synced = 0;
  let skipped = 0;

  for (const u of updates) {
    const { data: outboxRow } = await sb
      .from("pos_outbox")
      .select("id, order_id, restaurant_id, status")
      .eq("pos_invoice_id", u.pos_invoice_id)
      .eq("status", "synced")
      .maybeSingle();

    if (!outboxRow) { skipped++; continue; }

    let newOrderStatus: string | null = null;

    if (u.is_cancelled) {
      newOrderStatus = "cancelled";
    } else if (!u.is_hold && u.is_paid) {
      newOrderStatus = "confirmed";
    } else if (!u.is_hold && !u.is_paid) {
      newOrderStatus = "confirmed";
    }

    if (!newOrderStatus) { skipped++; continue; }

    const { data: order } = await sb
      .from("orders")
      .select("id, status")
      .eq("id", outboxRow.order_id)
      .single();

    if (!order || order.status === newOrderStatus || order.status === "delivered" || order.status === "cancelled") {
      skipped++;
      continue;
    }

    await sb
      .from("orders")
      .update({ status: newOrderStatus })
      .eq("id", outboxRow.order_id);

    await sb.from("pos_sync_events").insert({
      restaurant_id: outboxRow.restaurant_id,
      order_id: outboxRow.order_id,
      provider: "rzrz",
      operation_type: u.is_cancelled ? "cancel_delivery_invoice" : "update_delivery_status",
      status: "success",
      request_summary: { pos_invoice_id: u.pos_invoice_id, is_hold: u.is_hold, is_paid: u.is_paid },
      external_invoice_id: u.pos_invoice_id,
    });

    synced++;
  }

  return NextResponse.json({ ok: true, synced, skipped });
}

export async function GET(req: NextRequest) {
  const sb = createClient();
  const restaurantId = req.nextUrl.searchParams.get("restaurant_id");
  if (!restaurantId) {
    return NextResponse.json({ error: "missing restaurant_id" }, { status: 400 });
  }

  const { data } = await sb
    .from("pos_outbox")
    .select("pos_invoice_id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "synced")
    .not("pos_invoice_id", "is", null);

  const invoiceIds = (data ?? []).map((r) => r.pos_invoice_id as string);
  return NextResponse.json({ invoice_ids: invoiceIds });
}
