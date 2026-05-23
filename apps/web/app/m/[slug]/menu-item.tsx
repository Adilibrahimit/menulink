"use client";

import { SLUG_TO_IMG } from "@/lib/koko-images";
import { ALLERGEN_MAP } from "@/lib/allergens";
import type { PublicMenuItem, PublicVariant } from "./types";

// Stitch "Vibrant Poultry" card. Image fills the top of the card, square
// aspect ratio for grid consistency. Badges overlay the image at the corners.
// Variant chips at the bottom double as add-to-cart buttons.
//
// Designed for a 2-column grid on mobile, 3-4 columns on tablet+.
export default function MenuItemCard({
  item,
  onAdd,
}: {
  item: PublicMenuItem;
  onAdd: (variant: PublicVariant) => void;
}) {
  const img = item.image_url ?? SLUG_TO_IMG[item.slug] ?? null;
  const isPremium = item.badges?.some((b) => b.type === "premium");
  const isHot = item.badges?.some((b) => b.type === "hot");

  return (
    <article className="bg-white rounded-2xl overflow-hidden border border-black/5 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.04)] flex flex-col group">
      {/* IMAGE — fills card top, top-rounded only, bleeds to edges */}
      <div className="relative aspect-square bg-neutral-100 overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={item.name_ar}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-neutral-300">
            🍽️
          </div>
        )}

        {/* Subtle gradient at bottom for badge legibility if hot/premium */}
        {(isPremium || isHot) && (
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/15 to-transparent pointer-events-none" />
        )}

        {/* Premium badge — Crispy Gold pill top-right */}
        {isPremium && (
          <span
            className="absolute top-2 right-2 inline-flex items-center gap-1 bg-amber-400 text-amber-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full leading-none shadow-sm"
            style={{ fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}
          >
            ✨ مميز
          </span>
        )}
        {/* Hot badge — Signature Red pill top-left */}
        {isHot && (
          <span
            className="absolute top-2 left-2 inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full leading-none shadow-sm"
            style={{ fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}
          >
            🌶️ حار
          </span>
        )}
      </div>

      {/* CONTENT — name + nutrition + variants */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <h3
          className="font-extrabold text-neutral-900 leading-tight text-[15px]"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          {item.name_ar}
        </h3>
        {item.description_ar && (
          <p className="text-[11px] text-neutral-500 leading-snug -mt-1 line-clamp-2">
            {item.description_ar}
          </p>
        )}

        {/* SFDA nutrition line: calories + sodium flag + caffeine */}
        {(item.calories_kcal || item.sodium_mg || item.caffeine_mg) && (
          <div className="flex flex-wrap items-center gap-1.5 -mt-0.5">
            {item.calories_kcal != null && item.calories_kcal > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none">
                🔥 {toArabicDigits(String(item.calories_kcal))} سعرة
              </span>
            )}
            {item.sodium_mg != null && item.sodium_mg > 2000 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-full px-1.5 py-0.5 leading-none" title="عالي الملح (أكثر من 2000 ملجم صوديوم)">
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

        {/* SFDA allergen disclosure */}
        {item.allergens && item.allergens.length > 0 && (
          <p className="text-[9px] text-neutral-500 leading-snug -mt-0.5" title="مسببات الحساسية">
            ⚠️ {item.allergens.map((k) => ALLERGEN_MAP.get(k)?.label_ar ?? k).join(" · ")}
          </p>
        )}

        {/* Variant pills as add-to-cart buttons */}
        <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
          {item.variants.map((v) => (
            <button
              key={v.key}
              onClick={() => onAdd(v)}
              className="flex-1 min-w-[88px] inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-full bg-[var(--brand)] text-white text-[11px] font-extrabold active:translate-y-px hover:opacity-90 shadow-sm shadow-black/5"
              aria-label={`أضف ${item.name_ar}${v.label ? ` ${v.label}` : ""}`}
            >
              {v.label && (
                <span className="text-[10px] font-semibold opacity-85">
                  {v.label}
                </span>
              )}
              <span className="text-sm font-extrabold">
                {toArabicDigits(String(v.price))}
              </span>
              <span className="text-[9px] opacity-80 font-semibold">ر.س</span>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function toArabicDigits(s: string): string {
  const map: Record<string, string> = {
    "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
    "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩",
  };
  return s.replace(/[0-9]/g, (d) => map[d] ?? d);
}
