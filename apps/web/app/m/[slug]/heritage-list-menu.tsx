"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SLUG_TO_IMG } from "@/lib/koko-images";
import type { PublicMenu, PublicMenuItem, PublicCategory } from "./types";
import type { ThemeConfig } from "@/lib/themes";

export default function HeritageListMenu({
  menu,
  theme,
}: {
  menu: PublicMenu;
  theme: ThemeConfig;
}) {
  const [activeId, setActiveId] = useState<string>(menu.categories[0]?.id ?? "");
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sections = menu.categories
      .map((c) => document.getElementById(c.id))
      .filter(Boolean) as HTMLElement[];
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px" },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [menu.categories]);

  useEffect(() => {
    const pill = pillRefs.current[activeId];
    if (pill) {
      pill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeId]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <main
      className="min-h-[100dvh]"
      style={{
        fontFamily: "var(--font-body)",
        background: "var(--bg)",
        color: "var(--ink)",
        backgroundImage:
          "radial-gradient(circle at 50% 50%, rgba(201,169,97,0.04) 1px, transparent 1px), radial-gradient(circle at 0% 0%, rgba(201,169,97,0.025) 1px, transparent 1px)",
        backgroundSize: "32px 32px, 24px 24px",
        backgroundPosition: "0 0, 16px 16px",
      }}
    >
      {/* HERO */}
      <header
        className="relative text-center overflow-hidden isolate"
        style={{
          background: "var(--header-bg)",
          color: "var(--header-text)",
          padding: "32px 24px 40px",
          borderBottom: "1px solid var(--accent-gold)",
          boxShadow: "0 4px 12px rgba(15,45,38,0.15)",
        }}
      >
        {/* Decorative radial glows */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            top: -100, right: -80, width: 280, height: 280, zIndex: 0,
            background: "radial-gradient(circle, rgba(201,169,97,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            bottom: -120, left: -60, width: 240, height: 240, zIndex: 0,
            background: "radial-gradient(circle, rgba(201,169,97,0.1) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10">
          {/* Dallah SVG icon */}
          <svg
            className="mx-auto mb-3.5"
            width="56" height="56" viewBox="0 0 100 100" fill="none"
          >
            <path
              d="M 30 35 Q 30 25 40 25 L 55 25 Q 60 25 60 30 L 60 32 L 70 38 L 65 42 L 60 40 L 60 55 Q 60 70 50 75 L 35 75 Q 25 70 25 55 L 25 40 Q 25 35 30 35 Z"
              stroke="var(--accent-gold)" strokeWidth="2.5" strokeLinejoin="round" fill="none"
            />
          </svg>

          <h1
            className="text-[28px] font-bold mb-1"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.5px",
              color: "var(--header-text)",
            }}
          >
            {menu.restaurant.name}
          </h1>

          {/* Ornamental divider */}
          <div className="flex items-center justify-center gap-2.5 mx-auto max-w-[220px] my-2.5">
            <span className="flex-1 h-px opacity-50" style={{ background: "var(--accent-gold)" }} />
            <span
              className="w-[5px] h-[5px] rounded-full"
              style={{
                background: "var(--accent-gold)",
                boxShadow: "0 0 0 3px rgba(201,169,97,0.15)",
              }}
            />
            <span className="flex-1 h-px opacity-50" style={{ background: "var(--accent-gold)" }} />
          </div>

          <p
            className="text-sm italic mb-0.5"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: "var(--accent-gold)",
              letterSpacing: "0.5px",
            }}
          >
            Making memories, one cup at a time
          </p>

          {menu.restaurant.tagline_ar && (
            <p
              className="text-[13px] font-light opacity-75"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {menu.restaurant.tagline_ar}
            </p>
          )}

          {/* Info bar */}
          <div
            className="flex justify-center gap-7 mt-[22px] pt-[18px]"
            style={{ borderTop: "1px solid rgba(201,169,97,0.2)" }}
          >
            <div className="text-center">
              <div
                className="text-lg font-semibold leading-none"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "var(--accent-gold)" }}
              >
                24/7
              </div>
              <div className="text-[10px] tracking-widest opacity-70 mt-1 uppercase">مفتوح</div>
            </div>
            <div className="text-center">
              <div
                className="text-lg font-semibold leading-none"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "var(--accent-gold)" }}
              >
                +18
              </div>
              <div className="text-[10px] tracking-widest opacity-70 mt-1 uppercase">كبار</div>
            </div>
            <div className="text-center">
              <div
                className="text-lg font-semibold leading-none"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "var(--accent-gold)" }}
              >
                {menu.categories.length}
              </div>
              <div className="text-[10px] tracking-widest opacity-70 mt-1 uppercase">تصنيف</div>
            </div>
          </div>
        </div>
      </header>

      {/* CATEGORY NAV — pills on dark emerald */}
      <nav
        className="sticky top-0 z-50 py-3"
        style={{
          background: "var(--header-bg)",
          borderBottom: "1px solid var(--accent-gold)",
        }}
      >
        <div
          ref={scrollRef}
          className="flex gap-2 px-4 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {menu.categories.map((cat) => {
            const isActive = activeId === cat.id;
            return (
              <button
                key={cat.id}
                ref={(el) => { pillRefs.current[cat.id] = el; }}
                onClick={() => scrollTo(cat.id)}
                className="shrink-0 px-4 py-[7px] rounded-md text-[13px] whitespace-nowrap transition-all duration-150"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: "0.3px",
                  border: isActive
                    ? "1px solid var(--accent-gold)"
                    : "1px solid rgba(201,169,97,0.4)",
                  color: isActive ? "var(--header-bg)" : "var(--header-text)",
                  background: isActive ? "var(--accent-gold)" : "transparent",
                  boxShadow: isActive ? "0 2px 8px rgba(201,169,97,0.3)" : "none",
                }}
              >
                {cat.name_ar}
              </button>
            );
          })}
        </div>
      </nav>

      {/* MENU SECTIONS */}
      <div className="max-w-[800px] mx-auto pb-[60px]">
        {menu.categories.map((cat: PublicCategory) => (
          <section
            key={cat.id}
            id={cat.id}
            className="px-5 pt-8 pb-2"
            style={{ scrollMarginTop: "80px" }}
          >
            {/* Section header with ornamental line */}
            <div className="text-center mb-6 relative">
              <div className="absolute top-1/2 right-[10%] left-[10%] h-px opacity-40" style={{ background: "var(--accent-gold)" }} />
              <span
                className="relative z-10 inline-block px-5 text-2xl font-bold"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--header-bg)",
                  background: "var(--bg)",
                }}
              >
                {cat.name_ar}
              </span>
              {/* Three-dot ornament */}
              <div className="flex justify-center items-center gap-1.5 mt-3">
                <span className="w-5 h-px opacity-50" style={{ background: "var(--accent-gold)" }} />
                <span className="w-1 h-1 rounded-full" style={{ background: "var(--accent-gold)" }} />
                <span className="w-5 h-px opacity-50" style={{ background: "var(--accent-gold)" }} />
              </div>
            </div>

            {/* Items list */}
            <div className="flex flex-col gap-3.5">
              {cat.items.map((item: PublicMenuItem) => (
                <HeritageItem key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* FOOTER */}
      <footer
        className="text-center"
        style={{
          background: "var(--header-bg)",
          color: "var(--header-text)",
          padding: "40px 24px 32px",
          borderTop: "1px solid var(--accent-gold)",
          marginTop: "40px",
        }}
      >
        <div className="flex justify-center items-center gap-2 mb-5">
          <span className="w-[30px] h-px opacity-50" style={{ background: "var(--accent-gold)" }} />
          <span style={{ color: "var(--accent-gold)", fontSize: 14 }}>☕</span>
          <span className="w-[30px] h-px opacity-50" style={{ background: "var(--accent-gold)" }} />
        </div>
        <p className="text-xl font-bold mb-1.5" style={{ fontFamily: "var(--font-display)" }}>
          {menu.restaurant.name}
        </p>
        <p
          className="text-[13px] italic mb-6"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: "var(--accent-gold)",
            letterSpacing: "0.5px",
          }}
        >
          Making memories, one cup at a time
        </p>
        {menu.restaurant.address_ar && (
          <p className="text-xs opacity-60 mt-4">📍 {menu.restaurant.address_ar}</p>
        )}
        <p className="text-[10px] opacity-40 mt-6">Powered by MenuLink</p>
      </footer>
    </main>
  );
}

