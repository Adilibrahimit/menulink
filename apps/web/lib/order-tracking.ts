// Which orders this device is currently following.
//
// Replaces the single-slot `menulink:tracking:<restaurantId>` used by the
// car-curbside feature, which held ONE order and only ever for order_type
// "car" — a second order silently overwrote the first, and every other order
// type got no tracking at all.
//
// Stores ids only. Everything shown to the customer is re-read live through
// get_order_status (migration 0082), so nothing here can go stale or lie.

export type TrackedOrder = {
  orderId: string;
  /** Shown in the bar before the first fetch lands. */
  orderNumber: string | null;
  at: number;
};

const MAX_TRACKED = 5;
/** Drop anything older than this even if it never reached a final status —
 *  otherwise a forgotten order sits in the bar forever. */
const TTL_MS = 12 * 60 * 60 * 1000;

function key(restaurantId: string) {
  return `menulink:orders:${restaurantId}`;
}

export function readTracked(restaurantId: string): TrackedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(restaurantId));
    if (!raw) return [];
    const list = JSON.parse(raw) as TrackedOrder[];
    if (!Array.isArray(list)) return [];
    const fresh = list.filter((o) => o?.orderId && Date.now() - (o.at ?? 0) < TTL_MS);
    if (fresh.length !== list.length) writeTracked(restaurantId, fresh);
    return fresh;
  } catch {
    return [];
  }
}

function writeTracked(restaurantId: string, list: TrackedOrder[]) {
  try {
    if (list.length === 0) localStorage.removeItem(key(restaurantId));
    else localStorage.setItem(key(restaurantId), JSON.stringify(list.slice(-MAX_TRACKED)));
  } catch {
    /* private mode / quota — tracking is best-effort, never block checkout */
  }
}

export function trackOrder(restaurantId: string, orderId: string, orderNumber: string | null) {
  const list = readTracked(restaurantId).filter((o) => o.orderId !== orderId);
  list.push({ orderId, orderNumber, at: Date.now() });
  writeTracked(restaurantId, list);
}

export function untrackOrder(restaurantId: string, orderId: string) {
  writeTracked(restaurantId, readTracked(restaurantId).filter((o) => o.orderId !== orderId));
}

/** Live snapshot from get_order_status. Mirrors the RPC's jsonb shape. */
export type OrderStatusSnapshot = {
  order_id: string;
  status: string;
  order_type: string | null;
  total: number | null;
  created_at: string;
  daily_order_number: number | string | null;
  table_label: string | null;
  car_arrived_at: string | null;
  restaurant_id: string;
  restaurant_slug: string;
  restaurant_name: string;
  branch_name_ar: string | null;
  events: { new_status: string; created_at: string }[];
};

/**
 * `null` means the RPC answered and the order genuinely isn't there.
 * `undefined` means we couldn't ask (offline, 5xx, DNS…).
 *
 * The difference matters: supabase-js resolves network failures as
 * `{ data: null, error }` rather than throwing, so collapsing both into `null`
 * made one dropped request look identical to a deleted order — and the caller
 * responded by forgetting the order permanently.
 */
export async function fetchOrderStatus(
  orderId: string,
): Promise<OrderStatusSnapshot | null | undefined> {
  const { createClient } = await import("./supabase-browser");
  const sb = createClient();
  try {
    const { data, error } = await sb.rpc("get_order_status", { p_order_id: orderId });
    if (error) {
      console.error("[MenuLink] get_order_status failed:", error);
      return undefined;
    }
    return (data as OrderStatusSnapshot | null) ?? null;
  } catch (err) {
    console.error("[MenuLink] get_order_status threw:", err);
    return undefined;
  }
}
