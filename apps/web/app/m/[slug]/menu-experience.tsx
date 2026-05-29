"use client";

import { useEffect, useState } from "react";
import { SLUG_TO_IMG } from "@/lib/koko-images";
import { toArabicDigits } from "@/lib/arabic";
import type { ThemeConfig } from "@/lib/themes";
import SarSymbol from "./sar-symbol";
import type {
  PublicMenu,
  PublicMenuItem,
  PublicVariant,
  PublicCategory,
  PublicBranch,
  CartLine,
  CartLineModifier,
} from "./types";
import type { PublicModifierConfig } from "./types";
import CategoryTabs from "./category-tabs";
import MenuItemCard from "./menu-item";
import VeloraHero from "./velora-hero";
import PromotionsRail from "./promotions-rail";
import ItemCustomizerSheet from "./item-customizer-sheet";
import CartDrawer from "./cart-drawer";
import TrackingSheet from "./tracking-sheet";
import type { TrackingState } from "./tracking-sheet";
import TableSessionBar from "./table-session-bar";
import PushToggle from "./push-toggle";
import ClosedPopup, { isRestaurantOpen } from "./closed-popup";
import OrderTypeSwitcher from "./order-type-switcher";
import { useOrderContext } from "./order-context";

function trackingKey(restaurantId: string) {
  return `menulink:tracking:${restaurantId}`;
}