function HeritageItem({ item }: { item: PublicMenuItem }) {
  const img = item.image_url ?? SLUG_TO_IMG[item.slug] ?? null;
  const price = item.variants[0]?.price ?? null;
  const isAsk = price === 0 && item.variants[0]?.label === "اسأل";
  const subtitle = item.description_ar || null;

  return (
    <article
      className="grid items-center gap-2.5 rounded-xl transition-all duration-150"
      style={{
        gridTemplateColumns: "auto 1fr auto",
        padding: "12px 14px",
        background: "var(--card-bg)",
        border: "1px solid transparent",
        boxShadow: "0 2px 8px rgba(42,24,16,0.06), 0 1px 2px rgba(42,24,16,0.04)",
      }}
    >
      {/* Thumbnail */}
      <div
        className="w-14 h-14 rounded-md shrink-0 overflow-hidden grid place-items-center"
        style={{
          background: "linear-gradient(135deg, var(--header-bg) 0%, #1A4A3F 100%)",
        }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={item.name_ar} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ color: "var(--accent-gold)", opacity: 0.6 }}>
            <ellipse cx="16" cy="16" rx="9" ry="13" stroke="currentColor" strokeWidth="1.8" />
            <path d="M 16 4 Q 16 16 16 28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Name + English subtitle */}
      <div className="min-w-0">
        <span
          className="text-base font-semibold leading-snug inline"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--ink)",
          }}
        >
          {item.name_ar}
        </span>
        {subtitle && (
          <span
            className="block text-xs mt-0.5"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--text-secondary)",
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {/* Price */}
      <div
        className="whitespace-nowrap"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 600,
          fontSize: isAsk ? 13 : 22,
          lineHeight: 1,
          color: isAsk ? "var(--calorie-text)" : "var(--header-bg)",
        }}
      >
        {isAsk ? (
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>اسأل</span>
        ) : price != null ? (
          <>
            {price}
            <span
              className="mr-1"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--calorie-text)",
                letterSpacing: "0.5px",
              }}
            >
              ر.س
            </span>
          </>
        ) : null}
      </div>
    </article>
  );
}
