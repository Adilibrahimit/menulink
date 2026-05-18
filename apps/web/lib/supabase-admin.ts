import "server-only";
import { createClient } from "@supabase/supabase-js";

// SERVICE-ROLE client. Bypasses RLS — never expose to the browser.
// Used inside server actions for platform-admin operations only:
//   - creating tenant auth users via Auth Admin API
//   - any cross-tenant write the SECURITY DEFINER functions don't cover
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("supabase-admin: missing SUPABASE_SERVICE_ROLE_KEY env var");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
