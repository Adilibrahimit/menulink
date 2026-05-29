"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { normalizePhone } from "@/lib/phone";
import { toArabicDigits } from "@/lib/arabic";
import LocationPicker from "./location-picker";
import { useOrderContext } from "./order-context";
import SarSymbol from "./sar-symbol";
import { runCheckout, orderTypeLabel, vatIncluded, type OrderComposeInput } from "./checkout-core";
import type { PublicMenu, PublicBranch, CartLine, OrderType } from "./types";
import type { TrackingState } from "./tracking-sheet";

// Premium Epicurean checkout — a dark/gold, full-page two-step flow that
// replaces the light CartDrawer when theme.menuLayout === "premium-epicurean".
// Step 1 "اختياراتك" (selections): review lines + quantity steppers + summary.
// Step 2 "إتمام الطلب" (checkout): contact + location/branch + summary + send.
//
// Ordering state is intentionally local here (cheap to duplicate, no money
// mutation); the money/order path (totals, WhatsApp message, submit_order
// payload) is shared with CartDrawer via checkout-core.runCheckout so the two
// presentations can never diverge. MenuLink is VAT-INCLUSIVE: no 15% is added —
// the VAT line is informational (vatIncluded). Delivery fee shows on step 2.

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  details: string | null;
  is_default: boolean;
};

const LABEL_AR: Record<string, string> = { home: "المنزل", office: "المكتب", custom: "مخصص" };

