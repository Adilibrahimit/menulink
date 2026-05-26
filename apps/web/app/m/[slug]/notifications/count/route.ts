import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const sb = createClient();

  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id")
    .eq("slug", params.slug)
    .single();

  if (!restaurant) {
    return NextResponse.json({ count: 0 });
  }

  const since = req.nextUrl.searchParams.get("since");

  let query = sb
    .from("tenant_notifications")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id);

  if (since) {
    query = query.gt("created_at", since);
  }

  const { count } = await query;
  return NextResponse.json({ count: count ?? 0 });
}
