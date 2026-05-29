"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { SLUG_TO_IMG } from "@/lib/koko-images";
import { toArabicDigits } from "@/lib/arabic";
import SarSymbol from "./sar-symbol";
import MenuItemCard from "./menu-item";
import type { ThemeConfig } from "@/lib/themes";
import type { PublicMenu, PublicMenuItem, PublicVariant } from "./types";

// "Premium Epicurean" customer browse layout — a dark/gold, photo-forward
// fine-dining menu. Distinct full-page layout (NOT the default card grid),
// selected via theme.menuLayout === "premium-epicurean" from the design
// library. Ports docs/design-print-studio/New folder/(1) into dynamic data:
// glass top bar, full-bleed featured-dish hero, sticky gold category pills,
// editorial photo-card sections (reusing the premium MenuItemCard), and a
// trust + SFDA-compliance footer. All ordering state stays in MenuExperience;
// this body receives the add-to-cart handler and renders functional slots
// (push toggle, order-type controls, promotions) passed from the parent.

function imgFor(item: PublicMenuItem): string | null {
  return item.image_url ?? SLUG_TO_IMG[item.slug] ?? null;
}

export default function PremiumEpicureanMenu({
  menu,
  theme,
  onAdd,
  pushToggle,
  controlsSlot,
  promotionsSlot,
}: {
  menu: PublicMenu;
  theme: ThemeConfig;
  onAdd: (item: PublicMenuItem, variant: PublicVariant) => void;
  pushToggle?: React.ReactNode;
  controlsSlot?: React.ReactNode;
  promotionsSlot?: React.ReactNode;
}) {
  const categories = menu.categories;
  const [activeId, setActiveId] = useState<string>(categories[0]?.id ?? "");
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const totalItems = useMemo(
    () => categories.reduce((s, c) => s + c.items.length, 0),
    [categories],
  );

  // Hero spotlight: first item that has a photo (deterministic, data-driven —
  // no invented copy). Falls back to the very first item.
  const featured = useMemo<PublicMenuItem | null>(() => {
    for (const c of categories) {
      const withImg = c.items.find((i) => imgFor(i));
      if (withImg) return withImg;
    }
    return categories[0]?.items[0] ?? null;
  }, [categories]);

  const featuredImg = featured ? imgFor(featured) : null;
  const featuredVariant = featured?.variants[0] ?? null;

  // Active category tracking — same IntersectionObserver pattern as the
  // heritage layout; keeps the sticky pill row in sync with the scroll.
  useEffect(() => {
    const sections = categories
      .map((c) => document.getElementById(c.id))
      .filter(Boolean) as HTMLElement[];
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-140px 0px -65% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    pillRefs.current[activeId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeId]);

  const scrollToCat = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - 124;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  return (
    <div
      className="min-h-[100dvh]"
      style={{
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* ===== Fixed glass top bar ===== */}
      <header
        className="fixed top-0 inset-x-0 z-50 h-16 flex items-center justify-between px-5"
        style={{
          background: "rgba(20,19,15,0.82)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--card-border)",
        }}
        dir="rtl"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {menu.restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={menu.restaurant.logo_url}
              alt={menu.restaurant.name}
              className="w-9 h-9 rounded-full object-cover shrink-0"
              style={{ border: "1px solid var(--accent-gold)" }}
            />
          ) : (
            <span
              className="grid place-items-center w-9 h-9 rounded-full shrink-0 text-lg"
              style={{ background: "var(--surface-elevated)", color: "var(--accent-gold)" }}
            >
              ✦
            </span>
          )}
          <span
            className="font-bold text-lg truncate"
            style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}
          >
            {menu.restaurant.name}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--card-border)",
            }}
          >
            {toArabicDigits(String(totalItems))} صنف
          </span>
          {pushToggle}
        </div>
      </header>

      {/* spacer for the fixed bar */}
      <div className="h-16" aria-hidden />

      <main className="max-w-[1280px] mx-auto px-5 pb-28">
        {/* ===== Hero — featured dish ===== */}
        {featured && (
          <section className="relative overflow-hidden rounded-2xl h-[420px] sm:h-[460px] flex items-end mt-4 mb-10">
            <div className="absolute inset-0 z-0">
              {featuredImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featuredImg}
                  alt={featured.name_ar}
                  className="w-full h-full object-cover"
                  style={{ filter: "brightness(0.62)" }}
                />
              ) : (
                <div className="w-full h-full" style={{ background: "var(--surface-elevated)" }} />
              )}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, var(--bg) 4%, rgba(20,19,15,0.45) 45%, transparent 78%)",
                }}
              />
            </div>
            <div className="relative z-10 p-7 sm:p-9 text-right max-w-2xl">
              <span
                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold mb-4 tracking-wider"
                style={{
                  background: "var(--accent-gold)",
                  color: "var(--on-primary, #412d00)",
                  fontFamily: "var(--font-display)",
                }}
              >
                اختيار الشيف
              </span>
              <h1
                className="font-bold leading-[1.1] mb-3 text-4xl sm:text-5xl"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--accent-gold)",
                  textShadow: "0 0 18px rgba(230,195,131,0.28)",
                  letterSpacing: "-0.01em",
                }}
              >
                {featured.name_ar}
              </h1>
              {featured.description_ar && (
                <p
                  className="text-sm sm:text-base leading-relaxed mb-6 line-clamp-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {featured.description_ar}
                </p>
              )}
              {featuredVariant && (
                <button
                  onClick={() => onAdd(featured, featuredVariant)}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-bold active:scale-95 transition-transform"
                  style={{
                    background: "var(--accent-gold)",
                    color: "var(--on-primary, #412d00)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  <span>أضف للطلب</span>
                  <span className="inline-flex items-center gap-1">
                    {toArabicDigits(String(featuredVariant.price))}
                    <SarSymbol size={14} />
                  </span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* functional controls passed from MenuExperience (order type, banners) */}
        {controlsSlot && <div className="mb-6">{controlsSlot}</div>}

        {/* VAT-inclusive note */}
        <div
          className="flex items-center justify-center gap-1.5 text-[11px] mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          <SarSymbol size={11} />
          <span>جميع الأسعار شاملة ضريبة القيمة المضافة</span>
        </div>

        {promotionsSlot}

        {/* ===== Sticky gold category pills ===== */}
        <nav
          className="sticky top-16 z-40 -mx-5 px-5 py-3"
          style={{
            background: "rgba(20,19,15,0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--card-border)",
          }}
          dir="rtl"
        >
          <div className="flex gap-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {categories.map((cat) => {
              const isActive = activeId === cat.id;
              return (
                <button
                  key={cat.id}
                  ref={(el) => {
                    pillRefs.current[cat.id] = el;
                  }}
                  onClick={() => scrollToCat(cat.id)}
                  className="shrink-0 px-5 py-2 rounded-full text-[13px] whitespace-nowrap transition-all duration-150"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: isActive ? 700 : 500,
                    border: isActive
                      ? "1px solid var(--accent-gold)"
                      : "1px solid var(--card-border)",
                    background: isActive ? "var(--accent-gold)" : "transparent",
                    color: isActive ? "var(--on-primary, #412d00)" : "var(--text-secondary)",
                    boxShadow: isActive ? "0 2px 12px rgba(230,195,131,0.25)" : "none",
                  }}
                >
                  {cat.name_ar}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ===== Menu sections — editorial header + photo-card grid ===== */}
        <div className="space-y-12 mt-10">
          {categories.map((cat) => (
            <section key={cat.id} id={cat.id} style={{ scrollMarginTop: "128px" }}>
              {/* editorial section header */}
              <div className="flex items-center gap-4 mb-6">
                <h2
                  className="font-bold text-2xl sm:text-3xl flex items-center gap-2.5 shrink-0"
                  style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
                >
                  <span style={{ color: "var(--accent-gold)" }}>✦</span>
                  {cat.emoji && <span className="text-xl">{cat.emoji}</span>}
                  {cat.name_ar}
                </h2>
                <span
                  className="flex-1 h-px"
                  style={{ background: "var(--divider)" }}
                  aria-hidden
                />
                {cat.info_ar && (
                  <span className="text-[11px] shrink-0" style={{ color: "var(--text-secondary)" }}>
                    {cat.info_ar}
                  </span>
                )}
              </div>

              {/* photo cards: 1-col on mobile (large appetizing photos), denser on wider screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {cat.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    premium
                    hasDetailSheet={false}
                    onAdd={(v) => onAdd(item, v)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ===== Trust + SFDA compliance footer ===== */}
        <footer className="mt-16 space-y-4">
          {/* premium trust row */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 rounded-2xl"
            style={{ background: "var(--surface-elevated)", border: "1px solid var(--card-border)" }}
          >
            {[
              { t: "أفضل الطهاة", s: "خبرة عالمية" },
              { t: "مصادر طازجة", s: "من المزرعة" },
              { t: "تجربة مميزة", s: "أجواء حصرية" },
              { t: "جودة معتمدة", s: "معايير عالية" },
            ].map((f) => (
              <div key={f.t} className="text-center">
                <div className="text-xl mb-1" style={{ color: "var(--accent-gold)" }}>
                  ✦
                </div>
                <p className="text-[12px] font-bold" style={{ color: "var(--ink)" }}>
                  {f.t}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {f.s}
                </p>
              </div>
            ))}
          </div>

          {/* SFDA daily-calorie reference (kept for compliance) */}
          <div
            className="rounded-2xl p-4 text-center space-y-2"
            style={{ background: "var(--surface-deep, #0f0e0a)", border: "1px solid var(--card-border)" }}
          >
            <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}>
              📊 الاحتياج اليومي المقدّر من السعرات الحرارية
            </h3>
            <div className="flex items-center justify-center gap-4 flex-wrap text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="font-bold">👨 رجل: ~٢٥٠٠</span>
              <span className="font-bold">👩 امرأة: ~٢٠٠٠</span>
              <span className="font-bold">👦 طفل: ~١٤٠٠-٢٠٠٠</span>
            </div>
            <p className="text-[10px] leading-snug" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
              القيم تقديرية وتختلف حسب العمر والنشاط البدني. المصدر: الهيئة العامة للغذاء والدواء (SFDA).
            </p>
          </div>

          {/* SFDA allergen disclaimer (kept for compliance) */}
          <div
            className="rounded-2xl p-4 space-y-1.5"
            style={{ background: "var(--surface-deep, #0f0e0a)", border: "1px solid var(--card-border)" }}
          >
            <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}>
              ⚠️ تنبيه حساسية الطعام
            </h3>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              يرجى إعلام الموظف بأي حساسية غذائية لديك <b>قبل الطلب</b>. قد تتواجد مسببات الحساسية في بيئة
              المطبخ حتى في الأصناف التي لا تحتوي عليها مباشرة.
            </p>
            <p className="text-[10px] leading-snug" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
              المسببات الـ١٤ الأساسية: جلوتين · حليب · بيض · أسماك · قشريات · فول سوداني · مكسرات · صويا ·
              سمسم · كرفس · خردل · كبريتات · ترمس · رخويات.
            </p>
          </div>

          <p className="text-center text-[10px] pt-2" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>
            Powered by MenuLink
          </p>
        </footer>
      </main>
    </div>
  );
}
