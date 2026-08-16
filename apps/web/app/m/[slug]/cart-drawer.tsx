"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { normalizePhone } from "@/lib/phone";
import { toArabicDigits } from "@/lib/arabic";
import { fallbackToOriginal } from "@/lib/image-url";
import LocationPicker from "./location-picker";
import { useOrderContext } from "./order-context";
import SarSymbol from "./sar-symbol";
import { runCheckout, newClientRef, type OrderComposeInput } from "./checkout-core";
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
  onOrderPlaced,
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
  /** Fired for EVERY successful order so the guest tracker can pick it up. */
  onOrderPlaced?: (orderId: string | null, orderNumber: string) => void;
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
  // One per open drawer: retries after a failure reuse it (so they dedup), while
  // the next order gets a fresh drawer and therefore a fresh ref.
  const [clientRef] = useState(newClientRef);

  const hasMultipleBranches = branches.length > 1;
  // find_nearest_branch already resolved a branch from the customer's location
  // (multi-tier radius + polygon, migration 0052) and DeliveryContext has been
  // carrying the answer all along — it just never reached checkout, which
  // defaulted to is_default instead.
  const defaultBranch =
    (deliveryCtx && branches.find((b) => b.id === deliveryCtx.branchId)) ??
    branches.find((b) => b.is_default) ??
    branches[0];
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranch?.id ?? "");
  const nearestBranchId = deliveryCtx?.branchId ?? null;

  // Delivery is ROUTED, not chosen: deliveryFee and minOrder below come from the
  // zone resolved for deliveryCtx.branchId, so letting the customer submit to a
  // different branch shipped that branch's order at this branch's fee and
  // minimum. For delivery we therefore pin the resolved branch; for every other
  // order type the customer picks freely. (When no zone has resolved yet,
  // deliveryCtx is null and the picker stays open, so the cart is never stuck.)
  const branchPinnedByZone = orderType === "delivery" && !!nearestBranchId;

  const supportsOrderType = (b: PublicBranch) => {
    if (orderType === "delivery") return b.supports_delivery;
    if (orderType === "pickup") return b.supports_pickup;
    if (orderType === "dine_in") return b.supports_dine_in;
    if (orderType === "car") return b.supports_car;
    return true;
  };
  const selectableBranches = branches.filter(supportsOrderType);

  // Follow a zone that resolves while the drawer is open, unless the customer
  // already chose by hand. Only meaningful for delivery — the resolved branch is
  // the nearest to the DELIVERY ADDRESS, which says nothing about where someone
  // wants to collect an order.
  const [branchTouched, setBranchTouched] = useState(false);
  useEffect(() => {
    if (branchTouched || !nearestBranchId || orderType !== "delivery") return;
    if (!branches.some((b) => b.id === nearestBranchId)) return;
    setSelectedBranchId(nearestBranchId);
  }, [nearestBranchId, branchTouched, branches, orderType]);

  // Changing order type can strip the selected branch out of the list (it may
  // not support the new type). Fall back so the payload never carries a branch
  // the customer cannot see — the server rejects those anyway (0081).
  useEffect(() => {
    if (branchPinnedByZone) return; // the zone's answer wins for delivery
    if (selectableBranches.length === 0) return;
    if (selectableBranches.some((b) => b.id === selectedBranchId)) return;
    setSelectedBranchId(selectableBranches[0].id);
  }, [orderType, selectableBranches, selectedBranchId, branchPinnedByZone]);

  // The zone's minimum was fetched into DeliveryContext and then ignored, so a
  // 12 ر.س order sailed past a 35 ر.س minimum. Server re-checks it too.
  const minOrder = orderType === "delivery" && deliveryCtx ? deliveryCtx.minOrder : 0;
  const belowMinimum = minOrder > 0 && total < minOrder;

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
      setSubmitError("الرجاء إدخال رقم الجوال");
      return;
    }
    if (orderType === "delivery") {
      if (!address.trim()) {
        setSubmitError("الرجاء إدخال عنوان التوصيل");
        return;
      }
      if (!location) {
        setSubmitError("الرجاء تحديد موقع التوصيل على الخريطة (اضغط 'استخدم موقعي الحالي' أو اسحب الدبوس)");
        return;
      }
    }
    setSubmitting(true);

    // Claim the tab NOW, while the tap still counts as a user gesture. Opening
    // it after the awaits below is blocked on iOS Safari, which silently cost
    // the restaurant the WhatsApp message. See openWhatsApp in checkout-core.
    const waWindow = typeof window !== "undefined" ? window.open("", "_blank") : null;

    const input: OrderComposeInput = {
      restaurant,
      branches,
      selectedBranchId,
      hasMultipleBranches,
      lines,
      orderType,
      name,
      rawPhone,
      phone: normalizePhone(rawPhone),
      address,
      location,
      carPlate: carPlate.trim(),
      carColor: carColor.trim(),
      notes,
      tableLabel: lockedToTable ? (tableLabel ?? "") : "",
      lockedToTable,
      sessionId,
      subtotal: total,
      deliveryFee,
      redeemPoints,
      discountAmount,
      finalTotal,
      clientRef,
    };

    const result = await runCheckout(input, { onCarOrderPlaced, onTableOrderPlaced }, waWindow);
    // Any failure now keeps the cart intact and reports why — the order was NOT
    // saved, so clearing the cart and closing would be lying to the customer.
    if (!result.ok) {
      setSubmitError(result.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onOrderPlaced?.(result.orderId, result.orderNumber);
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
                <img src={l.imageUrl} alt={l.itemName} className="w-14 h-14 rounded-lg object-cover" onError={fallbackToOriginal} />
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

              {/* Branch picker — multi-branch restaurants only. For delivery the
                  branch is decided by the customer's zone, so it is shown as a
                  result rather than a choice. */}
              {hasMultipleBranches && !lockedToTable && branchPinnedByZone && (
                <div className="rounded-2xl bg-neutral-50 border border-neutral-200 px-3 py-3 flex items-center gap-2">
                  <span className="text-2xl">🏢</span>
                  <div className="flex-1 min-w-0 text-sm leading-snug">
                    <div className="font-extrabold text-neutral-900" style={{ fontFamily: "var(--font-display)" }}>
                      {branches.find((b) => b.id === selectedBranchId)?.name_ar ?? deliveryCtx?.branchNameAr}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      الفرع الذي يخدم عنوانك · {toArabicDigits(deliveryCtx!.distanceKm.toFixed(1))} كم
                    </div>
                  </div>
                </div>
              )}
              {hasMultipleBranches && !lockedToTable && !branchPinnedByZone && (
                <fieldset className="space-y-2">
                  <legend className="text-xs font-extrabold text-neutral-700 mb-1">
                    {orderType === "pickup" ? "اختر فرع الاستلام" : "اختر الفرع"}
                  </legend>
                  <div className="space-y-1.5">
                    {selectableBranches
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => { setBranchTouched(true); setSelectedBranchId(b.id); }}
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
                            {b.id === nearestBranchId ? (
                              <span className="text-[9px] bg-[var(--brand)]/10 text-[var(--brand)] font-bold rounded-full px-1.5 py-0.5">
                                الأقرب لك · {toArabicDigits(deliveryCtx!.distanceKm.toFixed(1))} كم
                              </span>
                            ) : b.is_default ? (
                              <span className="text-[9px] bg-neutral-100 text-neutral-500 rounded-full px-1.5 py-0.5">
                                رئيسي
                              </span>
                            ) : null}
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
            {belowMinimum && (
              <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 font-bold text-center">
                الحد الأدنى للتوصيل {toArabicDigits(String(minOrder))} ر.س — أضف{" "}
                {toArabicDigits((minOrder - total).toFixed(2))} ر.س
              </div>
            )}
            <button
              onClick={() => { setSubmitError(null); submit(); }}
              disabled={submitting || belowMinimum}
              className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold text-base hover:opacity-90 disabled:opacity-60 active:translate-y-px shadow-md"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {submitting ? "جاري التأكيد..." : "تأكيد الطلب"}
            </button>
            <p className="mt-2 text-[11px] text-neutral-500 text-center">
              بعد التأكيد سيُفتح واتساب لإرسال الطلب للمطعم
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
