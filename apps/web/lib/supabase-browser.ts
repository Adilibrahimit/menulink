"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Use in Client Components for Realtime
// subscriptions, optimistic UI, and on-the-fly mutations from event handlers.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
