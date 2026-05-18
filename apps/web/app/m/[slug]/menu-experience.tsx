"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import { SLUG_TO_IMG } from "@/lib/koko-images";
import type {
  PublicMenu,
  PublicMenuItem,
  PublicVariant,
  CartLine,
  OrderType,
} from "./types";
import CategoryTabs from "./category-tabs";
import MenuItemCard from "./menu-item";

export default function MenuExperience({ menu }: { menu: PublicMenu }) {
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  const lines = Object.values(cart);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  function addToCart(item: PublicMenuItem, variant: PublicVariant) {
    const lineId = `${item.slug}::${variant.key}`;
    setCart((c) => {
      const existing = c[lineId];
      return {
        ...c,
        [lineId]: existing
          ? { ...existing, qty: existing.qty + 1 }
          : {
              lineId,
              itemSlug: item.slug,
              itemName: item.name_ar,
              variantKey: variant.key,
              variantLabel: variant.label || null,
              price: Number(variant.price),
              qty: 1,
              imageUrl: item.image_url ?? SLUG_TO_IMG[item.slug] ?? null,
            },
      };
    });
  }

  function adjustQty(lineId: string, delta: number) {
    setCart((c) => {
      const line = c[lineId];
      if (!line) return c;
      const next = line.qty + delta;
      if (next <= 0) {
        const { [lineId]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [lineId]: { ...line, qty: next } };
    });
  }

  function clearCart() {
    setCart({});
  }

  return (
    <main className="bg-[var(--bg)] text-neutral-900 pb-32" style={{ fontFamily: "Cairo, system-ui, sans-serif" }}>
      {/* Hero */}
      <header className="px-4 pt-8 pb-5">
        <div className="flex items-start gap-3">
          {menu.restaurant.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={menu.restaurant.logo_url}
              alt={menu.restaurant.name}
              className="w-14 h-14 rounded-xl object-cover bg-white border border-neutral-200"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl font-extrabold text-neutral-900 leading-tight"
              style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
            >
              {menu.restaurant.name}
            </h1>
            {menu.restaurant.tagline_ar && (
              <p className="text-sm text-neutral-600 mt-0.5">
                {menu.restaurant.tagline_ar}
              </p>
            )}
            {menu.restaurant.address_ar && (
              <p className="text-xs text-neutral-500 mt-1.5">
                📍 {menu.restaurant.address_ar}
              </p>
            )}
          </div>
        </div>
      </header>

      <CategoryTabs categories={menu.categories} />

      {/* Menu sections */}
      <div className="px-4 mt-4 space-y-7">
        {menu.categories.map((c) => (
          <section key={c.id} id={c.id}>
            <div className="flex items-baseline gap-2 mb-3">
              <h2
                className="text-xl font-bold text-neutral-900"
                style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
              >
                {c.emoji && <span className="ml-1.5">{c.emoji}</span>}
                {c.name_ar}
              </h2>
              {c.info_ar && (
                <span className="text-xs text-neutral-500">{c.info_ar}</span>
              )}
            </div>
            <div className="space-y-3">
              {c.items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onAdd={(v) => addToCart(item, v)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Floating cart FAB */}
      {count > 0 && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-4 inset-x-4 z-40 h-14 rounded-2xl bg-[var(--brand)] text-white shadow-lg shadow-black/10 flex items-center justify-between px-5 font-bold text-base hover:opacity-95 active:translate-y-px"
          dir="rtl"
        >
          <span>
            🛒 السلة · {toArabicDigits(String(count))}
          </span>
          <span>
            {toArabicDigits(String(total))} ر.س
          </span>
        </button>
      )}

      {/* Cart drawer */}
      {drawerOpen && (
        <CartDrawer
          restaurant={menu.restaurant}
          lines={lines}
          total={total}
          onClose={() => setDrawerOpen(false)}
          onAdjust={adjustQty}
          onClear={clearCart}
        />
      )}
    </main>
  );
}

/* ---------------- cart drawer + checkout ---------------- */

function CartDrawer({
  restaurant,
  lines,
  total,
  onClose,
  onAdjust,
  onClear,
}: {
  restaurant: PublicMenu["restaurant"];
  lines: CartLine[];
  total: number;
  onClose: () => void;
  onAdjust: (lineId: string, delta: number) => void;
  onClear: () => void;
}) {
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [name, setName] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const orderTypeLabel: Record<OrderType, string> = {
    delivery: "توصيل",
    pickup: "استلام",
    dine_in: "في المطعم",
  };

  async function submit() {
    if (lines.length === 0) return;
    if (!rawPhone.trim()) {
      alert("الرجاء إدخال رقم الجوال");
      return;
    }
    if (orderType === "delivery" && !address.trim()) {
      alert("الرجاء إدخال عنوان التوصيل");
      return;
    }

    setSubmitting(true);
    const phone = normalizePhone(rawPhone);

    // Fire-and-forget persistence — open WhatsApp regardless of DB result.
    persistOrder({
      restaurantId: restaurant.id,
      phone,
      name,
      address: orderType === "delivery" ? address : "",
      notes,
      orderType,
      lines,
      total,
    }).catch((err) => console.warn("[MenuLink v7] persist failed:", err));

    // Build WhatsApp message
    const lineList = lines
      .map((l, i) => {
        const v = l.variantLabel ? ` (${l.variantLabel})` : "";
        return `${toArabicDigits(String(i + 1))}. ${l.itemName}${v}  ×${toArabicDigits(String(l.qty))}  =  ${toArabicDigits(String(l.price * l.qty))} ر.س`;
      })
      .join("\n");

    const msg =
      `🌟 *طلب جديد · ${restaurant.name}* 🌟\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📦 *نوع الطلب:* ${orderTypeLabel[orderType]}\n` +
      `👤 *الاسم:* ${name || "—"}\n` +
      `📞 *الجوال:* ${rawPhone || "—"}\n` +
      (orderType === "delivery" && address ? `📍 *العنوان:* ${address}\n` : "") +
      `━━━━━━━━━━━━━━━━\n` +
      `🛒 *الطلبات:*\n${lineList}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 *المجموع: ${toArabicDigits(String(total))} ر.س*\n` +
      (notes ? `📝 *ملاحظات:* ${notes}\n` : "") +
      `━━━━━━━━━━━━━━━━\n` +
      `شكراً لاختياركم ${restaurant.name} 🙏`;

    const waNumber = String(restaurant.whatsapp_phone).replace(/\D/g, "");
    window.open(
      `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );

    setSubmitting(false);
    onClear();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative ml-auto h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="font-bold text-lg" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
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
            <div
              key={l.lineId}
              className="flex items-center gap-3 bg-neutral-50 rounded-xl p-2"
            >
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.imageUrl}
                  alt={l.itemName}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-neutral-200 flex items-center justify-center text-xl">
                  🍽️
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {l.itemName}
                  {l.variantLabel && (
                    <span className="text-xs text-neutral-500 font-normal mr-1">
                      · {l.variantLabel}
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {toArabicDigits(String(l.price * l.qty))} ر.س
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onAdjust(l.lineId, -1)}
                  className="w-7 h-7 rounded-full bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300"
                  aria-label="إنقاص"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold text-sm">
                  {toArabicDigits(String(l.qty))}
                </span>
                <button
                  onClick={() => onAdjust(l.lineId, 1)}
                  className="w-7 h-7 rounded-full bg-[var(--brand)] text-white"
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
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-neutral-600 mb-2">
                  نوع الطلب
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["delivery", "pickup", "dine_in"] as OrderType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setOrderType(t)}
                      className={
                        "h-10 rounded-lg text-sm font-semibold border " +
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

              <div className="space-y-3 pt-1">
                <input
                  type="text"
                  placeholder="الاسم (اختياري)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 rounded-lg border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                />
                <input
                  type="tel"
                  placeholder="رقم الجوال"
                  value={rawPhone}
                  onChange={(e) => setRawPhone(e.target.value)}
                  className="w-full h-11 rounded-lg border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                  dir="ltr"
                />
                {orderType === "delivery" && (
                  <input
                    type="text"
                    placeholder="عنوان التوصيل (الحي · الشارع · رقم المبنى)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-11 rounded-lg border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                  />
                )}
                <input
                  type="text"
                  placeholder="ملاحظات (اختياري)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-11 rounded-lg border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-sm"
                />
              </div>
            </>
          )}
        </div>

        {lines.length > 0 && (
          <footer className="p-4 border-t border-neutral-200 bg-white">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-neutral-500">المجموع</span>
              <span className="font-extrabold text-lg">
                {toArabicDigits(String(total))} ر.س
              </span>
            </div>
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-[var(--brand)] text-white font-bold text-base hover:opacity-90 disabled:opacity-60 active:translate-y-px"
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

function toArabicDigits(s: string): string {
  const map: Record<string, string> = {
    "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
    "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩",
  };
  return s.replace(/[0-9]/g, (d) => map[d] ?? d);
}

function normalizePhone(raw: string): string {
  const arabicMap: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  let s = String(raw || "")
    .replace(/[٠-٩]/g, (d) => arabicMap[d] ?? d)
    .replace(/\D/g, "");
  if (s.startsWith("00966")) s = s.slice(5);
  else if (s.startsWith("966")) s = s.slice(3);
  if (s.startsWith("0")) s = s.slice(1);
  return s ? "+966" + s : "";
}

async function persistOrder({
  restaurantId,
  phone,
  name,
  address,
  notes,
  orderType,
  lines,
  total,
}: {
  restaurantId: string;
  phone: string;
  name: string;
  address: string;
  notes: string;
  orderType: OrderType;
  lines: CartLine[];
  total: number;
}) {
  const sb = createClient();
  const payload = {
    restaurant_id: restaurantId,
    phone,
    name: name || null,
    address: orderType === "delivery" ? (address || null) : null,
    lat: null,
    lng: null,
    order_type: orderType,
    channel: "whatsapp",
    subtotal: total,
    delivery_fee: 0,
    total,
    notes: notes || null,
    items: lines.map((l) => ({
      item_name: l.itemName,
      variant: l.variantLabel,
      qty: l.qty,
      unit_price: l.price,
      line_total: l.price * l.qty,
    })),
  };
  const { error } = await sb.rpc("submit_order", { p_order: payload });
  if (error) throw error;
}
