// Customer OAuth callback. Receives ?code= from Supabase, exchanges it
// for a session (writes the cookie), then redirects to ?next=… or "/".
//
// Owner + ops still use email+password and have their own login routes.
// This callback is dedicated to the customer Google OAuth flow.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const sb = createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      // Surface the error in the URL so the destination can show it.
      const safeNext = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${origin}${safeNext}?auth_error=${encodeURIComponent(error.message)}`);
    }
  }

  const safeNext = next.startsWith("/") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
