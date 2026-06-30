import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Public dynamic QR short-link: resolve the code -> 302 to its destination,
// recording a scan (side effect inside the RPC). Miss -> graceful 302 to "/".
export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const sb = createClient();
  const source = new URL(request.url).searchParams.get("s");
  const { data: destination } = await sb.rpc("resolve_qr_link", {
    p_code: params.code,
    p_user_agent: request.headers.get("user-agent"),
    p_referrer: request.headers.get("referer"),
    p_source_type: source,
  });
  const target = typeof destination === "string" && destination.length > 0 ? destination : "/";
  // resolve_qr_link already recorded this scan; mark the redirect so the menu
  // page (logMenuView) skips logging it again and we don't double-count.
  const url = new URL(target, request.url);
  url.searchParams.set("qr", "1");
  return NextResponse.redirect(url, 302);
}