export default function PremiumCheckoutFlow({
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

  const [step, setStep] = useState<"select" | "checkout">("select");
  const [orderType, setOrderType] = useState<OrderType>(
    lockedToTable ? "dine_in" : preselected ?? "delivery",
  );
  const deliveryFee = orderType === "delivery" && deliveryCtx ? deliveryCtx.deliveryFee : 0;
  const [name, setName] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [address, setAddress] = useState(deliveryCtx?.address ?? "");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    deliveryCtx ? { lat: deliveryCtx.lat, lng: deliveryCtx.lng } : null,
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

  // Auto-fill contact + saved addresses from the customer record (or guest).
  useEffect(() => {
    if (prefilled) return;
    const sb = createClient();
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        try {
          const g = JSON.parse(localStorage.getItem("menulink:guest") || "{}");
          if (g.phone) setRawPhone(g.phone);
          if (g.name) setName(g.name);
        } catch {}
        setPrefilled(true);
        return;
      }
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
  const maxRedeemPoints =
    redemptionValueSar > 0
      ? Math.min(pointsBalance, Math.floor((total + deliveryFee) / redemptionValueSar))
      : 0;
  const redeemPoints = canRedeem ? maxRedeemPoints : 0;
  const discountAmount = redeemPoints * redemptionValueSar;
  const finalTotal = total + deliveryFee - discountAmount;

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
        setSubmitError("الرجاء تحديد موقع التوصيل على الخريطة");
        return;
      }
    }
    setSubmitError(null);
    setSubmitting(true);

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
    };

    const result = await runCheckout(input, { onCarOrderPlaced, onTableOrderPlaced });
    if (!result.ok && result.error === "points") {
      setSubmitError("فشل خصم النقاط. حاول مرة أخرى.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onClear();
    onClose();
  }

  const earn =
    loyaltyPointsPerSar != null && loyaltyPointsPerSar > 0
      ? Math.floor(total * loyaltyPointsPerSar)
      : 0;

  // ---- shared styling tokens (premium dark/gold) ----
  const card = "rounded-2xl p-4";
  const cardStyle = { background: "var(--card-bg)", border: "1px solid var(--card-border)" } as const;
  const inputCls =
    "w-full h-12 rounded-xl px-3.5 outline-none text-sm transition-colors";
  const inputStyle = {
    background: "var(--surface-deep, #0f0e0a)",
    border: "1px solid var(--card-border)",
    color: "var(--ink)",
  } as const;
  const sectionTitle = "text-base font-bold flex items-center gap-2 mb-3";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto"
      style={{ background: "var(--bg)", color: "var(--ink)", fontFamily: "var(--font-body)" }}
      dir="rtl"
    >
      {/* ===== header ===== */}
      <header
        className="sticky top-0 z-10 h-16 flex items-center justify-between px-5 shrink-0"
        style={{
          background: "rgba(20,19,15,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--card-border)",
        }}
      >
        <button
          onClick={() => (step === "checkout" ? setStep("select") : onClose())}
          className="w-10 h-10 rounded-full grid place-items-center text-xl active:scale-95"
          style={{ border: "1px solid var(--card-border)", color: "var(--ink)" }}
          aria-label="رجوع"
        >
          ✕
        </button>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-bold text-lg truncate" style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}>
            {restaurant.name}
          </span>
          {restaurant.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.logo_url} alt={restaurant.name} className="w-9 h-9 rounded-full object-cover" style={{ border: "1px solid var(--accent-gold)" }} />
          )}
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-5 pt-6 pb-40">
        {lines.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4" style={{ color: "var(--accent-gold)" }}>🛒</div>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>سلتك فارغة.</p>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-full font-bold"
              style={{ background: "var(--cta-bg)", color: "var(--cta-text, #412d00)", fontFamily: "var(--font-display)" }}
            >
              تصفّح القائمة
            </button>
          </div>
        ) : step === "select" ? (
          /* ============ STEP 1 — اختياراتك ============ */
          <>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}>
              اختياراتك
            </h1>
            <p className="text-xs mb-6" style={{ color: "var(--text-secondary)" }}>
              {toArabicDigits(String(lines.length))} أصناف
            </p>

            <div className="space-y-3">
              {lines.map((l) => (
                <div key={l.lineId} className={card + " flex items-center gap-3"} style={cardStyle}>
                  {l.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.imageUrl} alt={l.itemName} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl grid place-items-center text-2xl shrink-0" style={{ background: "var(--surface-elevated)" }}>🍽️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                      {l.itemName}
                      {l.variantLabel && (
                        <span className="text-xs font-normal mr-1" style={{ color: "var(--text-secondary)" }}>· {l.variantLabel}</span>
                      )}
                    </div>
                    {l.modifiers && l.modifiers.length > 0 && (
                      <div className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--text-secondary)" }}>
                        {l.modifiers.map((m) => m.selected.join("، ")).join(" · ")}
                      </div>
                    )}
                    {l.itemNote && (
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-secondary)", opacity: 0.8 }}>ملاحظة: {l.itemNote}</div>
                    )}
                    <div className="text-sm font-bold mt-1 flex items-center gap-0.5" style={{ color: "var(--accent-gold)" }}>
                      {toArabicDigits(String(l.price * l.qty))} <SarSymbol size={12} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onAdjust(l.lineId, 1)}
                      className="w-9 h-9 rounded-full font-bold text-lg active:scale-95"
                      style={{ background: "var(--cta-bg)", color: "var(--cta-text, #412d00)" }}
                      aria-label="إضافة"
                    >
                      +
                    </button>
                    <span className="w-5 text-center font-bold" style={{ fontFamily: "var(--font-display)" }}>{toArabicDigits(String(l.qty))}</span>
                    <button
                      onClick={() => onAdjust(l.lineId, -1)}
                      className="w-9 h-9 rounded-full text-lg active:scale-95"
                      style={{ border: "1px solid var(--card-border)", color: "var(--ink)" }}
                      aria-label="إنقاص"
                    >
                      −
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* order summary (no delivery fee on this step) */}
            <div className={card + " mt-5"} style={cardStyle}>
              <Summary
                subtotal={total}
                deliveryFee={0}
                discountAmount={discountAmount}
                redeemPoints={redeemPoints}
                grandTotal={total - discountAmount}
              />
            </div>
          </>
        ) : (
          /* ============ STEP 2 — إتمام الطلب ============ */
          <>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}>
              إتمام الطلب
            </h1>
            <p className="text-xs mb-6" style={{ color: "var(--text-secondary)" }}>
              أكمل بياناتك للاستمتاع بتجربة طعام فاخرة
            </p>

            <div className="space-y-4">
              {/* order type */}
              {lockedToTable ? (
                <div className={card + " flex items-center gap-2"} style={cardStyle}>
                  <span className="text-2xl">🪑</span>
                  <div className="text-sm">
                    <div className="font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>طاولة {tableLabel}</div>
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>سيُسلَّم طلبك على هذه الطاولة</div>
                  </div>
                </div>
              ) : preselected ? (
                <div className={card + " flex items-center justify-between"} style={cardStyle}>
                  <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                    {orderTypeLabel[orderType]}
                  </span>
                  <button
                    type="button"
                    onClick={() => { try { localStorage.removeItem(`menulink:orderType:${restaurant.id}`); } catch {} window.location.reload(); }}
                    className="text-xs font-bold"
                    style={{ color: "var(--accent-gold)" }}
                  >
                    تغيير
                  </button>
                </div>
              ) : (
                <div className={card} style={cardStyle}>
                  <p className={sectionTitle} style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>نوع الطلب</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["delivery", "pickup", "dine_in", "car"] as OrderType[]).map((t) => {
                      const active = orderType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setOrderType(t)}
                          className="h-11 rounded-xl text-sm font-bold transition-colors"
                          style={{
                            background: active ? "var(--cta-bg)" : "transparent",
                            color: active ? "var(--cta-text, #412d00)" : "var(--text-secondary)",
                            border: `1px solid ${active ? "var(--accent-gold)" : "var(--card-border)"}`,
                            fontFamily: "var(--font-display)",
                          }}
                        >
                          {orderTypeLabel[t]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* branch picker */}
              {hasMultipleBranches && !lockedToTable && (
                <div className={card} style={cardStyle}>
                  <p className={sectionTitle} style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                    🏢 {orderType === "pickup" ? "اختر فرع الاستلام" : "اختر الفرع"}
                  </p>
                  <div className="space-y-2">
                    {branches
                      .filter((b) => {
                        if (orderType === "delivery") return b.supports_delivery;
                        if (orderType === "pickup") return b.supports_pickup;
                        if (orderType === "dine_in") return b.supports_dine_in;
                        if (orderType === "car") return b.supports_car;
                        return true;
                      })
                      .map((b) => {
                        const active = selectedBranchId === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            aria-label={`اختر فرع ${b.name_ar}`}
                            aria-pressed={active}
                            onClick={() => setSelectedBranchId(b.id)}
                            className="w-full text-right rounded-xl px-3 py-2.5 transition-colors"
                            style={{
                              border: `1px solid ${active ? "var(--accent-gold)" : "var(--card-border)"}`,
                              background: active ? "rgba(230,195,131,0.08)" : "transparent",
                            }}
                          >
                            <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{b.name_ar}</span>
                            {b.address_ar && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>📍 {b.address_ar}</p>}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* personal info */}
              <div className={card} style={cardStyle}>
                <p className={sectionTitle} style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>👤 المعلومات الشخصية</p>
                <div className="space-y-3">
                  <input className={inputCls} style={inputStyle} placeholder="الاسم الكامل (اختياري)" value={name} onChange={(e) => setName(e.target.value)} />
                  <div className="flex gap-2" dir="ltr">
                    {/* display strips a leading +966/966 so it doesn't double with the prefix box;
                        rawPhone stays canonical for normalizePhone (which handles any format). */}
                    <input className={inputCls} style={inputStyle} type="tel" placeholder="5X XXX XXXX" value={rawPhone.replace(/^\+?966\s*/, "")} onChange={(e) => setRawPhone(e.target.value)} />
                    <span className="h-12 px-3 grid place-items-center rounded-xl text-sm shrink-0" style={{ ...inputStyle, color: "var(--text-secondary)" }}>+966</span>
                  </div>
                </div>
              </div>

              {/* delivery location */}
              {orderType === "delivery" && (
                <div className={card} style={cardStyle}>
                  <p className={sectionTitle} style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>📍 موقع التوصيل</p>
                  {savedAddresses.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {savedAddresses.map((a) => {
                        const active = selectedAddressId === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            aria-label={`اختر عنوان ${LABEL_AR[a.label] ?? a.label}`}
                            aria-pressed={active}
                            onClick={() => {
                              setSelectedAddressId(a.id);
                              setAddress(a.address + (a.details ? ` · ${a.details}` : ""));
                              if (a.lat && a.lng) setLocation({ lat: a.lat, lng: a.lng });
                              else setLocation(null);
                            }}
                            className="w-full text-right rounded-xl px-3 py-2.5 transition-colors"
                            style={{ border: `1px solid ${active ? "var(--accent-gold)" : "var(--card-border)"}`, background: active ? "rgba(230,195,131,0.08)" : "transparent" }}
                          >
                            <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                              {a.label === "home" ? "🏠" : a.label === "office" ? "🏢" : "📍"} {LABEL_AR[a.label] ?? a.label}
                            </span>
                            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{a.address}</p>
                          </button>
                        );
                      })}
                      <button type="button" onClick={() => { setSelectedAddressId(null); setAddress(""); setLocation(null); }} className="text-xs font-bold" style={{ color: "var(--accent-gold)" }}>
                        + عنوان جديد
                      </button>
                    </div>
                  )}
                  {(savedAddresses.length === 0 || !selectedAddressId) && (
                    <div className="space-y-3">
                      <input className={inputCls} style={inputStyle} placeholder="العنوان (الحي · الشارع · رقم المبنى)" value={address} onChange={(e) => setAddress(e.target.value)} />
                      <LocationPicker initial={location} onChange={setLocation} />
                    </div>
                  )}
                </div>
              )}

              {/* car fields */}
              {orderType === "car" && (
                <div className={card + " space-y-3"} style={cardStyle}>
                  <p className={sectionTitle} style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>🚙 بيانات السيارة</p>
                  <input className={inputCls} style={inputStyle} placeholder="رقم اللوحة (اختياري)" value={carPlate} onChange={(e) => setCarPlate(e.target.value)} />
                  <input className={inputCls} style={inputStyle} placeholder="لون السيارة (اختياري)" value={carColor} onChange={(e) => setCarColor(e.target.value)} />
                </div>
              )}

              {/* notes */}
              <input className={inputCls} style={inputStyle} placeholder="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} />

              {/* expected time note */}
              <div className="flex items-center gap-2 text-xs px-1" style={{ color: "var(--text-secondary)" }}>
                <span>ⓘ</span>
                <span>وقت التوصيل المتوقع ٣٥-٤٥ دقيقة · تجربة فاخرة</span>
              </div>

              {/* points redemption */}
              {pointsBalance > 0 && redemptionValueSar > 0 && (
                <button
                  type="button"
                  aria-label={usePoints ? "إلغاء استخدام النقاط" : "استخدم نقاطك"}
                  aria-pressed={usePoints}
                  onClick={() => setUsePoints((p) => !p)}
                  className={card + " w-full flex items-center gap-3 text-right"}
                  style={{ ...cardStyle, borderColor: usePoints ? "var(--accent-gold)" : "var(--card-border)" }}
                >
                  <span className="text-xl">{usePoints ? "✅" : "🎁"}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                      {usePoints ? "تم تفعيل خصم النقاط" : "استخدم نقاطك"}
                    </span>
                    <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      لديك {toArabicDigits(String(pointsBalance))} نقطة = خصم حتى {toArabicDigits((maxRedeemPoints * redemptionValueSar).toFixed(0))} ر.س
                    </span>
                  </span>
                </button>
              )}
              {earn > 0 && !usePoints && rawPhone.trim() && (
                <div className={card + " flex items-center gap-2"} style={{ background: "rgba(230,195,131,0.08)", border: "1px solid var(--card-border)" }}>
                  <span className="text-xl">🏆</span>
                  <span className="text-xs font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}>
                    ستربح {toArabicDigits(String(earn))} نقطة من هذا الطلب
                  </span>
                </div>
              )}

              {/* order summary */}
              <div className={card} style={cardStyle}>
                <p className={sectionTitle} style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>🧾 ملخص الطلب</p>
                <Summary
                  subtotal={total}
                  deliveryFee={deliveryFee}
                  discountAmount={discountAmount}
                  redeemPoints={redeemPoints}
                  grandTotal={finalTotal}
                />
              </div>

              {/* trust badges */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { i: "✦", t: "جودة" },
                  { i: "⚡", t: "فوري" },
                  { i: "🛡", t: "آمن" },
                ].map((b) => (
                  <div key={b.t} className="text-center">
                    <div className="text-lg" style={{ color: "var(--accent-gold)" }}>{b.i}</div>
                    <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{b.t}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ===== sticky footer CTA ===== */}
      {lines.length > 0 && (
        <footer
          className="fixed bottom-0 inset-x-0 z-10 px-5 py-4 max-w-xl mx-auto w-full"
          style={{
            background: "rgba(15,14,10,0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: "1px solid var(--card-border)",
          }}
        >
          {submitError && (
            <div className="mb-3 rounded-xl px-3 py-2 text-xs font-bold text-center" style={{ background: "rgba(220,80,80,0.12)", border: "1px solid rgba(220,80,80,0.4)", color: "#f6b4b4" }}>
              {submitError}
            </div>
          )}
          {step === "select" ? (
            <>
              <button
                onClick={() => setStep("checkout")}
                className="w-full h-13 py-3.5 rounded-2xl font-bold text-base active:translate-y-px flex items-center justify-center gap-2"
                style={{ background: "var(--cta-bg)", color: "var(--cta-text, #412d00)", fontFamily: "var(--font-display)" }}
              >
                <span>إتمام الطلب</span>
                <span className="flex items-center gap-1">{toArabicDigits((total - discountAmount).toFixed(2))} <SarSymbol size={15} /></span>
              </button>
              <button onClick={onClose} className="w-full mt-2 py-2.5 rounded-2xl text-sm font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--card-border)" }}>
                + أضف المزيد من الأصناف
              </button>
            </>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl font-bold text-base active:translate-y-px disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "var(--cta-bg)", color: "var(--cta-text, #412d00)", fontFamily: "var(--font-display)" }}
            >
              <span>{submitting ? "جاري الإرسال..." : "إرسال الطلب عبر واتساب"}</span>
              {!submitting && <span>🟢</span>}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

// VAT-inclusive order summary. `grandTotal` is the displayed total; the VAT line
// is the portion ALREADY included in it (never added on top).
function Summary({
  subtotal,
  deliveryFee,
  discountAmount,
  redeemPoints,
  grandTotal,
}: {
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  redeemPoints: number;
  grandTotal: number;
}) {
  const row = "flex items-center justify-between text-sm mb-2";
  return (
    <div>
      <div className={row} style={{ color: "var(--text-secondary)" }}>
        <span>المجموع الفرعي</span>
        <span className="flex items-center gap-0.5">{toArabicDigits(subtotal.toFixed(2))} <SarSymbol size={11} /></span>
      </div>
      {deliveryFee > 0 && (
        <div className={row} style={{ color: "var(--text-secondary)" }}>
          <span>رسوم التوصيل</span>
          <span className="flex items-center gap-0.5">{toArabicDigits(deliveryFee.toFixed(2))} <SarSymbol size={11} /></span>
        </div>
      )}
      {discountAmount > 0 && (
        <div className={row} style={{ color: "#7fd6a0" }}>
          <span>خصم النقاط ({toArabicDigits(String(redeemPoints))} نقطة)</span>
          <span className="flex items-center gap-0.5">-{toArabicDigits(discountAmount.toFixed(2))} <SarSymbol size={11} /></span>
        </div>
      )}
      <div className={row} style={{ color: "var(--text-secondary)", opacity: 0.75 }}>
        <span>ضريبة القيمة المضافة (شاملة ١٥٪)</span>
        <span className="flex items-center gap-0.5">{toArabicDigits(vatIncluded(grandTotal).toFixed(2))} <SarSymbol size={11} /></span>
      </div>
      <div className="h-px my-3" style={{ background: "var(--divider, var(--card-border))" }} />
      <div className="flex items-end justify-between">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>الإجمالي</span>
        <span className="text-2xl font-bold flex items-center gap-1" style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}>
          {toArabicDigits(grandTotal.toFixed(2))} <SarSymbol size={20} />
        </span>
      </div>
    </div>
  );
}
