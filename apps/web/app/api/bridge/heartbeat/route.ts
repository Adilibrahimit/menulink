import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    restaurant_id,
    instance_id,
    version,
    machine_name,
    local_db_name,
    pos_kind,
    uptime_seconds,
    pending_count,
    last_sync_at,
  } = body;

  if (!restaurant_id || !instance_id) {
    return NextResponse.json({ error: "missing restaurant_id or instance_id" }, { status: 400 });
  }

  const { error } = await sb.from("bridge_heartbeats").insert({
    restaurant_id,
    instance_id,
    version: version ?? null,
    machine_name: machine_name ?? null,
    local_db_name: local_db_name ?? null,
    pos_kind: pos_kind ?? null,
    uptime_seconds: uptime_seconds ?? null,
    pending_count: pending_count ?? null,
    last_sync_at: last_sync_at ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const sb = createClient();
  const restaurantId = req.nextUrl.searchParams.get("restaurant_id");
  if (!restaurantId) {
    return NextResponse.json({ error: "missing restaurant_id" }, { status: 400 });
  }

  const { data } = await sb
    .from("bridge_heartbeats")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ online: false, message: "No heartbeat received yet" });
  }

  const ageMs = Date.now() - new Date(data.created_at as string).getTime();
  const online = ageMs < 3 * 60 * 1000;

  return NextResponse.json({
    online,
    last_seen: data.created_at,
    age_seconds: Math.floor(ageMs / 1000),
    version: data.version,
    machine_name: data.machine_name,
    local_db_name: data.local_db_name,
    uptime_seconds: data.uptime_seconds,
    pending_count: data.pending_count,
    last_sync_at: data.last_sync_at,
  });
}
