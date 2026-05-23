// Per-tenant feature flags. Backed by subscription_addons (rows assigned to
// a restaurant) joined against addon_catalog (the master list of what we
// offer). See migration 0016 for the schema.
//
// Use the server helper in:
//   - admin layout (to filter sidebar NAV)
//   - admin page server components (early-return guard)
//   - admin API routes (403 guard)
//   - customer PWA /m/[slug]/page.tsx (soft-degrade ?table= when off)

import { createClient } from "./supabase-server";

export type AddonKey =
  | "tables_qr"
  | "excel_export"
  | "pos_bridge"
  | "loyalty"
  | "push_marketing";

export async function getEnabledAddons(restaurantId: string): Promise<Set<AddonKey>> {
  const sb = createClient();
  const { data } = await sb
    .from("subscription_addons")
    .select("addon_key, enabled, trial_ends_at")
    .eq("restaurant_id", restaurantId)
    .eq("enabled", true);

  const now = Date.now();
  const enabled = new Set<AddonKey>();
  for (const row of data ?? []) {
    // Trial expiry: trial_ends_at in the past means the addon row exists
    // but the trial lapsed — treat as disabled until ops resets it.
    if (row.trial_ends_at && new Date(row.trial_ends_at as string).getTime() < now) continue;
    enabled.add(row.addon_key as AddonKey);
  }
  return enabled;
}

export async function hasAddon(restaurantId: string, key: AddonKey): Promise<boolean> {
  const enabled = await getEnabledAddons(restaurantId);
  return enabled.has(key);
}
