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
}: {
  restaurantId: string;
  restaurantName: string;
  branches: PublicBranch[];
  orderType: OrderType | null;
  tableLabel: string | null;
  onOrderTypeChange: (type: OrderType) => void;
  onDeliveryConfirm: (d: DeliveryContext) => void;
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

  return (
    <>
      <div className="sticky top-0 z-20 bg-[var(--bg)] border-b border-neutral-200/60 px-4 py-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {available.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTap(t.key)}
              className={
                "shrink-0 h-9 px-3 rounded-full text-xs font-bold transition-all " +
                (t.key === orderType
                  ? "bg-[var(--brand)] text-white shadow-sm"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300")
              }
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

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
