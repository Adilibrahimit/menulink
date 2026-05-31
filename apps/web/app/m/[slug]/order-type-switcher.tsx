"use client";

import { useState } from "react";
import type { OrderType, PublicBranch } from "./types";
import DeliveryCheckSheet from "./delivery-check-sheet";
import type { DeliveryContext } from "./order-context";

const TYPE_CONFIG: { key: OrderType; icon: string; label: string }[] = [
  { key: "delivery", icon: "🚗", label: "توصيل" },
  { key: "pickup", icon: "🏪", label: "استلام" },
  { key: "dine_in", icon: "🪑", label: "محلي" },
  { key: "car", icon: "🚙", label: "سيارة" },
];

export default function OrderTypeSwitcher({
  restaurantId,
  restaurantName,
  branches,
  orderType,
  tableLabel,
  onOrderTypeChange,
  onDeliveryConfirm,
  renderIcon,
  plain = false,
}: {
  restaurantId: string;
  restaurantName: string;
  branches: PublicBranch[];
  orderType: OrderType | null;
  tableLabel: string | null;
  onOrderTypeChange: (type: OrderType) => void;
  onDeliveryConfirm: (d: DeliveryContext) => void;
  // Opt-in (delivery-modern): swap the emoji icon for an SVG node, and drop the
  // sticky/bordered chrome so the switcher sits inline in a custom layout.
  // Omitted everywhere else → byte-identical to the original behavior.
  renderIcon?: (key: OrderType) => React.ReactNode;
  plain?: boolean;
}) {
  const [showDeliveryCheck, setShowDeliveryCheck] = useState(false);

  if (tableLabel) return null;

  const available = TYPE_CONFIG.filter((t) => {
    switch (t.key) {
      case "delivery": return branches.some((b) => b.supports_delivery);
      case "pickup": return branches.some((b) => b.supports_pickup);
      case "dine_in": return branches.some((b) => b.supports_dine_in);
      case "car": return branches.some((b) => b.supports_car);
      default: return false;
    }
  });

  if (available.length <= 1) return null;

  function handleTap(key: OrderType) {
    if (key === orderType) return;
    if (key === "delivery") {
      setShowDeliveryCheck(true);
      return;
    }
    onOrderTypeChange(key);
  }

  const buttons = (
    <div className={"flex overflow-x-auto " + (plain ? "gap-2" : "gap-1.5")}>
      {available.map((t) => {
        const on = t.key === orderType;
        return (
          <button
            key={t.key}
            onClick={() => handleTap(t.key)}
            className={
              plain
                ? "shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-semibold transition-all active:scale-95"
                : "shrink-0 h-9 px-3 rounded-full text-xs font-bold transition-all " +
                  (on
                    ? "bg-[var(--brand)] text-white shadow-sm"
                    : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300")
            }
            style={
              plain
                ? {
                    fontFamily: "var(--font-display)",
                    background: on ? "var(--brand)" : "var(--card-bg)",
                    color: on ? "#fff" : "var(--ink)",
                    border: on ? "1px solid var(--brand)" : "1px solid var(--ring)",
                    boxShadow: on ? "var(--shadow-pill)" : "none",
                  }
                : { fontFamily: "var(--font-display)" }
            }
          >
            {renderIcon ? renderIcon(t.key) : <span>{t.icon}</span>} {t.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {plain ? (
        buttons
      ) : (
        <div className="sticky top-0 z-20 bg-[var(--bg)] border-b border-neutral-200/60 px-4 py-2">
          {buttons}
        </div>
      )}

      {showDeliveryCheck && (
        <DeliveryCheckSheet
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          onConfirm={(d) => {
            setShowDeliveryCheck(false);
            onDeliveryConfirm(d);
            onOrderTypeChange("delivery");
          }}
          onSwitchPickup={() => {
            setShowDeliveryCheck(false);
            onOrderTypeChange("pickup");
          }}
          onClose={() => setShowDeliveryCheck(false)}
        />
      )}
    </>
  );
}
