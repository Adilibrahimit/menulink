// Monotonic status model (Codex #4). A delayed/out-of-order webhook must never regress status,
// and never triggers a resend (the gateway is status-only).

export type StatusName =
  | "AcceptedByMeta" | "Sent" | "Delivered" | "Read" | "Failed";

export const STATUS_RANK: Record<StatusName, number> = {
  AcceptedByMeta: 10,
  Sent: 20,
  Delivered: 30,
  Read: 40,
  Failed: 100, // terminal — carries error evidence; only set from an explicit failed event
};

/** Map a Meta webhook status string to our canonical status. */
export function fromMetaStatus(s: string): StatusName | null {
  switch (s?.toLowerCase()) {
    case "sent": return "Sent";
    case "delivered": return "Delivered";
    case "read": return "Read";
    case "failed": return "Failed";
    case "accepted": return "AcceptedByMeta";
    default: return null;
  }
}

export function rankOf(s: StatusName): number { return STATUS_RANK[s]; }

/**
 * Reduce current + incoming into the winning status. 'Failed' is terminal and wins once set.
 * Otherwise the higher rank wins; equal/lower incoming is ignored (no regression Read→Delivered etc.).
 * Returns the status to persist (or the current one unchanged).
 */
export function reduceStatus(current: StatusName | null, incoming: StatusName): StatusName {
  if (current === "Failed") return "Failed";            // terminal sticks
  if (incoming === "Failed") return "Failed";           // explicit failure wins
  if (current === null) return incoming;
  return rankOf(incoming) > rankOf(current) ? incoming : current;
}
