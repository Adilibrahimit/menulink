"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { normalizePhone } from "@/lib/phone";
import { toArabicDigits } from "@/lib/arabic";
import LocationPicker from "./location-picker";
import { useOrderContext } from "./order-context";
import SarSymbol from "./sar-symbol";
import type { PublicMenu, PublicBranch, CartLine, OrderType } from "./types";
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
  branches,
  lines,
  total,
  tableLabel,
  loyaltyPointsPerSar,
  redemptionValueSar,
  sessionId,
  onClose,
  onAdjust,
  onClear,
  onCarOrderPlaced,
  onTableOrderPlaced,
}: {
  restaurant: PublicMenu["restaurant"];
  branches: PublicBranch[];
  lines: CartLine[];
  total: number;
  tableLabel: string | null;
  loyaltyPointsPerSar: number | null;
  redemptionValueSar: number;
  sessionId: string | null;
  onClose: () => void;
  onAdjust: (lineId: string, delta: number) => void;
  onClear: () => void;
  onCarOrderPlaced: (t: TrackingState) => void;
  onTableOrderPlaced: (sessionId: string) => void;
}) {
  const { orderType: preselected, delivery: deliveryCtx } = useOrderContext();
  const lockedToTable = !!tableLabel;
  const [orderType, setOrderType] = useState<OrderType>(
    lockedToTable ? "dine_in" : preselected ?? "delivery"
  );
  const deliveryFee = orderType === "delivery" && deliveryCtx ? deliveryCtx.deliveryFee : 0;
  const [name, setName] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [address, setAddress] = useState(deliveryCtx?.address ?? "");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    deliveryCtx ? { lat: deliveryCtx.lat, lng: deliveryCtx.lng } : null
  );
  const [carPlate, setCarPlate] = useState("");
  const [carColor, setCarColor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasMultipleBranches = branches.length > 1;
  const defaultBranch = branches.find((b) => b.is_default) ?? branches[0];
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranch?.id ?? "");

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
        .select("id, name, phone, loyalty_points_balance")
        .eq("auth_user_id", session.user.id)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();
      if (c) {
        if (c.name) setName(c.name as string);
        if (c.phone) setRawPhone(c.phone as string);
        if (c.loyalty_points_balance) setPointsBalance(Number(c.loyalty_points_balance));
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

  const canRedeem = usePoints && pointsBalance > 0 && redemptionValueSar > 0;
  const maxRedeemPoints = redemptionValueSar > 0
    ? Math.min(pointsBalance, Math.floor((total + deliveryFee) / redemptionValueSar))
    : 0;
  const redeemPoints = canRedeem ? maxRedeemPoints : 0;
  const discountAmount = redeemPoints * redemptionValueSar;
  const finalTotal = total + deliveryFee - discountAmount;

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

    // For table orders: open or reuse a session
    let activeSessionId = sessionId;
    if (lockedToTable) {
      try {
        const sb = createClient();
        const { data } = await sb.rpc("open_table_session", {
          p_restaurant_id: restaurant.id,
          p_table_label: tableLabel ?? "",
          p_customer_name: name || null,
          p_customer_phone: phone || null,
        });
        if (data) activeSessionId = data as string;
      } catch (err) {
        console.warn("[MenuLink v7] session open failed:", err);
      }
    }

    const persistArgs = {
      restaurantId: restaurant.id,
      branchId: selectedBranchId || null,
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
      sessionId: activeSessionId,
      lines,
      total,
      deliveryFee,
      redeemPoints,
    };

    // Await persist when redeeming points (must confirm deduction before WhatsApp),
    // car orders (need order_id for tracking), or table orders (session link).
    // Otherwise fire-and-forget.
    let carOrderId: string | null = null;
    const mustAwait = redeemPoints > 0 || orderType === "car" || lockedToTable;
    if (mustAwait) {
      try {
        const result = await persistOrder(persistArgs);
        carOrderId = result.orderId;
      } catch (err) {
        console.warn("[MenuLink v7] persist failed:", err);
        if (redeemPoints > 0) {
          setSubmitError("فشل خصم النقاط. حاول مرة أخرى.");
          setSubmitting(false);
          return;
        }
      }
    } else {
      persistOrder(persistArgs).catch((err) =>
        console.warn("[MenuLink v7] persist failed:", err),
      );
    }

    const orderNum = Date.now().toString(36).toUpperCase().slice(-6);

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

    const msg =
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
      (orderType === "car" && plate ? `🚗 *رقم اللوحة:* ${plate}\n` : "") +
      (orderType === "car" && color ? `🎨 *لون السيارة:* ${color}\n` : "") +
      `━━━━━━━━━━━━━━━━\n` +
      `🛒 *تفاصيل الطلب (${toArabicDigits(String(lines.length))} أصناف):*\n\n${lineList}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      (deliveryFee > 0 ? `🚗 *رسوم التوصيل: ${toArabicDigits(deliveryFee.toFixed(2))} ر.س*\n` : "") +
      (discountAmount > 0 ? `🎁 *خصم النقاط:* -${toArabicDigits(discountAmount.toFixed(2))} ر.س (${toArabicDigits(String(redeemPoints))} نقطة)\n` : "") +
      `💰 *المجموع: ${toArabicDigits(finalTotal.toFixed(2))} ر.س*\n` +
      (notes ? `📝 *ملاحظات عامة:* ${notes}\n` : "") +
      `━━━━━━━━━━━━━━━━\n` +
      `✅ شكراً لاختياركم *${restaurant.name}* 🙏`;

    const branchWa = selectedBranch?.whatsapp;
    const waNumber = String(branchWa || restaurant.whatsapp_phone).replace(/\D/g, "");
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");

    if (orderType === "car" && carOrderId) {
      onCarOrderPlaced({ orderId: carOrderId, plate, color, arrived: false });
    }

    if (lockedToTable && activeSessionId) {
      onTableOrderPlaced(activeSessionId);
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

              {/* Branch picker — shown only for multi-branch restaurants */}
              {hasMultipleBranches && !lockedToTable && (
                <fieldset className="space-y-2">
                  <legend className="text-xs font-extrabold text-neutral-700 mb-1">
                    {orderType === "pickup" ? "اختر فرع الاستلام" : "اختر الفرع"}
                  </legend>
                  <div className="space-y-1.5">
                    {branches
                      .filter((b) => {
                        if (orderType === "delivery") return b.supports_delivery;
                        if (orderType === "pickup") return b.supports_pickup;
                        if (orderType === "dine_in") return b.supports_dine_in;
                        if (orderType === "car") return b.supports_car;
                        return true;
                      })
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBranchId(b.id)}
                          className={
                            "w-full text-right rounded-xl border-2 px-3 py-2.5 transition-colors " +
                            (selectedBranchId === b.id
                              ? "border-[var(--brand)] bg-[var(--brand)]/5"
                              : "border-neutral-200 bg-white hover:border-neutral-300")
                          }
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">🏢</span>
                            <span className="text-sm font-bold text-neutral-800" style={{ fontFamily: "var(--font-display)" }}>
                              {b.name_ar}
                            </span>
                            {b.is_default && (
                              <span className="text-[9px] bg-neutral-100 text-neutral-500 rounded-full px-1.5 py-0.5">
                                رئيسي
                              </span>
                            )}
                          </div>
                          {b.address_ar && (
                            <p className="text-[11px] text-neutral-500 mt-0.5 mr-6 truncate">
                              📍 {b.address_ar}
                            </p>
                          )}
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
            {(deliveryFee > 0 || discountAmount > 0) && (
              <div className="flex items-center justify-between mb-1 text-xs text-neutral-500">
                <span>المجموع الفرعي</span>
                <span>{toArabicDigits(total.toFixed(2))} <SarSymbol size={11} /></span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex items-center justify-between mb-1 text-xs text-neutral-500">
                <span>رسوم التوصيل</span>
                <span>{toArabicDigits(deliveryFee.toFixed(2))} <SarSymbol size={11} /></span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between mb-1 text-xs text-green-700 font-bold">
                <span>خصم النقاط ({toArabicDigits(String(redeemPoints))} نقطة)</span>
                <span>-{toArabicDigits(discountAmount.toFixed(2))} <SarSymbol size={11} /></span>
              </div>
            )}
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-neutral-500">المجموع</span>
              <span
                className="font-extrabold text-xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {toArabicDigits(finalTotal.toFixed(2))} <SarSymbol size={20} />
              </span>
            </div>
            {/* Points redemption toggle */}
            {pointsBalance > 0 && redemptionValueSar > 0 && (
              <button
                type="button"
                onClick={() => setUsePoints((p) => !p)}
                className={
                  "mb-3 w-full rounded-xl border-2 px-3 py-2.5 flex items-center gap-2 transition-colors " +
                  (usePoints
                    ? "border-green-500 bg-green-50"
                    : "border-neutral-200 bg-white hover:border-neutral-300")
                }
              >
                <span className="text-xl">{usePoints ? "✅" : "🎁"}</span>
                <span className="flex-1 text-right">
                  <span className="text-sm font-extrabold text-neutral-900 block" style={{ fontFamily: "var(--font-display)" }}>
                    {usePoints ? "تم تفعيل خصم النقاط" : "استخدم نقاطك"}
                  </span>
                  <span className="text-[11px] text-neutral-500 block mt-0.5">
                    لديك {toArabicDigits(String(pointsBalance))} نقطة = خصم حتى {toArabicDigits((maxRedeemPoints * redemptionValueSar).toFixed(0))} ر.س
                  </span>
                </span>
              </button>
            )}
            {loyaltyPointsPerSar != null && loyaltyPointsPerSar > 0 && rawPhone.trim() && !usePoints && (() => {
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
            {loyaltyPointsPerSar != null && loyaltyPointsPerSar > 0 && pointsBalance === 0 && (
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
            {submitError && (
              <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 font-bold text-center">
                {submitError}
              </div>
            )}
            <button
              onClick={() => { setSubmitError(null); submit(); }}
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
  branchId,
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
  sessionId,
  lines,
  total,
  deliveryFee,
  redeemPoints,
}: {
  restaurantId: string;
  branchId: string | null;
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
  sessionId: string | null;
  lines: CartLine[];
  total: number;
  deliveryFee: number;
  redeemPoints: number;
}): Promise<{ orderId: string | null }> {
  const sb = createClient();
  const payload = {
    restaurant_id: restaurantId,
    branch_id: branchId || null,
    phone,
    name: name || null,
    address: orderType === "delivery" ? (address || null) : null,
    lat,
    lng,
    order_type: orderType,
    channel: "whatsapp",
    subtotal: total,
    delivery_fee: deliveryFee,
    total: total + deliveryFee,
    notes: notes || null,
    car_plate: orderType === "car" ? (carPlate || null) : null,
    car_color: orderType === "car" ? (carColor || null) : null,
    table_label: tableLabel || null,
    session_id: sessionId || null,
    redeem_points: redeemPoints > 0 ? redeemPoints : undefined,
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
