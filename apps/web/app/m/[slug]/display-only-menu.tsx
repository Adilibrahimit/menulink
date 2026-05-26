"use client";

import { SLUG_TO_IMG } from "@/lib/koko-images";
import { ALLERGEN_MAP } from "@/lib/allergens";
import { toArabicDigits } from "@/lib/arabic";
import SarSymbol from "./sar-symbol";
import CategoryTabs from "./category-tabs";
import type { PublicMenu, PublicMenuItem, PublicCategory } from "./types";
import type { ThemeConfig } from "@/lib/themes";

export default function DisplayOnlyMenu({
  menu,
  theme,
}: {
  menu: PublicMenu;
  theme: ThemeConfig;
}) {
  const hasCover = !!menu.restaurant.cover_image_url;

  return (
    <main
      className="bg-[var(--bg)] text-[var(--ink)] min-h-[100dvh]"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* HERO */}
      <header className="relative">
        {theme.headerStyle === "dark-navy" ? (
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
                  <p className="text-neutral-500 text-sm mt-1 leading-snug">
                    {menu.restaurant.tagline_ar}
                  </p>
                )}
                {menu.restaurant.address_ar && (
                  <p className="text-neutral-400 text-xs mt-1.5">
                    📍 {menu.restaurant.address_ar}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* CATEGORY TABS */}
      <CategoryTabs categories={menu.categories} categoryStyle={theme.categoryStyle} />

      {/* MENU ITEMS */}
      <div className="px-4 py-4 space-y-8">
        {menu.categories.map((cat: PublicCategory) => (
          <section key={cat.id} id={cat.id}>
            <h2
              className="text-lg font-extrabold text-neutral-900 mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {cat.emoji && <span className="ml-1">{cat.emoji}</span>} {cat.name_ar}
            </h2>
            {cat.info_ar && (
              <p className="text-xs text-neutral-500 -mt-2 mb-3">{cat.info_ar}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cat.items.map((item: PublicMenuItem) => (
                <DisplayCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function DisplayCard({ item }: { item: PublicMenuItem }) {
  const img = item.image_url ?? SLUG_TO_IMG[item.slug] ?? null;
  const isPremium = item.badges?.some((b) => b.type === "premium");
  const isHot = item.badges?.some((b) => b.type === "hot");

  return (
    <article className="bg-white rounded-2xl overflow-hidden border border-black/5 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.04)] flex flex-col">
      <div className="relative aspect-square bg-neutral-100 overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={item.name_ar}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-neutral-300">
            🍽️
          </div>
        )}
        {(isPremium || isHot) && (
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/15 to-transparent pointer-events-none" />
        )}
        {isPremium && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-amber-400 text-amber-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full leading-none shadow-sm">
            ✨ مميز
          </span>
        )}
        {isHot && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full leading-none shadow-sm">
            🌶️ حار
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <h3
          className="font-extrabold text-neutral-900 leading-tight text-[15px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {item.name_ar}
        </h3>
        {item.description_ar && (
          <p className="text-[11px] text-neutral-500 leading-snug -mt-1 line-clamp-2">
            {item.description_ar}
          </p>
        )}

        {(item.calories_kcal || item.sodium_mg || item.caffeine_mg) && (
          <div className="flex flex-wrap items-center gap-1.5 -mt-0.5">
            {item.calories_kcal != null && item.calories_kcal > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none">
                🔥 {toArabicDigits(String(item.calories_kcal))} سعرة
              </span>
            )}
            {item.sodium_mg != null && item.sodium_mg > 2000 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-full px-1.5 py-0.5 leading-none">
                🧂 عالي الملح
              </span>
            )}
            {item.caffeine_mg != null && item.caffeine_mg > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-full px-1.5 py-0.5 leading-none">
                ☕ {toArabicDigits(String(item.caffeine_mg))} ملجم
              </span>
            )}
          </div>
        )}

        {item.allergens && item.allergens.length > 0 && (
          <p className="text-[9px] text-neutral-500 leading-snug -mt-0.5">
            ⚠️ {item.allergens.map((k) => ALLERGEN_MAP.get(k)?.label_ar ?? k).join(" · ")}
          </p>
        )}

        {/* Prices — static display, no add-to-cart */}
        <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
          {item.variants.map((v) => (
            <span
              key={v.key}
              className="flex-1 min-w-[88px] inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-full bg-neutral-100 text-neutral-800 text-[11px] font-extrabold"
            >
              {v.label && (
                <span className="text-[10px] font-semibold opacity-70">
                  {v.label}
                </span>
              )}
              <span className="text-sm font-extrabold">
                {toArabicDigits(String(v.price))}
              </span>
              <SarSymbol size={10} className="opacity-60" />
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
