// One source of truth for the order-status vocabulary.
//
// This existed in three places with drifting wording — admin/orders/orders-live
// ("تجهيز"), m/[slug]/orders/orders-client ("قيد التجهيز") and
// order-status-tracker's STEPS. A customer could see one label on the tracking
// page and the owner another for the same order.
//
// Values match the CHECK constraint on orders.status (0001_init.sql:82).

export const ORDER_STATUSES = [
  "submitted",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The happy path, in order. `cancelled` is deliberately not a step. */
export const ORDER_STEPS: OrderStatus[] = [
  "submitted",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
];

export const STATUS_LABEL_AR: Record<OrderStatus, string> = {
  submitted: "تم الإرسال",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export const STATUS_ICON: Record<OrderStatus, string> = {
  submitted: "📨",
  confirmed: "✅",
  preparing: "👨‍🍳",
  ready: "🔔",
  delivered: "🎉",
  cancelled: "✖️",
};

/** "delivered" wording depends on how the customer is getting the order. */
export function finalStepLabel(orderType: string | null | undefined): string {
  switch (orderType) {
    case "pickup": return "تم الاستلام";
    case "dine_in": return "تم التقديم";
    case "car": return "تم التسليم للسيارة";
    default: return "تم التسليم";
  }
}

export const ACTIVE_STATUSES = new Set<OrderStatus>([
  "submitted",
  "confirmed",
  "preparing",
  "ready",
]);

export function isActive(status: string): boolean {
  return ACTIVE_STATUSES.has(status as OrderStatus);
}

/** How far along the happy path, for a progress bar. `cancelled` -> -1. */
export function stepIndex(status: string): number {
  if (status === "cancelled") return -1;
  return ORDER_STEPS.indexOf(status as OrderStatus);
}
