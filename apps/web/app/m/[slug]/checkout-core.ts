import { toArabicDigits } from "@/lib/arabic";
import type { CartLine, OrderType, PublicBranch } from "./types";

// ============================================================================
// Checkout core — the single source of truth for turning a cart into a
// WhatsApp order: the customer-facing message, the submit_order RPC payload,
// and the submit orchestration (table session, persist, WhatsApp open,
// callbacks).
//
// Both the default light CartDrawer and the dark/gold PremiumCheckoutFlow call
// these so totals + message can NEVER diverge between the two presentations.
//
// MenuLink is VAT-INCLUSIVE: total = subtotal + deliveryFee (points discount is
// applied server-side via redeem_points; the displayed finalTotal subtracts it
// for the customer). No 15% is ever ADDED — any VAT line is informational and
// computed as included: vat = amount * 15 / 115 (see vatIncluded()).
//
// buildWhatsAppMessage + buildSubmitPayload are PURE (only @/lib/arabic at
// runtime) so they are unit-testable in Node; runCheckout lazy-imports the
// browser-only deps so this module stays loadable outside the bundler.
// ============================================================================

export const orderTypeLabel: Record<OrderType, string> = {
  delivery: "توصيل",
  pickup: "استلام",
  dine_in: "في المطعم",
  car: "استلام بالسيارة",
};

export type OrderRestaurant = {
  id: string;
  name: string;
  slug: string;
  whatsapp_phone: string;
};

// Everything the pure builders need. `phone` is the normalized number used in
// the payload; `rawPhone` is what the customer typed, shown in the message
// (mirrors the original CartDrawer behavior exactly).
export type OrderComposeInput = {
  restaurant: OrderRestaurant;
  branches: PublicBranch[];
  selectedBranchId: string;
  hasMultipleBranches: boolean;
  lines: CartLine[];
  orderType: OrderType;
  name: string;
  rawPhone: string;
  phone: string;
  address: string;
  location: { lat: number; lng: number } | null;
  carPlate: string;
  carColor: string;
  notes: string;
  tableLabel: string;
  lockedToTable: boolean;
  sessionId: string | null;
  subtotal: number;
  deliveryFee: number;
  redeemPoints: number;
  discountAmount: number;
  finalTotal: number;
  /** Stable for one checkout attempt-set, so a retry after an ambiguous failure
   *  returns the original order instead of creating a second one (0083). */
  clientRef: string;
};

/**
 * Id for one checkout attempt-set: generated once per open checkout, reused by
 * every retry of it, so submit_order can recognise a retry and hand back the
 * original order instead of creating a second one (0083).
 *
 * crypto.randomUUID needs a secure context and is missing on Safari < 15.4,
 * which is still in the field here — the fallback only has to be unique per
 * device, since the server scopes the key by restaurant.
 */
