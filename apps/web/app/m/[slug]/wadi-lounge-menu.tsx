"use client";

// Wadi Almusafir — bespoke display-only lounge layout.
// Faithful to the client's own poster: near-black canvas, warm metallic gold,
// Arabesque-framed cards, hexagonal "السعر / ٣٥ / ريال" price badges, bilingual
// (English under Arabic). Top-of-page Google-review banner when google_review_url is set.
// NOT related to Mazaj Almosafer despite the similar Arabic name.

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import type { PublicMenu, PublicMenuItem, PublicCategory } from "./types";
import type { ThemeConfig } from "@/lib/themes";

export default function WadiLoungeMenu({
  menu,
  theme,
}: {
  menu: PublicMenu;
  theme: ThemeConfig;
}) {
  const bilingual = theme.bilingual ?? true;
  const taglineEn = theme.heroTaglineEn ?? null;
  const reviewUrl = menu.restaurant.google_review_url ?? null;
  const logoUrl = menu.restaurant.logo_url;

  const [activeId, setActiveId] = useState<string>(menu.categories[0]?.id ?? "");
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const sections = menu.categories
      .map((c) => document.getElementById(c.id))
      .filter(Boolean) as HTMLElement[];
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActiveId(entry.target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [menu.categories]);

  useEffect(() => {
    pillRefs.current[activeId]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
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
          "radial-gradient(circle at 18% 12%, rgba(var(--dot-color),0.06) 0%, transparent 42%), radial-gradient(circle at 85% 8%, rgba(var(--dot-color),0.05) 0%, transparent 40%)",
      }}
    >
      {/* GOOGLE-REVIEW BANNER (top of page) */}
      {reviewUrl && <GoogleReviewBanner url={reviewUrl} />}

      {/* HERO */}
      <header
        className="relative text-center overflow-hidden isolate"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, rgba(var(--dot-color),0.16) 0%, transparent 60%), var(--header-bg)",
          color: "var(--header-text)",
          padding: "30px 22px 34px",
          borderBottom: "1px solid var(--accent-gold)",
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={menu.restaurant.name}
            className="mx-auto mb-2 h-[104px] w-auto object-contain"
            style={{ filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.5))" }}
          />
        ) : (
          <ShishaMark />
        )}

        <h1
          className="text-[30px] font-bold leading-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)", letterSpacing: "0.5px" }}
        >
          {menu.restaurant.name}
        </h1>
        {bilingual && (
          <p
            className="text-[12px] tracking-[0.42em] uppercase mt-0.5"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "var(--gold-soft)", opacity: 0.85 }}
          >
            Wadi Almusafir
          </p>
        )}

        <Flourish />

        {menu.restaurant.tagline_ar && (
          <p className="text-[13px] font-light tracking-wide" style={{ color: "var(--text-secondary)" }}>
            {menu.restaurant.tagline_ar}
          </p>
        )}

        <p
          className="mt-3 text-[17px] font-bold"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          أهلاً بكم في {menu.restaurant.name}
        </p>

        {/* session-duration note (from their poster) */}
        <div
          className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
          style={{ border: "1px solid var(--card-border)", background: "rgba(var(--dot-color),0.06)" }}
        >
          <span style={{ color: "var(--accent-gold)" }}>⏱</span>
          <span className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>مدة الجلسة</span>
          <span className="text-[13px] font-bold" style={{ color: "var(--accent-gold)", fontFamily: "var(--font-display)" }}>
            ساعتين
          </span>
        </div>
      </header>

      {/* CATEGORY PILLS */}
      <nav
        className="sticky top-0 z-50 py-3"
        style={{ background: "rgba(11,8,5,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--divider)" }}
      >
        <div className="flex gap-2 px-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
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
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: "0.2px",
                  border: isActive ? "1px solid var(--accent-gold)" : "1px solid var(--card-border)",
                  color: isActive ? "var(--cta-text)" : "var(--ink)",
                  background: isActive ? "var(--accent-gold)" : "transparent",
                }}
              >
                {cat.name_ar}
              </button>
            );
          })}
        </div>
      </nav>

      {/* SECTIONS */}
      <div className="max-w-[820px] mx-auto pb-[56px] px-4">
        {menu.categories.map((cat: PublicCategory) => (
          <section key={cat.id} id={cat.id} className="pt-9 pb-1" style={{ scrollMarginTop: "84px" }}>
            <SectionHeader cat={cat} bilingual={bilingual} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
              {cat.items.map((item: PublicMenuItem) => (
                <WadiCard key={item.id} item={item} bilingual={bilingual} isShisha={cat.slug.startsWith("shisha")} />
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
          padding: "38px 24px 30px",
          borderTop: "1px solid var(--accent-gold)",
          marginTop: "32px",
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={menu.restaurant.name} className="mx-auto mb-3 h-[64px] w-auto object-contain" />
        ) : (
          <ShishaMark small />
        )}
        <p className="text-lg font-bold mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}>
          {menu.restaurant.name}
        </p>
        <p className="text-[13px] mb-5" style={{ color: "var(--text-secondary)" }}>نسعد بخدمتكم</p>

        <div className="flex flex-col items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          {menu.restaurant.instagram_handle && (
            <a
              href={`https://instagram.com/${menu.restaurant.instagram_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5"
              style={{ color: "var(--gold-soft)" }}
            >
              <span>◎</span> @{menu.restaurant.instagram_handle}
            </a>
          )}
          {menu.restaurant.whatsapp_phone && (
            <span dir="ltr">☎ {formatPhone(menu.restaurant.whatsapp_phone)}</span>
          )}
          {menu.restaurant.address_ar && <span>📍 {menu.restaurant.address_ar}</span>}
        </div>

        {taglineEn && (
          <p
            className="text-[12px] italic mt-5"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "var(--accent-gold)" }}
          >
            {taglineEn}
          </p>
        )}

        {/* SFDA disclosure — required alongside calorie display */}
        <p className="text-[10px] leading-relaxed mt-6 max-w-[440px] mx-auto" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
          🔥 السعرات الحرارية موضّحة لكل صنف. متوسط الاحتياج اليومي: الرجال ٢٥٠٠ · النساء ٢٠٠٠ · الأطفال ١٤٠٠–٢٠٠٠ سعرة حرارية.
          قد تحتوي بعض الأصناف على مسببات حساسية — يُرجى إبلاغنا قبل الطلب.
        </p>

        <p className="text-[10px] mt-5" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>Powered by MenuLink</p>
      </footer>
    </main>
  );
}

/* ---------- Google review banner ---------- */
function GoogleReviewBanner({ url }: { url: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#0B0805", light: "#F3E9D6" },
    })
      .then(setQr)
      .catch(() => {});
  }, [url]);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3.5 px-4 py-3 active:opacity-90"
      style={{
        background: "linear-gradient(90deg, rgba(217,182,92,0.10), rgba(217,182,92,0.04))",
        borderBottom: "1px solid var(--accent-gold)",
      }}
    >
      <div
        className="shrink-0 rounded-md p-1"
        style={{ background: "var(--ink)", border: "1px solid var(--accent-gold)" }}
      >
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR تقييم Google" width={62} height={62} className="block" />
        ) : (
          <div style={{ width: 62, height: 62 }} />
        )}
      </div>
      <div className="flex-1 text-right">
        <div className="flex items-center gap-1.5" style={{ color: "var(--accent-gold)" }}>
          <span>⭐</span>
          <span className="text-[15px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
            قيّمنا على Google
          </span>
        </div>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
          رأيك يهمنا · امسح الرمز أو اضغط هنا للتقييم
        </p>
      </div>
      <span
        className="shrink-0 text-[12px] font-bold rounded-full px-3 py-1.5"
        style={{ background: "var(--accent-gold)", color: "var(--cta-text)", fontFamily: "var(--font-display)" }}
      >
        قيّم الآن
      </span>
    </a>
  );
}

/* ---------- section header ---------- */
function SectionHeader({ cat, bilingual }: { cat: PublicCategory; bilingual: boolean }) {
  return (
    <div className="text-center mb-5">
      <div className="flex items-center justify-center gap-3">
        <span className="h-px w-10 opacity-50" style={{ background: "var(--accent-gold)" }} />
        <span className="text-[7px]" style={{ color: "var(--accent-gold)" }}>◆</span>
        <h2 className="text-[22px] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--accent-gold)" }}>
          {cat.name_ar}
        </h2>
        <span className="text-[7px]" style={{ color: "var(--accent-gold)" }}>◆</span>
        <span className="h-px w-10 opacity-50" style={{ background: "var(--accent-gold)" }} />
      </div>
      {bilingual && cat.name_en && (
        <p
          className="text-[13px] font-semibold tracking-[0.22em] uppercase mt-1"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "var(--gold-soft)" }}
        >
          {cat.name_en}
        </p>
      )}
    </div>
  );
}

/* ---------- item card (Arabesque-framed) ---------- */
function WadiCard({ item, bilingual, isShisha }: { item: PublicMenuItem; bilingual: boolean; isShisha?: boolean }) {
  const img = item.image_url ?? null;
  const v = item.variants[0];
  const price = v?.price ?? null;
  const isAsk = v?.price === 0 && v?.label === "اسأل";

  return (
    <article
      className="relative rounded-xl overflow-hidden flex flex-col"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        boxShadow: "inset 0 0 0 1px rgba(var(--dot-color),0.10), 0 6px 18px rgba(0,0,0,0.45)",
      }}
    >
      <CornerFrame />

      {/* image */}
      <div
        className="relative w-full aspect-square overflow-hidden grid place-items-center"
        style={{ background: "linear-gradient(150deg, var(--card-bg) 0%, var(--card-fallback-to) 100%)" }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={item.name_ar} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl opacity-30" style={{ color: "var(--accent-gold)" }}>۞</span>
        )}
        {item.calories_kcal != null && item.calories_kcal > 0 && (
          <span
            className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(11,8,5,0.78)",
              color: "var(--calorie-text)",
              border: "1px solid var(--card-border)",
              backdropFilter: "blur(2px)",
            }}
          >
            🔥 {item.calories_kcal}
          </span>
        )}
        {isShisha && (
          <span
            className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-[3px] rounded-full"
            style={{ background: "var(--accent-gold)", color: "var(--cta-text)", boxShadow: "0 2px 8px rgba(0,0,0,0.45)" }}
          >
            <SmokeIcon />
            معسّل
          </span>
        )}
      </div>

      {/* content */}
      <div className="flex flex-col items-center text-center gap-1 px-2.5 pt-2.5 pb-3 flex-1">
        <h3 className="text-[14.5px] font-bold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
          {item.name_ar}
        </h3>
        {bilingual && item.name_en && item.name_en !== item.name_ar && (
          <span
            className="block text-[12.5px] font-semibold leading-snug"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "var(--gold-soft)", letterSpacing: "0.3px" }}
          >
            {item.name_en}
          </span>
        )}

        <div className="mt-auto pt-2">
          {isAsk ? (
            <span className="text-[13px] font-semibold" style={{ color: "var(--accent-gold)", fontFamily: "var(--font-display)" }}>
              اسأل
            </span>
          ) : price != null ? (
            <PriceHex price={price} />
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* hexagonal price badge — «السعر / NN / ريال» (matches the client's poster) */
function PriceHex({ price }: { price: number }) {
  const hex = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
  return (
    <div className="relative" style={{ width: 70, height: 78 }}>
      <div className="absolute inset-0" style={{ clipPath: hex, background: "var(--accent-gold)" }} />
      <div
        className="absolute"
        style={{ inset: 2, clipPath: hex, background: "var(--card-bg)" }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[8.5px] tracking-wider" style={{ color: "var(--gold-soft)" }}>السعر</span>
        <span className="text-[24px] font-bold my-[1px]" style={{ color: "var(--accent-gold)", fontFamily: "var(--font-display)" }}>
          {price}
        </span>
        <span className="text-[8.5px] tracking-wider" style={{ color: "var(--gold-soft)" }}>ريال</span>
      </div>
    </div>
  );
}

/* gold corner brackets on each card → ornate frame */
function CornerFrame() {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 13,
    height: 13,
    borderColor: "var(--accent-gold)",
    opacity: 0.7,
    pointerEvents: "none",
    zIndex: 2,
  };
  return (
    <>
      <span style={{ ...base, top: 5, right: 5, borderTop: "1.5px solid", borderRight: "1.5px solid", borderTopRightRadius: 4 }} />
      <span style={{ ...base, top: 5, left: 5, borderTop: "1.5px solid", borderLeft: "1.5px solid", borderTopLeftRadius: 4 }} />
      <span style={{ ...base, bottom: 5, right: 5, borderBottom: "1.5px solid", borderRight: "1.5px solid", borderBottomRightRadius: 4 }} />
      <span style={{ ...base, bottom: 5, left: 5, borderBottom: "1.5px solid", borderLeft: "1.5px solid", borderBottomLeftRadius: 4 }} />
    </>
  );
}

/* ornamental divider used under the brand name in the hero */
function Flourish() {
  return (
    <div className="flex items-center justify-center gap-2 my-2.5">
      <span className="h-px w-12 opacity-50" style={{ background: "var(--accent-gold)" }} />
      <span style={{ color: "var(--accent-gold)", fontSize: 11 }}>۞</span>
      <span className="h-px w-12 opacity-50" style={{ background: "var(--accent-gold)" }} />
    </div>
  );
}

/* fallback brand mark — a gold shisha silhouette (used only when no logo_url) */
function ShishaMark({ small }: { small?: boolean }) {
  const s = small ? 44 : 64;
  return (
    <svg className="mx-auto mb-2" width={s} height={s} viewBox="0 0 100 100" fill="none">
      <path d="M50 14 L50 26" stroke="var(--accent-gold)" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="50" cy="32" rx="13" ry="8" stroke="var(--accent-gold)" strokeWidth="3" />
      <path d="M50 40 L50 64" stroke="var(--accent-gold)" strokeWidth="3" strokeLinecap="round" />
      <path d="M36 84 Q50 70 64 84 Z" stroke="var(--accent-gold)" strokeWidth="3" strokeLinejoin="round" fill="none" />
      <path d="M50 64 L38 84 M50 64 L62 84" stroke="var(--accent-gold)" strokeWidth="3" strokeLinecap="round" />
      <path d="M64 30 Q78 32 76 46" stroke="var(--accent-gold)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* tiny rising-smoke glyph for the «معسّل» (shisha flavor) badge */
function SmokeIcon() {
  return (
    <svg width="9" height="11" viewBox="0 0 24 28" fill="none" aria-hidden>
      <path d="M9 27c-2.5-3.2 2.2-4.5 0-7.6S11.2 15 9 11.8 11.2 7 9 3.8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 27c-2.2-2.8 1.9-4 0-6.7s1.9-4 0-6.7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function formatPhone(p: string): string {
  // 966563200133 → 056 320 0133
  const local = p.replace(/^966/, "0");
  if (local.length === 10) return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  return p;
}
