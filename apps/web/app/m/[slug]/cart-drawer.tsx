"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { normalizePhone } from "@/lib/phone";
import { toArabicDigits } from "@/lib/arabic";
import LocationPicker from "./location-picker";
import { usePreselectedOrderType } from "./order-context";
import SarSymbol from "./sar-symbol";
import type { PublicMenu, CartLine, OrderType } from "./types";
import type { TrackingState } from "./tracking-sheet";

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  details: string | null;
  is_default: boolean;
};

const LABEL_AR: Record<string, string> = {
  home: "المنزل",
  office: "المكتب",
  custom: "مخصص",
};

export default function CartDrawer({
  restaurant,
  lines,
  total,
  tableLabel,
  loyaltyPointsPerSar,
  onClose,
  onAdjust,
  onClear,
  onCarOrderPlaced,
}: {
  restaurant: PublicMenu["restaurant"];
  lines: CartLine[];
  total: number;
  tableLabel: string | null;
  loyaltyPointsPerSar: number | null;
  onClose: () => void;
  onAdjust: (lineId: string, delta: number) => void;
  onClear: () => void;
  onCarOrderPlaced: (t: TrackingState) => void;
}) {
  const preselected = usePreselectedOrderType();
  const lockedToTable = !!tableLabel;
  const [orderType, setOrderType] = useState<OrderType>(
    lockedToTable ? "dine_in" : preselected ?? "delivery"
  );
  const [name, setName] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [carPlate, setCarPlate] = useState("");
  const [carColor, setCarColor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Auto-fill from customer record + load saved addresses
  useEffect(() => {
    if (prefilled) return;
    const sb = createClient();
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        // Guest mode: try localStorage
        try {
          const g = JSON.parse(localStorage.getItem("menulink:guest") || "{}");
          if (g.phone) setRawPhone(g.phone);
          if (g.name) setName(g.name);
        } catch {}
        setPrefilled(true);
        return;
      }
      // Signed-in: fetch customer + addresses
      const { data: c } = await sb
        .from("customers")
        .select("id, name, phone")
        .eq("auth_user_id", session.user.id)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();
      if (c) {
        if (c.name) setName(c.name as string);
        if (c.phone) setRawPhone(c.phone as string);
        const { data: addrs } = await sb
          .from("customer_addresses")
          .select("id, label, address, lat, lng, details, is_default")
          .eq("customer_id", c.id)
          .order("is_default", { ascending: false });
        if (addrs && addrs.length > 0) {
          const mapped = addrs.map((a) => ({
            id: a.id as string,
            label: a.label as string,
            address: a.address as string,
            lat: a.lat as number | null,
            lng: a.lng as number | null,
            details: (a.details as string | null) ?? null,
            is_default: a.is_default as boolean,
          }));
          setSavedAddresses(mapped);
          const def = mapped.find((a) => a.is_default) || mapped[0];
          setSelectedAddressId(def.id);
          setAddress(def.address + (def.details ? ` · ${def.details}` : ""));
          if (def.lat && def.lng) setLocation({ lat: def.lat, lng: def.lng });
        }
      }
      setPrefilled(true);
    });
  }, [restaurant.id, prefilled]);

  const orderTypeLabel: Record<OrderType, string> = {
    delivery: "توصيل",
    pickup: "استلام",
    dine_in: "في المطعم",
    car: "استلام بالسيارة",
  };

  async function submit() {
    if (lines.length === 0) return;
    if (!rawPhone.trim()) {
      alert("الرجاء إدخال رقم الجوال");
      return;
    }
    if (orderType === "delivery") {
      if (!address.trim()) {
        alert("الرجاء إدخال عنوان التوصيل");
        return;
      }
      if (!location) {
        alert("الرجاء تحديد موقع التوصيل على الخريطة (اضغط 'استخدم موقعي الحالي' أو اسحب الدبوس)");
        return;
      }
    }
    setSubmitting(true);
    const phone = normalizePhone(rawPhone);
    const plate = carPlate.trim();
    const color = carColor.trim();

    const persistArgs = {
      restaurantId: restaurant.id,
      phone,
      name,
      address: orderType === "delivery" ? address : "",
      lat: orderType === "delivery" ? location?.lat ?? null : null,
      lng: orderType === "delivery" ? location?.lng ?? null : null,
      notes,
      orderType,
      carPlate: orderType === "car" ? plate : "",
      carColor: orderType === "car" ? color : "",
      tableLabel: lockedToTable ? (tableLabel ?? "") : "",
      lines,
      total,
    };

    // For car orders we need the order_id from the RPC so the customer
    // can tap "I've arrived" later — await persist so we capture it.
    // Other order types stay fire-and-forget (WhatsApp opens even if
    // Supabase is unreachable; nothing depends on the id).
    let carOrderId: string | null = null;
    if (orderType === "car") {
      try {
        const result = await persistOrder(persistArgs);
        carOrderId = result.orderId;
      } catch (err) {
        console.warn("[MenuLink v7] persist failed:", err);
      }
    } else {
      persistOrder(persistArgs).catch((err) =>
        console.warn("[MenuLink v7] persist failed:", err),
      );
    }

    const lineList = lines
      .map((l, i) => {
        const v = l.variantLabel ? ` (${l.variantLabel})` : "";
        let line = `${toArabicDigits(String(i + 1))}. ${l.itemName}${v}  ×${toArabicDigits(String(l.qty))}  =  ${toArabicDigits(String(l.price * l.qty))} ر.س`;
        if (l.modifiers && l.modifiers.length > 0) {
          for (const m of l.modifiers) {
            line += `\n   ${m.groupLabel}: ${m.selected.join("، ")}`;
          }
        }
        if (l.itemNote) {
          line += `\n   ملاحظة: ${l.itemNote}`;
        }
        return line;
      })
      .join("\n");

    const mapsLink =
      orderType === "delivery" && location
        ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
        : null;

    const msg =
      `🌟 *طلب جديد · ${restaurant.name}* 🌟\n` +
      `━━━━━━━━━━━━━━━━\n` +
      (lockedToTable ? `🪑 *الطاولة:* ${tableLabel}\n` : "") +
      `📦 *نوع الطلب:* ${orderTypeLabel[orderType]}\n` +
      `👤 *الاسم:* ${name || "—"}\n` +
      `📞 *الجوال:* ${rawPhone || "—"}\n` +
      (orderType === "delivery" && address ? `📍 *العنوان:* ${address}\n` : "") +
      (mapsLink ? `🗺️ *الموقع على الخريطة:* ${mapsLink}\n` : "") +
      (orderType === "car" && plate ? `🚗 *رقم اللوحة:* ${plate}\n` : "") +
      (orderType === "car" && color ? `🎨 *لون السيارة:* ${color}\n` : "") +
      `━━━━━━━━━━━━━━━━\n` +
      `🛒 *الطلبات:*\n${lineList}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 *المجموع: ${toArabicDigits(String(total))} ر.س*\n` +
      (notes ? `📝 *ملاحظات:* ${notes}\n` : "") +
      `━━━━━━━━━━━━━━━━\n` +
      `شكراً لاختياركم ${restaurant.name} 🙏`;

    const waNumber = String(restaurant.whatsapp_phone).replace(/\D/g, "");
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");

    if (orderType === "car" && carOrderId) {
      onCarOrderPlaced({ orderId: carOrderId, plate, color, arrived: false });
    }

    setSubmitting(false);
    onClear();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="relative ml-auto h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2
            className="font-extrabold text-lg"
            style={{ fontFamily: "var(--font-display)" }}
          >
            السلة
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {lines.length === 0 && (
            <p className="text-center text-neutral-500 text-sm py-8">السلة فارغة.</p>
          )}
          {lines.map((l) => (
            <div key={l.lineId} className="flex items-center gap-3 bg-neutral-50 rounded-xl p-2">
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.imageUrl} alt={l.itemName} className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-neutral-200 flex items-center justify-center text-xl">🍽️</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold truncate" style={{ fontFamily: "var(--font-display)" }}>
                  {l.itemName}
                  {l.variantLabel && (
                    <span className="text-xs text-neutral-500 font-normal mr-1">· {l.variantLabel}</span>
                  )}
                </div>
                {l.modifiers && l.modifiers.length > 0 && (
                  <div className="text-[10px] text-neutral-500 mt-0.5 leading-snug space-y-0.5">
                    {l.modifiers.map((m) => (
                      <div key={m.groupKey}>
                        <span className="font-semibold">{m.groupLabel}:</span>{" "}
                        {m.selected.join("، ")}
                      </div>
                    ))}
                  </div>
                )}
                {l.itemNote && (
                  <div className="text-[10px] text-neutral-400 mt-0.5 truncate">
                    ملاحظة: {l.itemNote}
                  </div>
                )}
                <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-0.5">
                  {toArabicDigits(String(l.price * l.qty))} <SarSymbol size={11} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onAdjust(l.lineId, -1)}
                  className="w-8 h-8 rounded-full bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300"
                  aria-label="إنقاص"
                >
                  −
                </button>
                <span className="w-6 text-center font-extrabold text-sm">
                  {toArabicDigits(String(l.qty))}
                </span>
                <button
                  onClick={() => onAdjust(l.lineId, 1)}
                  className="w-8 h-8 rounded-full bg-[var(--brand)] text-white font-bold"
                  aria-label="إضافة"
                >
                  +
                </button>
              </div>
            </div>
          ))}

          {lines.length > 0 && (
            <>
              <hr className="border-neutral-200" />
              {lockedToTable ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-3 py-3 flex items-center gap-2">
                  <span className="text-2xl">🪑</span>
                  <div className="flex-1 min-w-0 text-sm leading-snug">
                    <div className="font-extrabold text-amber-900" style={{ fontFamily: "var(--font-display)" }}>
                      طاولة {tableLabel}
                    </div>
                    <div className="text-xs text-amber-800/80">سيُسلَّم طلبك على هذه الطاولة</div>
                  </div>
                </div>
              ) : preselected ? (
                <div className="rounded-2xl bg-neutral-50 border border-neutral-200 px-3 py-3 flex items-center gap-2">
                  <span className="text-2xl">{orderType === "delivery" ? "🚗" : orderType === "pickup" ? "🏪" : orderType === "car" ? "🚙" : "🪑"}</span>
                  <div className="flex-1 min-w-0 text-sm leading-snug">
                    <div className="font-extrabold text-neutral-900" style={{ fontFamily: "var(--font-display)" }}>
                      {orderTypeLabel[orderType]}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try { localStorage.removeItem(`menulink:orderType:${restaurant.id}`); } catch {}
                      window.location.reload();
                    }}
                    className="text-xs text-[var(--brand)] font-bold"
                  >
                    تغيير
                  </button>
                </div>
              ) : (
                <fieldset className="space-y-3">
                  <legend className="text-xs font-extrabold text-neutral-700 mb-2">نوع الطلب</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(["delivery", "pickup", "dine_in", "car"] as OrderType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setOrderType(t)}
                        className={
                          "h-11 rounded-xl text-sm font-extrabold border-2 transition-colors " +
                          (orderType === t
                            ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                            : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300")
                        }
                      >
                        {orderTypeLabel[t]}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="space-y-3 pt-1">
                <input
                  type="text"
                  placeholder="الاسم (اختياري)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                />
                <input
                  type="tel"
                  placeholder="رقم الجوال"
                  value={rawPhone}
                  onChange={(e) => setRawPhone(e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                  dir="ltr"
                />
                {orderType === "delivery" && (
                  <>
                    {savedAddresses.length > 0 ? (
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-neutral-700">عنوان التوصيل</label>
                        <div className="space-y-2">
                          {savedAddresses.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => {
                                setSelectedAddressId(a.id);
                                setAddress(a.address + (a.details ? ` · ${a.details}` : ""));
                                if (a.lat && a.lng) setLocation({ lat: a.lat, lng: a.lng });
                                else setLocation(null);
                              }}
                              className={
                                "w-full text-right rounded-xl border-2 px-3 py-2.5 transition-colors " +
                                (selectedAddressId === a.id
                                  ? "border-[var(--brand)] bg-[var(--brand)]/5"
                                  : "border-neutral-200 bg-white hover:border-neutral-300")
                              }
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {a.label === "home" ? "🏠" : a.label === "office" ? "🏢" : "📍"}
                                </span>
                                <span className="text-sm font-bold text-neutral-800" style={{ fontFamily: "var(--font-display)" }}>
                                  {LABEL_AR[a.label] ?? a.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-500 mt-0.5 mr-6 truncate">{a.address}</p>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAddressId(null);
                            setAddress("");
                            setLocation(null);
                          }}
                          className="text-xs text-[var(--brand)] font-bold hover:underline"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          + عنوان جديد
                        </button>
                        {!selectedAddressId && (
                          <>
                            <input
                              type="text"
                              placeholder="عنوان التوصيل (الحي · الشارع · رقم المبنى)"
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                            />
                            <LocationPicker initial={location} onChange={setLocation} />
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="عنوان التوصيل (الحي · الشارع · رقم المبنى)"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                        />
                        <LocationPicker initial={location} onChange={setLocation} />
                      </>
                    )}
                  </>
                )}
                {orderType === "car" && (
                  <>
                    <input
                      type="text"
                      placeholder="رقم لوحة السيارة (اختياري)"
                      value={carPlate}
                      onChange={(e) => setCarPlate(e.target.value)}
                      className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                    />
                    <input
                      type="text"
                      placeholder="لون السيارة (اختياري)"
                      value={carColor}
                      onChange={(e) => setCarColor(e.target.value)}
                      className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                    />
                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                      عند وصولك إلى المطعم اضغط زر "وصلت" في الأسفل ليصلهم إشعار فوري.
                    </p>
                  </>
                )}
                <input
                  type="text"
                  placeholder="ملاحظات (اختياري)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                />
              </div>
            </>
          )}
        </div>

        {lines.length > 0 && (
          <footer className="p-4 border-t border-neutral-200 bg-white">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-neutral-500">المجموع</span>
              <span
                className="font-extrabold text-xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {toArabicDigits(String(total))} <SarSymbol size={20} />
              </span>
            </div>
            {loyaltyPointsPerSar != null && loyaltyPointsPerSar > 0 && rawPhone.trim() && (() => {
              const earn = Math.floor(total * loyaltyPointsPerSar);
              if (earn <= 0) return null;
              return (
                <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  <span className="text-xs font-extrabold text-amber-900 leading-snug" style={{ fontFamily: "var(--font-display)" }}>
                    ستربح {toArabicDigits(String(earn))} نقطة من هذا الطلب
                  </span>
                </div>
              );
            })()}
            {loyaltyPointsPerSar != null && loyaltyPointsPerSar > 0 && (
              <a
                href={`/m/${restaurant.slug}/account`}
                className="mb-3 flex items-center justify-between gap-2 rounded-xl border-2 border-dashed border-neutral-200 px-3 py-2 hover:border-neutral-300 active:translate-y-px"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">🔗</span>
                  <span className="text-xs font-bold text-neutral-700 leading-snug" style={{ fontFamily: "var(--font-display)" }}>
                    احفظ نقاطك مع حساب Google
                  </span>
                </span>
                <span className="text-neutral-400 text-sm">←</span>
              </a>
            )}
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold text-base hover:opacity-90 disabled:opacity-60 active:translate-y-px shadow-md"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {submitting ? "جاري الإرسال..." : "إرسال الطلب عبر واتساب"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

async function persistOrder({
  restaurantId,
  phone,
  name,
  address,
  lat,
  lng,
  notes,
  orderType,
  carPlate,
  carColor,
  tableLabel,
  lines,
  total,
}: {
  restaurantId: string;
  phone: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  orderType: OrderType;
  carPlate: string;
  carColor: string;
  tableLabel: string;
  lines: CartLine[];
  total: number;
}): Promise<{ orderId: string | null }> {
  const sb = createClient();
  const payload = {
    restaurant_id: restaurantId,
    phone,
    name: name || null,
    address: orderType === "delivery" ? (address || null) : null,
    lat,
    lng,
    order_type: orderType,
    channel: "whatsapp",
    subtotal: total,
    delivery_fee: 0,
    total,
    notes: notes || null,
    car_plate: orderType === "car" ? (carPlate || null) : null,
    car_color: orderType === "car" ? (carColor || null) : null,
    table_label: tableLabel || null,
    items: lines.map((l) => {
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
  const { data, error } = await sb.rpc("submit_order", { p_order: payload });
  if (error) throw error;
  const orderId = (data as { order_id?: string } | null)?.order_id ?? null;
  return { orderId };
}