export function newClientRef(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// VAT portion already contained in a VAT-inclusive amount. Informational only.
export function vatIncluded(amount: number): number {
  return (amount * 15) / 115;
}

export function buildWhatsAppMessage(input: OrderComposeInput, orderNum: string): string {
  const {
    restaurant, branches, selectedBranchId, hasMultipleBranches, lines, orderType,
    name, rawPhone, address, location, carPlate, carColor, notes, tableLabel,
    lockedToTable, deliveryFee, discountAmount, redeemPoints, finalTotal,
  } = input;

  const lineList = lines
    .map((l, i) => {
      const v = l.variantLabel ? ` (${l.variantLabel})` : "";
      let line = `🍽️ ${toArabicDigits(String(i + 1))}. *${l.itemName}*${v}`;
      line += `\n   📊 الكمية: ${toArabicDigits(String(l.qty))} × ${toArabicDigits(String(l.price))} = *${toArabicDigits(String(l.price * l.qty))} ر.س*`;
      if (l.modifiers && l.modifiers.length > 0) {
        for (const m of l.modifiers) {
          line += `\n   ➕ ${m.groupLabel}: ${m.selected.join("، ")}`;
        }
      }
      if (l.itemNote) {
        line += `\n   📝 ملاحظة: _${l.itemNote}_`;
      }
      return line;
    })
    .join("\n\n");

  const mapsLink =
    orderType === "delivery" && location
      ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
      : null;

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const branchLine = hasMultipleBranches && selectedBranch
    ? `🏢 *الفرع:* ${selectedBranch.name_ar}\n`
    : "";

  return (
    `🌟 *طلب جديد · ${restaurant.name}* 🌟\n` +
    `🔖 *رقم الطلب:* #${orderNum}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    branchLine +
    (lockedToTable ? `🪑 *الطاولة:* ${tableLabel}\n` : "") +
    `📦 *نوع الطلب:* ${orderTypeLabel[orderType]}\n` +
    `👤 *الاسم:* ${name || "—"}\n` +
    `📞 *الجوال:* ${rawPhone || "—"}\n` +
    (orderType === "delivery" && address ? `📍 *العنوان:* ${address}\n` : "") +
    (mapsLink ? `🗺️ *الموقع:* ${mapsLink}\n` : "") +
    (orderType === "car" && carPlate ? `🚗 *رقم اللوحة:* ${carPlate}\n` : "") +
    (orderType === "car" && carColor ? `🎨 *لون السيارة:* ${carColor}\n` : "") +
    `━━━━━━━━━━━━━━━━\n` +
    `🛒 *تفاصيل الطلب (${toArabicDigits(String(lines.length))} أصناف):*\n\n${lineList}\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    (deliveryFee > 0 ? `🚗 *رسوم التوصيل: ${toArabicDigits(deliveryFee.toFixed(2))} ر.س*\n` : "") +
    (discountAmount > 0 ? `🎁 *خصم النقاط:* -${toArabicDigits(discountAmount.toFixed(2))} ر.س (${toArabicDigits(String(redeemPoints))} نقطة)\n` : "") +
    `💰 *المجموع: ${toArabicDigits(finalTotal.toFixed(2))} ر.س*\n` +
    (notes ? `📝 *ملاحظات عامة:* ${notes}\n` : "") +
    `━━━━━━━━━━━━━━━━\n` +
    `✅ شكراً لاختياركم *${restaurant.name}* 🙏`
  );
}

export type SubmitOrderItem = {
  item_id: string;
  variant_key: string;
  item_name: string;
  variant: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
};

export function buildSubmitPayload(input: OrderComposeInput) {
  const {
    restaurant, selectedBranchId, lines, orderType, name, phone, address,
    location, carPlate, carColor, notes, tableLabel, sessionId, subtotal,
    deliveryFee, redeemPoints, clientRef,
  } = input;

  return {
    restaurant_id: restaurant.id,
    branch_id: selectedBranchId || null,
    client_ref: clientRef,
    phone,
    name: name || null,
    address: orderType === "delivery" ? (address || null) : null,
    lat: orderType === "delivery" ? (location?.lat ?? null) : null,
    lng: orderType === "delivery" ? (location?.lng ?? null) : null,
    order_type: orderType,
    channel: "whatsapp",
    subtotal,
    delivery_fee: deliveryFee,
    total: subtotal + deliveryFee,
    notes: notes || null,
    car_plate: orderType === "car" ? (carPlate || null) : null,
    car_color: orderType === "car" ? (carColor || null) : null,
    table_label: tableLabel || null,
    session_id: sessionId || null,
    redeem_points: redeemPoints > 0 ? redeemPoints : undefined,
    items: lines.map((l): SubmitOrderItem => {
      let variantText = l.variantLabel || "";
      if (l.modifiers && l.modifiers.length > 0) {
        const modSummary = l.modifiers.map((m) => m.selected.join("، ")).join(" · ");
        variantText = variantText ? `${variantText} · ${modSummary}` : modSummary;
      }
      if (l.itemNote) {
        variantText = variantText
          ? `${variantText} · ملاحظة: ${l.itemNote}`
          : `ملاحظة: ${l.itemNote}`;
      }
      return {
        item_id: l.itemId,
        variant_key: l.variantKey,
        item_name: l.itemName,
        variant: variantText || l.variantLabel,
        qty: l.qty,
        unit_price: l.price,
        line_total: l.price * l.qty,
      };
    }),
  };
}

export type RunCheckoutHandlers = {
  onCarOrderPlaced: (t: { orderId: string; plate: string; color: string; arrived: boolean }) => void;
  onTableOrderPlaced: (sessionId: string) => void;
};

/**
 * Hand the composed order over to WhatsApp.
 *
 * `window.open` only succeeds while the browser still considers the tap
 * "active". runCheckout deliberately awaits submit_order first, and iOS Safari
 * drops that activation across the await — so opening from here is blocked
 * essentially every time, and Chrome blocks it too whenever the RPC outruns its
 * ~5s activation window. The order still saved, so the customer saw success
 * while the restaurant got nothing.
 *
 * Callers therefore open a blank tab synchronously inside the click handler and
 * pass the handle in; here we only point it at the URL. The two fallbacks cover
 * a caller that didn't (or a tab the browser killed anyway): a plain open, then
 * a same-tab navigation, which is never popup-blocked. Leaving the menu page is
 * safe — the order is already persisted, and wa.me hands off to the app.
 */
export function openWhatsApp(url: string, pre?: Window | null): void {
  if (pre && !pre.closed) {
    pre.location.href = url;
    return;
  }
  if (window.open(url, "_blank")) return;
  window.location.href = url;
}

export type CheckoutErrorKind = "points" | "closed" | "min_order" | "failed";

export type RunCheckoutResult =
  | { ok: true; orderId: string | null; orderNumber: string }
  | { ok: false; error: CheckoutErrorKind; message: string };

/** Turn a Postgres error into something a customer can act on. */
function classifyError(err: unknown): { error: CheckoutErrorKind; message: string } {
  const raw = (err as { message?: string } | null)?.message ?? String(err ?? "");
  if (raw.includes("restaurant_closed"))
    return { error: "closed", message: "المطعم مغلق حالياً — لا يمكن استلام الطلب الآن." };
  if (raw.includes("below_min_order"))
    return { error: "min_order", message: "قيمة الطلب أقل من الحد الأدنى للتوصيل." };
  if (raw.includes("insufficient points") || raw.includes("redemption"))
    return { error: "points", message: "تعذّر استخدام النقاط. حدّث الصفحة وحاول مرة أخرى." };
  return { error: "failed", message: "تعذّر إرسال الطلب. تأكد من الاتصال وحاول مرة أخرى." };
}

/**
 * Orchestrates a submit using the pure builders above.
 *
 * The order is now ALWAYS saved before WhatsApp opens. Previously the save was
 * fire-and-forget for delivery/pickup/dine-in, which meant a failed save still
 * looked like success to the customer — and for a POS tenant, no order row
 * means no outbox row means no held bill. Confirming something that didn't
 * happen is the worst outcome here, so a failure now blocks and reports.
 *
 * WhatsApp still opens automatically afterwards: it remains the channel the
 * restaurant actually watches. `waWindow` is a blank tab the caller opened
 * synchronously in the click handler — see openWhatsApp for why that matters.
 */
export async function runCheckout(
  input: OrderComposeInput,
  handlers: RunCheckoutHandlers,
  waWindow?: Window | null,
): Promise<RunCheckoutResult> {
  const { lockedToTable, orderType, redeemPoints, tableLabel, name, phone } = input;

  // Table orders: open or reuse a session before persisting.
  let activeSessionId = input.sessionId;
  if (lockedToTable) {
    try {
      const { createClient } = await import("@/lib/supabase-browser");
      const sb = createClient();
      const { data } = await sb.rpc("open_table_session", {
        p_restaurant_id: input.restaurant.id,
        p_table_label: tableLabel || "",
        p_customer_name: name || null,
        p_customer_phone: phone || null,
      });
      if (data) activeSessionId = data as string;
    } catch (err) {
      console.warn("[MenuLink v7] session open failed:", err);
    }
  }

  const payloadInput = { ...input, sessionId: activeSessionId };

  let saved: SavedOrder;
  try {
    saved = await persistOrder(payloadInput);
  } catch (err) {
    console.error("[MenuLink v7] submit_order failed:", err);
    // Nothing was saved, so don't leave the placeholder tab sitting there.
    if (waWindow && !waWindow.closed) waWindow.close();
    return { ok: false, ...classifyError(err) };
  }

  // The real per-day order number from the DB, so the customer, /admin/orders
  // and the POS note all quote the same thing. This used to be a throwaway
  // timestamp hash while submit_order's actual number was discarded.
  const orderNum = saved.orderNumber ?? "—";
  const msg = buildWhatsAppMessage(payloadInput, orderNum);

  const selectedBranch = input.branches.find((b) => b.id === input.selectedBranchId);
  const branchWa = selectedBranch?.whatsapp;
  const waNumber = String(branchWa || input.restaurant.whatsapp_phone).replace(/\D/g, "");
  openWhatsApp(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, waWindow);

  if (orderType === "car" && saved.orderId) {
    handlers.onCarOrderPlaced({ orderId: saved.orderId, plate: input.carPlate, color: input.carColor, arrived: false });
  }
  if (lockedToTable && activeSessionId) {
    handlers.onTableOrderPlaced(activeSessionId);
  }

  return { ok: true, orderId: saved.orderId, orderNumber: orderNum };
}

export type SavedOrder = { orderId: string | null; orderNumber: string | null };

/** Persists via the submit_order RPC. Throws on any failure — the caller decides. */
export async function persistOrder(input: OrderComposeInput): Promise<SavedOrder> {
  const { createClient } = await import("@/lib/supabase-browser");
  const sb = createClient();
  const { data, error } = await sb.rpc("submit_order", { p_order: buildSubmitPayload(input) });
  if (error) throw error;
  const row = data as { order_id?: string; daily_order_number?: string | number } | null;
  return {
    orderId: row?.order_id ?? null,
    orderNumber: row?.daily_order_number == null ? null : String(row.daily_order_number),
  };
}
