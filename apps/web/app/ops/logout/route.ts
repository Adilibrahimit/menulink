import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const sb = createClient();
  await sb.auth.signOut();
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/ops/login", url.origin), {
    status: 303,
  });
}
