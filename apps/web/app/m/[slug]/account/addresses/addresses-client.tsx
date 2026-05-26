"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase-browser";

const LocationPicker = dynamic(() => import("../../location-picker"), { ssr: false });

type Address = {
  id: string;
  label: "home" | "office" | "custom";
  address: string;
  lat: number | null;
  lng: number | null;
  details: string | null;
  is_default: boolean;
};

const LABEL_AR: Record<string, string> = {
  home: "المنزل",
  office: "المكتب",
  custom: "اسم مخصص",
};

const LABEL_ICON: Record<string, string> = {
  home: "🏠",
  office: "🏢",
  custom: "📍",
};

export default function AddressesClient({
  slug,
  customerId,
  restaurantId,
  initial,
}: {
  slug: string;
  customerId: string | null;
  restaurantId: string;
  initial: Address[];
}) {
  const [addresses, setAddresses] = useState<Address[]>(initial);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState<"home" | "office" | "custom">("home");
  const [addressText, setAddressText] = useState("");
  const [details, setDetails] = useState("");
  const [addrLat, setAddrLat] = useState<number | null>(null);
  const [addrLng, setAddrLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function save() {
    if (!customerId || !addressText.trim()) return;
    setSaving(true);
    const sb = createClient();
    const { data, error } = await sb
      .from("customer_addresses")
      .insert({
        customer_id: customerId,
        restaurant_id: restaurantId,
        label,
        address: addressText.trim(),
        lat: addrLat,
        lng: addrLng,
        details: details.trim() || null,
        is_default: addresses.length === 0,
      })
      .select("id, label, address, lat, lng, details, is_default")
      .single();

    setSaving(false);
    if (!error && data) {
      setAddresses((prev) => [
        ...prev,
        {
          id: data.id as string,
          label: data.label as "home" | "office" | "custom",
          address: data.address as string,
          lat: data.lat ? Number(data.lat) : null,
          lng: data.lng ? Number(data.lng) : null,
          details: (data.details as string | null) ?? null,
          is_default: data.is_default as boolean,
        },
      ]);
      setAdding(false);
      setAddressText("");
      setDetails("");
      setLabel("home");
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    const sb = createClient();
    await sb.from("customer_addresses").delete().eq("id", id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    setDeletingId(null);
  }

  if (!customerId) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-3">
        <div className="text-3xl">📍</div>
        <p className="text-sm text-neutral-500">اربط حسابك برقم جوالك أولاً لحفظ العناوين</p>
        <a
          href={`/m/${slug}/account`}
          className="inline-block h-10 px-5 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-bold leading-10"
        >
          العودة للحساب
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Existing addresses */}
      {addresses.map((a) => (
        <div
          key={a.id}
          className="bg-white border border-neutral-200 rounded-xl p-4 flex items-start gap-3"
        >
          <span className="text-2xl mt-0.5">{LABEL_ICON[a.label]}</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-neutral-900" style={{ fontFamily: "var(--font-display)" }}>
              {LABEL_AR[a.label]}
              {a.is_default && (
                <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5 mr-2">
                  افتراضي
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-600 mt-0.5 leading-snug">{a.address}</p>
            {a.details && <p className="text-xs text-neutral-400 mt-0.5">{a.details}</p>}
          </div>
          <button
            onClick={() => remove(a.id)}
            disabled={deletingId === a.id}
            className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-50 shrink-0"
          >
            {deletingId === a.id ? "..." : "حذف"}
          </button>
        </div>
      ))}

      {addresses.length === 0 && !adding && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">📍</div>
          <p className="text-sm text-neutral-500">لم تضف عناوين بعد</p>
        </div>
      )}

      {/* Add new address */}
      {adding ? (
        <div className="bg-white border-2 border-[var(--brand)] rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            {(["home", "office", "custom"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLabel(l)}
                className={`text-xs px-3 py-1.5 rounded-full border-2 font-bold ${
                  label === l
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-neutral-200 text-neutral-600"
                }`}
              >
                {LABEL_ICON[l]} {LABEL_AR[l]}
              </button>
            ))}
          </div>
          <LocationPicker
            initial={addrLat && addrLng ? { lat: addrLat, lng: addrLng } : null}
            onChange={(loc) => { setAddrLat(loc?.lat ?? null); setAddrLng(loc?.lng ?? null); }}
          />
          <input
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="العنوان الكامل"
            className="w-full h-10 px-3 rounded-lg border border-neutral-200 outline-none focus:border-[var(--brand)] text-sm"
          />
          <input
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="تفاصيل إضافية (رقم الشقة، الدور...)"
            className="w-full h-10 px-3 rounded-lg border border-neutral-200 outline-none focus:border-[var(--brand)] text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !addressText.trim()}
              className="flex-1 h-10 rounded-xl text-white font-bold text-sm disabled:opacity-50"
              style={{ background: "var(--brand)", fontFamily: "var(--font-display)" }}
            >
              {saving ? "..." : "حفظ العنوان"}
            </button>
            <button
              onClick={() => { setAdding(false); setAddressText(""); setDetails(""); setAddrLat(null); setAddrLng(null); }}
              className="h-10 px-4 rounded-xl bg-neutral-100 text-neutral-600 text-sm font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full h-12 rounded-xl border-2 border-dashed border-neutral-300 text-sm font-bold text-neutral-600 hover:border-neutral-400 active:translate-y-px"
          style={{ fontFamily: "var(--font-display)" }}
        >
          + أضف عنوان جديد
        </button>
      )}
    </div>
  );
}
