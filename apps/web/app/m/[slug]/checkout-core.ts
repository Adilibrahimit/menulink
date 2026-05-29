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
};

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
    deliveryFee, redeemPoints,
  } = input;

  return {
    restaurant_id: restaurant.id,
    branch_id: selectedBranchId || null,
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

export type RunCheckoutResult = { ok: true } | { ok: false; error: "points" };

// Orchestrates a submit using the pure builders above. Returns {ok:false,
// error:"points"} when a points-redemption order failed to persist (caller
// must surface that and NOT open WhatsApp). All other persist failures are
// non-blocking (fail-open: WhatsApp still opens) — preserving CartDrawer's
// original behavior.
export async function runCheckout(
  input: OrderComposeInput,
  handlers: RunCheckoutHandlers,
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

  // Await persist when redeeming points (confirm deduction before WhatsApp),
  // car orders (need order_id for tracking) or table orders (session link).
  let carOrderId: string | null = null;
  const mustAwait = redeemPoints > 0 || orderType === "car" || lockedToTable;
  if (mustAwait) {
    try {
      carOrderId = await persistOrder(payloadInput);
    } catch (err) {
      console.warn("[MenuLink v7] persist failed:", err);
      if (redeemPoints > 0) {
        return { ok: false, error: "points" };
      }
    }
  } else {
    persistOrder(payloadInput).catch((err) =>
      console.warn("[MenuLink v7] persist failed:", err),
    );
  }

  const orderNum = Date.now().toString(36).toUpperCase().slice(-6);
  const msg = buildWhatsAppMessage(payloadInput, orderNum);

  const selectedBranch = input.branches.find((b) => b.id === input.selectedBranchId);
  const branchWa = selectedBranch?.whatsapp;
  const waNumber = String(branchWa || input.restaurant.whatsapp_phone).replace(/\D/g, "");
  window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");

  if (orderType === "car" && carOrderId) {
    handlers.onCarOrderPlaced({ orderId: carOrderId, plate: input.carPlate, color: input.carColor, arrived: false });
  }
  if (lockedToTable && activeSessionId) {
    handlers.onTableOrderPlaced(activeSessionId);
  }

  return { ok: true };
}

// Persists via the submit_order RPC. Returns the new order id (or null).
export async function persistOrder(input: OrderComposeInput): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase-browser");
  const sb = createClient();
  const { data, error } = await sb.rpc("submit_order", { p_order: buildSubmitPayload(input) });
  if (error) throw error;
  return (data as { order_id?: string } | null)?.order_id ?? null;
}