export default function MenuExperience({
  menu,
  tableLabel,
  loyaltyPointsPerSar,
  redemptionValueSar,
  theme,
  pushEnabled,
  vapidKey,
  branches,
}: {
  menu: PublicMenu;
  tableLabel: string | null;
  loyaltyPointsPerSar: number | null;
  redemptionValueSar: number;
  theme: ThemeConfig;
  pushEnabled: boolean;
  vapidKey: string;
  branches: PublicBranch[];
}) {
  const { orderType, setOrderType, delivery, setDelivery } = useOrderContext();
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tracking, setTracking] = useState<TrackingState | null>(null);
  const [trackingSheetOpen, setTrackingSheetOpen] = useState(false);
  const [closedPopup, setClosedPopup] = useState(false);
  const [customizerState, setCustomizerState] = useState<{
    item: PublicMenuItem;
    variant: PublicVariant | null;
    category: PublicCategory;
  } | null>(null);
  const [tableSessionId, setTableSessionId] = useState<string | null>(null);

  // Hydrate active car-order tracking + table session from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(trackingKey(menu.restaurant.id));
      if (raw) setTracking(JSON.parse(raw) as TrackingState);
    } catch {}
    if (tableLabel) {
      try {
        const sid = localStorage.getItem(`menulink:session:${menu.restaurant.id}:${tableLabel}`);
        if (sid) setTableSessionId(sid);
      } catch {}
    }
  }, [menu.restaurant.id, tableLabel]);

  function startTracking(t: TrackingState) {
    setTracking(t);
    try {
      localStorage.setItem(trackingKey(menu.restaurant.id), JSON.stringify(t));
    } catch {}
  }

  function updateTracking(patch: Partial<TrackingState>) {
    setTracking((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(trackingKey(menu.restaurant.id), JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function clearTracking() {
    setTracking(null);
    setTrackingSheetOpen(false);
    try {
      localStorage.removeItem(trackingKey(menu.restaurant.id));
    } catch {}
  }

  const lines = Object.values(cart);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  function buildLineId(
    slug: string,
    variantKey: string,
    modifiers: CartLineModifier[],
    note: string,
  ): string {
    const modPart = modifiers
      .map((m) => `${m.groupKey}=${m.selected.join(",")}`)
      .join("|");
    const notePart = note ? `n:${note}` : "";
    return [slug, variantKey, modPart, notePart].filter(Boolean).join("::");
  }

  function openCustomizer(
    item: PublicMenuItem,
    variant: PublicVariant | null,
    category: PublicCategory,
  ) {
    const { open } = isRestaurantOpen(menu.restaurant.hours_json);
    if (!open) {
      setClosedPopup(true);
      return;
    }
    if (item.variants.length === 0) return;
    setCustomizerState({ item, variant, category });
  }

  function addToCartSimple(item: PublicMenuItem, variant: PublicVariant) {
    const { open } = isRestaurantOpen(menu.restaurant.hours_json);
    if (!open) {
      setClosedPopup(true);
      return;
    }
    const lineId = `${item.slug}::${variant.key}`;
    setCart((c) => {
      const existing = c[lineId];
      return {
        ...c,
        [lineId]: existing
          ? { ...existing, qty: existing.qty + 1 }
          : {
              lineId,
              itemId: item.id,
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

  function addToCartCustomized(
    item: PublicMenuItem,
    variant: PublicVariant,
    qty: number,
    modifiers: CartLineModifier[],
    note: string,
  ) {
    const modDelta = modifiers.reduce((s, m) => s + m.priceDelta, 0);
    const effectivePrice = Number(variant.price) + modDelta;
    const lineId = buildLineId(item.slug, variant.key, modifiers, note);
    setCart((c) => {
      const existing = c[lineId];
      return {
        ...c,
        [lineId]: existing
          ? { ...existing, qty: existing.qty + qty }
          : {
              lineId,
              itemId: item.id,
              itemSlug: item.slug,
              itemName: item.name_ar,
              variantKey: variant.key,
              variantLabel: variant.label || null,
              price: effectivePrice,
              qty,
              imageUrl: item.image_url ?? SLUG_TO_IMG[item.slug] ?? null,
              modifiers: modifiers.length > 0 ? modifiers : undefined,
              itemNote: note || undefined,
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

  const hasCover = !!menu.restaurant.cover_image_url;

  return (
    <main
      className="bg-[var(--bg)] text-[var(--ink)] pb-28"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* TABLE BANNER — only when the customer arrived via a table QR */}
      {tableLabel && (
        <div
          className="bg-amber-400 text-amber-950 text-sm font-extrabold py-2 px-4 text-center"
          style={{ fontFamily: "var(--font-display)" }}
        >
          🪑 أنت تطلب من طاولة {tableLabel}
        </div>
      )}

      {/* DELIVERY INFO BANNER */}
      {orderType === "delivery" && delivery && (
        <div
          className="bg-green-50 border-b border-green-200 text-green-800 text-xs font-bold py-2 px-4 flex items-center justify-center gap-3"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span>🚗 توصيل · رسوم {toArabicDigits(String(delivery.deliveryFee))} ر.س</span>
          {delivery.estimatedMinutes && (
            <span className="text-green-600">· {toArabicDigits(String(delivery.estimatedMinutes))} دقيقة</span>
          )}
        </div>
      )}

      {/* HERO */}
      <header className="relative">
        {/* Push notification toggle — top-left in RTL = top-right visually */}
        <div className="absolute top-3 left-3 z-10">
          <PushToggle
            restaurantId={menu.restaurant.id}
            customerId={null}
            vapidKey={vapidKey}
            enabled={pushEnabled}
          />
        </div>
        {theme.headerStyle === "velora-hero" ? (
          <VeloraHero menu={menu} />
        ) : theme.headerStyle === "dark-navy" ? (
          <div className="bg-[var(--header-bg)] px-5 pt-8 pb-6">
            <div className="flex items-start gap-3">
              {menu.restaurant.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={menu.restaurant.logo_url}
                  alt={menu.restaurant.name}
                  className="w-16 h-16 rounded-2xl object-cover bg-white border-2 border-white/20 shadow-md shrink-0"
                />
              )}
              <div className="flex-1 min-w-0 pt-1">
                <h1
                  className="text-[var(--header-text)] font-extrabold leading-[1.05] text-3xl sm:text-4xl"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
                >
                  {menu.restaurant.name}
                </h1>
                {menu.restaurant.tagline_ar && (
                  <p className="text-white/75 text-sm mt-1 leading-snug">
                    {menu.restaurant.tagline_ar}
                  </p>
                )}
                {menu.restaurant.address_ar && (
                  <p className="text-white/60 text-xs mt-1.5">
                    📍 {menu.restaurant.address_ar}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : hasCover ? (
          <div className="relative w-full h-56 sm:h-72 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={menu.restaurant.cover_image_url!}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/30 to-black/10" />

            <div className="absolute inset-x-0 bottom-0 p-5 flex items-end gap-3">
              {menu.restaurant.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={menu.restaurant.logo_url}
                  alt={menu.restaurant.name}
                  className="w-16 h-16 rounded-2xl object-cover bg-white border-2 border-white shadow-md shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h1
                  className="text-white font-extrabold leading-[1.05] text-3xl sm:text-4xl drop-shadow-sm"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
                >
                  {menu.restaurant.name}
                </h1>
                {menu.restaurant.tagline_ar && (
                  <p className="text-white/85 text-sm mt-1 leading-snug">
                    {menu.restaurant.tagline_ar}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 pt-8 pb-5">
            <div className="flex items-start gap-3">
              {menu.restaurant.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={menu.restaurant.logo_url}
                  alt={menu.restaurant.name}
                  className="w-16 h-16 rounded-2xl object-cover bg-white border-2 border-white shadow-md shrink-0"
                />
              )}
              <div className="flex-1 min-w-0 pt-1">
                <h1
                  className="text-neutral-900 font-extrabold leading-[1.05] text-3xl"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
                >
                  {menu.restaurant.name}
                </h1>
                {menu.restaurant.tagline_ar && (
                  <p className="text-neutral-600 text-sm mt-1 leading-snug">
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
          </div>
        )}
      </header>

      {/* Address strip (if cover hides it) */}
      {hasCover && menu.restaurant.address_ar && (
        <div className="px-5 py-2 bg-white/60 text-xs text-neutral-700 border-b border-black/5">
          📍 {menu.restaurant.address_ar}
        </div>
      )}

      <OrderTypeSwitcher
        restaurantId={menu.restaurant.id}
        restaurantName={menu.restaurant.name}
        branches={branches}
        orderType={orderType}
        tableLabel={tableLabel}
        onOrderTypeChange={setOrderType}
        onDeliveryConfirm={setDelivery}
      />

      <CategoryTabs categories={menu.categories} categoryStyle={theme.categoryStyle} />

      <div className="px-4 mt-3">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-secondary,#71717a)]">
          <SarSymbol size={11} />
          <span>جميع الأسعار شاملة ضريبة القيمة المضافة</span>
        </div>
      </div>

      <PromotionsRail slug={menu.restaurant.slug} />

      {/* MENU SECTIONS — 2-col grid on mobile, 3 on sm, 4 on lg */}
      <div className="px-4 mt-5 space-y-8">
        {menu.categories.map((c) => (
          <section key={c.id} id={c.id}>
            <div className="flex items-baseline justify-between mb-3 px-1">
              <h2
                className="text-2xl font-extrabold text-neutral-900"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
              >
                {c.emoji && <span className="ml-2">{c.emoji}</span>}
                {c.name_ar}
              </h2>
              {c.info_ar && (
                <span className="text-[11px] text-neutral-500 font-medium">{c.info_ar}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {c.items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  premium={theme.menuCardStyle === "premium-lounge"}
                  hasDetailSheet={theme.hasItemDetailSheet}
                  onAdd={(v) =>
                    theme.hasItemDetailSheet
                      ? openCustomizer(item, v, c)
                      : addToCartSimple(item, v)
                  }
                  onTapCard={() =>
                    theme.hasItemDetailSheet
                      ? openCustomizer(item, null, c)
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* SFDA NUTRITION FOOTER — daily reference + allergen disclaimer */}
      <footer className="mt-10 mb-4 mx-4 space-y-3">
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 text-center space-y-2">
          <h3
            className="text-sm font-extrabold text-neutral-700"
            style={{ fontFamily: "var(--font-display)" }}
          >
            📊 الاحتياج اليومي المقدّر من السعرات الحرارية
          </h3>
          <div className="flex items-center justify-center gap-4 flex-wrap text-xs text-neutral-600">
            <span className="font-bold">👨 رجل: ~٢٥٠٠</span>
            <span className="font-bold">👩 امرأة: ~٢٠٠٠</span>
            <span className="font-bold">👦 طفل: ~١٤٠٠-٢٠٠٠</span>
          </div>
          <p className="text-[10px] text-neutral-400 leading-snug">
            القيم تقديرية وتختلف حسب العمر والنشاط البدني. المصدر: الهيئة العامة للغذاء والدواء (SFDA).
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1.5">
          <h3
            className="text-sm font-extrabold text-amber-900"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ⚠️ تنبيه حساسية الطعام
          </h3>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            يرجى إعلام الموظف بأي حساسية غذائية لديك <b>قبل الطلب</b>.
            قد تتواجد مسببات الحساسية في بيئة المطبخ حتى في الأصناف التي لا تحتوي عليها مباشرة.
          </p>
          <p className="text-[10px] text-amber-700 leading-snug">
            المسببات الـ١٤ الأساسية: جلوتين · حليب · بيض · أسماك · قشريات · فول سوداني · مكسرات · صويا · سمسم · كرفس · خردل · كبريتات · ترمس · رخويات.
          </p>
        </div>
      </footer>

      {/* STICKY BOTTOM CART BAR — only when cart has items */}
      {count > 0 && (
        <button
          onClick={() => setDrawerOpen(true)}
          className={
            "fixed bottom-3 inset-x-3 z-40 h-14 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.18)] flex items-center justify-between px-4 hover:opacity-95 active:translate-y-px " +
            (theme.cartBarStyle === "gold-navy"
              ? "bg-[var(--cta-bg)] text-[var(--cta-text)]"
              : "bg-[var(--brand)] text-white")
          }
          dir="rtl"
        >
          <span className="flex items-center gap-2">
            <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/15">
              <span className="text-lg">🛒</span>
              <span
                className="absolute -top-1.5 -left-1.5 bg-amber-400 text-amber-950 text-[10px] font-extrabold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
                style={{ fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}
              >
                {toArabicDigits(String(count))}
              </span>
            </span>
            <span className="font-extrabold text-base" style={{ fontFamily: "var(--font-display)" }}>
              السلة
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span
              className="text-lg font-extrabold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {toArabicDigits(String(total))} <SarSymbol size={18} />
            </span>
            <span className="text-xl">←</span>
          </span>
        </button>
      )}

      {/* TRACKING BAR — shown when a car-curbside order is in flight and cart is empty.
          Cart bar takes priority if both are active. */}
      {count === 0 && tracking && (
        <button
          onClick={() => setTrackingSheetOpen(true)}
          className="fixed bottom-3 inset-x-3 z-40 h-14 rounded-2xl bg-amber-500 text-amber-950 shadow-[0_8px_24px_rgba(0,0,0,0.18)] flex items-center justify-between px-4 hover:opacity-95 active:translate-y-px"
          dir="rtl"
        >
          <span className="flex items-center gap-2">
            <span className="text-2xl">🚗</span>
            <span className="font-extrabold text-base" style={{ fontFamily: "var(--font-display)" }}>
              {tracking.arrived ? "تم إبلاغ المطعم بوصولك" : "اضغط لإبلاغ المطعم بوصولك"}
            </span>
          </span>
          <span className="text-xl">←</span>
        </button>
      )}

      {/* CART DRAWER */}
      {drawerOpen && (
        <CartDrawer
          restaurant={menu.restaurant}
          branches={branches}
          lines={lines}
          total={total}
          tableLabel={tableLabel}
          loyaltyPointsPerSar={loyaltyPointsPerSar}
          redemptionValueSar={redemptionValueSar}
          sessionId={tableSessionId}
          onClose={() => setDrawerOpen(false)}
          onAdjust={adjustQty}
          onClear={clearCart}
          onCarOrderPlaced={startTracking}
          onTableOrderPlaced={(sid) => {
            setTableSessionId(sid);
            try {
              localStorage.setItem(`menulink:session:${menu.restaurant.id}:${tableLabel}`, sid);
            } catch {}
          }}
        />
      )}

      {/* TABLE SESSION BAR — running tab for dine-in */}
      {tableLabel && tableSessionId && (
        <TableSessionBar
          sessionId={tableSessionId}
          restaurantName={menu.restaurant.name}
          whatsappPhone={menu.restaurant.whatsapp_phone}
          tableLabel={tableLabel}
          onNewRound={() => setDrawerOpen(false)}
        />
      )}

      {/* TRACKING SHEET — the "I've arrived" flow for active car orders */}
      {trackingSheetOpen && tracking && (
        <TrackingSheet
          tracking={tracking}
          restaurantName={menu.restaurant.name}
          onClose={() => setTrackingSheetOpen(false)}
          onArrived={() => updateTracking({ arrived: true })}
          onClear={clearTracking}
        />
      )}

      {closedPopup && (
        <ClosedPopup
          restaurantName={menu.restaurant.name}
          hoursJson={menu.restaurant.hours_json}
          onClose={() => setClosedPopup(false)}
        />
      )}

      {customizerState && (
        <ItemCustomizerSheet
          item={customizerState.item}
          initialVariant={customizerState.variant}
          modifierConfig={customizerState.item.modifiers as PublicModifierConfig | null}
          onAddToCart={addToCartCustomized}
          onClose={() => setCustomizerState(null)}
        />
      )}
    </main>
  );
}
