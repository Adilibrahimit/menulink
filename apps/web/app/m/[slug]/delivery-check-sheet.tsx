"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import LocationPicker from "./location-picker";
import type { DeliveryContext } from "./order-context";
import { toArabicDigits } from "@/lib/arabic";
import SarSymbol from "./sar-symbol";

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

const LABEL_ICON: Record<string, string> = { home: "🏠", office: "🏢", custom: "📍" };
const LABEL_AR: Record<string, string> = { home: "المنزل", office: "المكتب", custom: "مخصص" };

type FindResult = {
  found: boolean;
  branch_id?: string;
  branch_name_ar?: string;
  delivery_fee?: number;
  min_order?: number;
  estimated_minutes?: number;
  distance_km?: number;
};

export default function DeliveryCheckSheet({
  restaurantId,
  restaurantName,
  onConfirm,
  onSwitchPickup,
  onClose,
}: {
  restaurantId: string;
  restaurantName: string;
  onConfirm: (d: DeliveryContext) => void;
  onSwitchPickup: () => void;
  onClose: () => void;
}) {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FindResult | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      sb.from("customers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .eq("restaurant_id", restaurantId)
        .maybeSingle()
        .then(({ data: customer }) => {
          if (!customer) return;
          sb.from("customer_addresses")
            .select("id, label, address, lat, lng")
            .eq("customer_id", customer.id as string)
            .order("is_default", { ascending: false })
            .then(({ data }) => {
              if (data) setSavedAddresses(data.map((a) => ({
                id: a.id as string,
                label: a.label as string,
                address: a.address as string,
                lat: a.lat ? Number(a.lat) : null,
                lng: a.lng ? Number(a.lng) : null,
              })));
            });
        });
    });
  }, [restaurantId]);

  async function checkZone() {
    if (!lat || !lng) return;
    setChecking(true);
    setResult(null);
    const sb = createClient();
    const { data } = await sb.rpc("find_nearest_branch", {
      p_restaurant_id: restaurantId,
      p_lat: lat,
      p_lng: lng,
    });
    const r = (data ?? { found: false }) as FindResult;
    setResult(r);
    setChecking(false);
  }

  function handleConfirm() {
    if (!result?.found || !lat || !lng) return;
    onConfirm({
      lat,
      lng,
      branchId: result.branch_id!,
      branchNameAr: result.branch_name_ar!,
      deliveryFee: result.delivery_fee ?? 0,
      minOrder: result.min_order ?? 0,
      estimatedMinutes: result.estimated_minutes ?? null,
      distanceKm: result.distance_km ?? 0,
      address,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl p-5 space-y-4 animate-slide-up max-h-[85dvh] overflow-y-auto"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-lg text-neutral-900" style={{ fontFamily: "var(--font-display)" }}>
            📍 تحديد موقع التوصيل
          </h2>
          <button onClick={onClose} className="text-neutral-400 text-xl hover:text-neutral-600">✕</button>
        </div>

        <p className="text-xs text-neutral-500">
          {savedAddresses.length > 0 ? "اختر عنوان محفوظ أو حدد موقعك على الخريطة" : "حدد موقعك على الخريطة لنتأكد إنك داخل نطاق التوصيل"}
        </p>

        {savedAddresses.length > 0 && (
          <div className="space-y-1.5">
            {savedAddresses.filter((a) => a.lat && a.lng).map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setLat(a.lat!);
                  setLng(a.lng!);
                  setAddress(a.address);
                  setResult(null);
                }}
                className={
                  "w-full flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-right transition-colors " +
                  (lat === a.lat && lng === a.lng
                    ? "border-[var(--brand)] bg-green-50"
                    : "border-neutral-200 bg-white hover:border-neutral-300")
                }
              >
                <span className="text-xl">{LABEL_ICON[a.label] ?? "📍"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-neutral-800">{LABEL_AR[a.label] ?? a.label}</div>
                  <div className="text-[11px] text-neutral-500 truncate">{a.address}</div>
                </div>
                {lat === a.lat && lng === a.lng && <span className="text-green-600 text-sm">✓</span>}
              </button>
            ))}
          </div>
        )}

        <div className="h-56 rounded-xl overflow-hidden border border-neutral-200">
          <LocationPicker
            initial={null}
            onChange={(loc) => { setLat(loc?.lat ?? null); setLng(loc?.lng ?? null); setResult(null); }}
          />
        </div>

        <input
          type="text"
          placeholder="العنوان بالتفصيل (اختياري)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-[var(--brand)]"
        />

        {!result && (
          <button
            onClick={checkZone}
            disabled={!lat || !lng || checking}
            className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold text-sm disabled:opacity-50 active:translate-y-px shadow-md"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {checking ? "جاري التحقق..." : "تحقق من التوصيل"}
          </button>
        )}

        {result?.found && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <span className="text-sm font-bold text-green-800" style={{ fontFamily: "var(--font-display)" }}>
                  التوصيل متاح لموقعك
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white rounded-lg p-2">
                  <div className="text-xs text-neutral-500">رسوم التوصيل</div>
                  <div className="font-bold text-neutral-800 flex items-center justify-center gap-0.5">
                    {toArabicDigits(String(result.delivery_fee ?? 0))} <SarSymbol size={12} />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <div className="text-xs text-neutral-500">الحد الأدنى</div>
                  <div className="font-bold text-neutral-800 flex items-center justify-center gap-0.5">
                    {toArabicDigits(String(result.min_order ?? 0))} <SarSymbol size={12} />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <div className="text-xs text-neutral-500">الوقت المتوقع</div>
                  <div className="font-bold text-neutral-800">
                    {result.estimated_minutes ? `${toArabicDigits(String(result.estimated_minutes))} د` : "—"}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleConfirm}
              className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold text-sm active:translate-y-px shadow-md"
              style={{ fontFamily: "var(--font-display)" }}
            >
              تصفح القائمة
            </button>
          </div>
        )}

        {result && !result.found && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">😔</span>
                <span className="text-sm font-bold text-amber-800" style={{ fontFamily: "var(--font-display)" }}>
                  عذراً، التوصيل غير متاح لموقعك
                </span>
              </div>
              <p className="text-xs text-amber-700">
                موقعك خارج نطاق التوصيل لـ {restaurantName}. يمكنك الاستلام من الفرع بدلاً من ذلك.
              </p>
            </div>
            <button
              onClick={onSwitchPickup}
              className="w-full h-12 rounded-2xl bg-neutral-800 text-white font-extrabold text-sm active:translate-y-px"
              style={{ fontFamily: "var(--font-display)" }}
            >
              🏪 استلام من الفرع بدلاً من ذلك
            </button>
            <button
              onClick={() => setResult(null)}
              className="w-full h-10 rounded-xl text-neutral-500 text-xs font-semibold hover:bg-neutral-50"
            >
              جرب موقع آخر
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
