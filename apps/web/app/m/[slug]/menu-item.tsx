"use client";

import { SLUG_TO_IMG } from "@/lib/koko-images";
import type { PublicMenuItem, PublicVariant } from "./types";

// One item card. Image on the right (RTL = visual start), content on the left.
// Variant pills below content. Tapping a variant adds it to cart.
// Premium badge in Crispy Gold, hot badge in red — both with leading emoji
// per DESIGN.md §4 (emojis allowed as data, not as chrome).
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
    <article className="bg-white rounded-2xl border border-neutral-200/70 overflow-hidden">
      <div className="flex gap-3 p-3">
        {/* image */}
        <div className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-neutral-100 relative">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={item.name_ar}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-neutral-400">
              🍽️
            </div>
          )}
          {isPremium && (
            <span className="absolute top-1.5 right-1.5 bg-amber-400 text-amber-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              ✨ مميز
            </span>
          )}
          {isHot && (
            <span className="absolute bottom-1.5 right-1.5 bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              🌶️ حار
            </span>
          )}
        </div>

        {/* content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-bold text-neutral-900 text-base leading-tight">
            {item.name_ar}
          </h3>
          {item.description_ar && (
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              {item.description_ar}
            </p>
          )}
          <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
            {item.variants.map((v) => (
              <button
                key={v.key}
                onClick={() => onAdd(v)}
                className="inline-flex items-baseline gap-1.5 h-9 px-3 rounded-full bg-[var(--brand)] text-white text-sm font-semibold active:translate-y-px hover:opacity-90"
                aria-label={`أضف ${item.name_ar}${v.label ? ` ${v.label}` : ""}`}
              >
                {v.label && (
                  <span className="text-[11px] opacity-85 font-medium">{v.label}</span>
                )}
                <span className="font-bold">{toArabicDigits(String(v.price))}</span>
                <span className="text-[10px] opacity-80">ر.س</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

// Convert Latin digits in a string to Arabic-Indic. DESIGN.md §3:
// prices in Customer PWA use Arabic-Indic numerals (٢٤ ر.س), not Latin (24).
function toArabicDigits(s: string): string {
  const map: Record<string, string> = {
    "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
    "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩",
  };
  return s.replace(/[0-9]/g, (d) => map[d] ?? d);
}
