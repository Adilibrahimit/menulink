"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SLUG_TO_IMG } from "@/lib/koko-images";
import { toArabicDigits } from "@/lib/arabic";
import SarSymbol from "./sar-symbol";
import {
  BagIcon,
  CategoryIcon,
  ChevronLeft,
  FlameIcon,
  LeafIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
} from "./icons";
import { SteamCss, SteamDefs } from "./steam-overlay";
import type { ThemeConfig } from "@/lib/themes";
import type { PublicMenu, PublicMenuItem, PublicVariant, PublicCategory } from "./types";

// "Delivery Modern" customer layout (koko-test). A premium food-delivery-app
// language on a warm-stone light canvas with KO-KO red as a controlled accent:
// crafted SVG icons (no emojis), a swipeable featured rail, an icon category
// rail with scroll-spy, a popular-cards rail, list rows, and a spring-in cart
// pill. Ordering state lives in MenuExperience; this renders functional slots.
// Quick "+" adds single-variant items instantly; multi-variant / has-modifiers
// items open the shared ItemCustomizerSheet via onOpen.

function imgFor(item: PublicMenuItem): string | null {
  return item.image_url ?? SLUG_TO_IMG[item.slug] ?? null;
}
function needsSheet(item: PublicMenuItem): boolean {
  return item.variants.length > 1 || !!item.modifiers?.groups?.length;
}
function minPrice(item: PublicMenuItem): number {
  return item.variants.reduce((m, v) => Math.min(m, Number(v.price)), Infinity);
}
function badgeOf(item: PublicMenuItem): { kind: "hot" | "veg" | "tag"; label: string } | null {
  const b = item.badges?.[0];
  if (!b) return null;
  const t = `${b.type} ${b.label}`.toLowerCase();
  if (t.includes("hot") || t.includes("spic") || t.includes("حار") || t.includes("سبايسي")) return { kind: "hot", label: b.label };
  if (t.includes("veg") || t.includes("نبات")) return { kind: "veg", label: b.label };
  return { kind: "tag", label: b.label };
}
function isHot(item: PublicMenuItem): boolean {
  return badgeOf(item)?.kind === "hot";
}

// Reveal-on-scroll wrapper (IntersectionObserver toggles .is-in; see globals.css)
function Reveal({ children, className = "", delayMs = 0 }: { children: React.ReactNode; className?: string; delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-in");
          io.disconnect(); // reveal once — never replay on scroll-up (best practice)
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={"ml-reveal " + className} style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}>
      {children}
    </div>
  );
}

export default function KokoDeliveryMenu({
  menu,
  onAdd,
  onOpen,
  pushToggle,
  controlsSlot,
  promotionsSlot,
  cartCount = 0,
  cartTotal = 0,
  onOpenCart,
}: {
  menu: PublicMenu;
  theme: ThemeConfig;
  onAdd: (item: PublicMenuItem, variant: PublicVariant) => void;
  onOpen: (item: PublicMenuItem, variant: PublicVariant | null, category: PublicCategory) => void;
  pushToggle?: React.ReactNode;
  controlsSlot?: React.ReactNode;
  promotionsSlot?: React.ReactNode;
  cartCount?: number;
  cartTotal?: number;
  onOpenCart?: () => void;
}) {
  const r = menu.restaurant;
  const categories = menu.categories;
  const [activeId, setActiveId] = useState<string>(categories[0]?.id ?? "");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const searchInput = useRef<HTMLInputElement>(null);
  const featuredRail = useRef<HTMLDivElement>(null);

  // Featured: flagged-with-photo first, else any-with-photo, capped at 6.
  const featured = useMemo<{ item: PublicMenuItem; cat: PublicCategory }[]>(() => {
    const withImg: { item: PublicMenuItem; cat: PublicCategory }[] = [];
    for (const c of categories) for (const it of c.items) if (imgFor(it)) withImg.push({ item: it, cat: c });
    const flagged = withImg.filter((x) => x.item.badges?.length);
    return (flagged.length >= 3 ? flagged : withImg).slice(0, 6);
  }, [categories]);

  const q = query.trim().toLowerCase();
  const searchResults = useMemo<{ item: PublicMenuItem; cat: PublicCategory }[]>(() => {
    if (!q) return [];
    const out: { item: PublicMenuItem; cat: PublicCategory }[] = [];
    for (const c of categories)
      for (const it of c.items)
        if (`${it.name_ar} ${it.description_ar ?? ""}`.toLowerCase().includes(q)) out.push({ item: it, cat: c });
    return out;
  }, [q, categories]);

  const defaultVariant = (item: PublicMenuItem) => item.variants[0];
  const handlePrimary = useCallback(
    (item: PublicMenuItem, cat: PublicCategory) => {
      if (!item.variants.length) return;
      if (needsSheet(item)) onOpen(item, null, cat);
      else onAdd(item, defaultVariant(item));
    },
    [onAdd, onOpen],
  );

  // Scroll-spy → active category pill
  useEffect(() => {
    if (q) return;
    const sections = categories.map((c) => document.getElementById("sec-" + c.id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveId(e.target.id.replace("sec-", ""));
      },
      { rootMargin: "-120px 0px -68% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [categories, q]);

  useEffect(() => {
    pillRefs.current[activeId]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  // Auto-advance the featured rail so the hero feels alive; pauses ~9s whenever
  // the user touches it, and never runs under reduced-motion.
  useEffect(() => {
    const rail = featuredRail.current;
    if (!rail || featured.length <= 1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let idx = 0;
    let paused = false;
    let resumeT: ReturnType<typeof setTimeout>;
    const pause = () => {
      paused = true;
      clearTimeout(resumeT);
      resumeT = setTimeout(() => (paused = false), 9000);
    };
    rail.addEventListener("pointerdown", pause, { passive: true });
    // Only advance while the rail is actually on screen — otherwise advancing an
    // off-screen carousel would scroll the PAGE up to it (the reported bug).
    let inView = true;
    const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0.35 });
    io.observe(rail);
    const t = setInterval(() => {
      if (paused || q || !inView) return;
      idx = (idx + 1) % featured.length;
      const target = rail.children[idx] as HTMLElement | undefined;
      if (!target) return;
      // Scroll the rail HORIZONTALLY only (never the page) — RTL-safe via rects.
      const railRect = rail.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      const delta = tRect.left + tRect.width / 2 - (railRect.left + railRect.width / 2);
      rail.scrollBy({ left: delta, behavior: "smooth" });
    }, 4500);
    return () => {
      clearInterval(t);
      clearTimeout(resumeT);
      io.disconnect();
      rail.removeEventListener("pointerdown", pause);
    };
  }, [featured.length, q]);

  // cart pill count bump on increase
  const pillCount = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(cartCount);
  useEffect(() => {
    if (cartCount > prevCount.current && pillCount.current) {
      const el = pillCount.current;
      el.classList.remove("ml-bump");
      void el.offsetWidth; // reflow to restart
      el.classList.add("ml-bump");
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  const scrollToCat = useCallback((id: string) => {
    const el = document.getElementById("sec-" + id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 112, behavior: "smooth" });
  }, []);

  return (
    <div dir="rtl" className="min-h-[100dvh]" style={{ background: "var(--bg)", color: "var(--ink)", fontFamily: "var(--font-body)" }}>
      <SteamDefs />
      {/* ===== App bar ===== */}
      <header
        className="sticky top-0 z-50"
        style={{ background: "var(--app-glass)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid var(--card-border)" }}
      >
        <div className="h-14 max-w-[1180px] mx-auto px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {r.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" style={{ boxShadow: "var(--shadow-card)" }} />
            ) : (
              <span className="grid place-items-center w-9 h-9 rounded-xl shrink-0 text-white font-extrabold" style={{ background: "var(--brand)" }}>
                {r.name.charAt(0)}
              </span>
            )}
            <div className="min-w-0 leading-tight">
              <div className="font-bold text-[15px] truncate" style={{ fontFamily: "var(--font-display)" }}>
                {r.name}
              </div>
              {r.city && (
                <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  <PinIcon size={11} />
                  <span className="truncate">{r.city}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setSearchOpen((v) => !v);
                if (searchOpen) setQuery("");
              }}
              aria-label="بحث"
              className="grid place-items-center w-10 h-10 rounded-full transition-colors active:scale-95"
              style={{ color: searchOpen ? "var(--brand)" : "var(--ink)", background: searchOpen ? "var(--accent-soft)" : "transparent" }}
            >
              <SearchIcon size={21} />
            </button>
            {pushToggle}
          </div>
        </div>
        {searchOpen && (
          <div className="px-4 pb-3 max-w-[1180px] mx-auto">
            <div className="flex items-center gap-2 h-11 px-3.5 rounded-2xl" style={{ background: "var(--card-bg)", border: "1px solid var(--ring)" }}>
              <SearchIcon size={18} style={{ color: "var(--text-secondary)" }} />
              <input
                ref={searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في القائمة…"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--ink)" }}
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ color: "var(--brand)" }}>
                  مسح
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[1180px] mx-auto pb-32">
        {q ? (
          /* ===== Search results ===== */
          <section className="px-4 pt-4">
            <h2 className="font-bold text-lg mb-3" style={{ fontFamily: "var(--font-display)" }}>
              {searchResults.length ? `${toArabicDigits(String(searchResults.length))} نتيجة` : "لا نتائج"}
            </h2>
            <div className="space-y-3">
              {searchResults.map(({ item, cat }) => (
                <ItemRow key={item.id} item={item} cat={cat} onPrimary={handlePrimary} />
              ))}
            </div>
          </section>
        ) : (
          <>
            {/* ===== Featured rail ===== */}
            {featured.length > 0 && (
              <section className="pt-4">
                <div className="px-4 flex items-end justify-between mb-3">
                  <h2 className="font-bold text-xl flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                    <span className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand)" }} />
                    الأبرز اليوم
                  </h2>
                  <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                    اسحب <ChevronLeft size={13} />
                  </span>
                </div>
                <div ref={featuredRail} className="ml-noscroll flex gap-3.5 overflow-x-auto px-4 pb-1 snap-x snap-mandatory" style={{ scrollPadding: "0 16px" }}>
                  {featured.map(({ item, cat }, i) => (
                    <FeaturedCard key={item.id} item={item} cat={cat} priority={i === 0} onPrimary={handlePrimary} />
                  ))}
                </div>
              </section>
            )}

            {/* ===== Controls (order type) + promotions ===== */}
            {controlsSlot && <div className="px-4 mt-4">{controlsSlot}</div>}
            <div className="px-3.5 mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <SarSymbol size={11} />
              <span>جميع الأسعار شاملة ضريبة القيمة المضافة</span>
            </div>
            {promotionsSlot && <div className="px-4 mt-1">{promotionsSlot}</div>}

            {/* ===== Category rail (sticky, scroll-spy) ===== */}
            <nav
              className="sticky top-14 z-40 mt-3"
              style={{ background: "var(--app-glass)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid var(--card-border)" }}
            >
              <div className="ml-noscroll flex gap-2 overflow-x-auto px-4 py-2.5 max-w-[1180px] mx-auto">
                {categories.map((cat) => {
                  const on = activeId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      ref={(el) => {
                        pillRefs.current[cat.id] = el;
                      }}
                      onClick={() => scrollToCat(cat.id)}
                      className="shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all duration-150 active:scale-95"
                      style={{
                        fontFamily: "var(--font-display)",
                        background: on ? "var(--brand)" : "var(--card-bg)",
                        color: on ? "#fff" : "var(--ink)",
                        border: on ? "1px solid var(--brand)" : "1px solid var(--ring)",
                        boxShadow: on ? "var(--shadow-pill)" : "none",
                      }}
                    >
                      <CategoryIcon nameAr={cat.name_ar} slug={cat.slug} size={17} />
                      {cat.name_ar}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* ===== Sections — first as a cards rail, rest as list rows ===== */}
            <div className="mt-5 space-y-9">
              {categories.map((cat, idx) => (
                <section key={cat.id} id={"sec-" + cat.id} style={{ scrollMarginTop: "112px" }}>
                  <Reveal>
                    <div className="px-4 flex items-baseline justify-between mb-3.5">
                      <h2 className="font-bold text-[22px] flex items-center gap-2.5" style={{ fontFamily: "var(--font-display)" }}>
                        <span style={{ color: "var(--brand)" }}>
                          <CategoryIcon nameAr={cat.name_ar} slug={cat.slug} size={22} />
                        </span>
                        {cat.name_ar}
                      </h2>
                      {cat.info_ar && (
                        <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          {cat.info_ar}
                        </span>
                      )}
                    </div>
                  </Reveal>

                  {idx === 0 && cat.items.length >= 2 ? (
                    <Reveal>
                      <div className="ml-noscroll flex gap-3.5 overflow-x-auto px-4 pb-1 snap-x">
                        {cat.items.map((item) => (
                          <PopularCard key={item.id} item={item} cat={cat} onPrimary={handlePrimary} />
                        ))}
                      </div>
                    </Reveal>
                  ) : (
                    <div className="px-4 space-y-3">
                      {cat.items.map((item, i) => (
                        <Reveal key={item.id} delayMs={(i % 5) * 55}>
                          <ItemRow item={item} cat={cat} onPrimary={handlePrimary} />
                        </Reveal>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>

            <DeliveryFooter />
          </>
        )}
      </main>

      {/* ===== Cart pill (fixed, spring-in) ===== */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
          <button
            onClick={onOpenCart}
            className="ml-pill-in pointer-events-auto w-full max-w-[1180px] mx-auto h-14 rounded-2xl flex items-center justify-between px-3 pr-4 active:scale-[0.99] transition-transform"
            style={{ background: "var(--brand)", color: "#fff", boxShadow: "var(--shadow-pill)" }}
          >
            <span className="flex items-center gap-2.5">
              <span className="relative grid place-items-center w-10 h-10 rounded-xl" style={{ background: "rgba(255,255,255,0.16)" }}>
                <BagIcon size={20} />
                <span
                  ref={pillCount}
                  className="absolute -top-1.5 -left-1.5 min-w-[19px] h-[19px] px-1 grid place-items-center rounded-full text-[11px] font-extrabold"
                  style={{ background: "#fff", color: "var(--brand)", fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}
                >
                  {toArabicDigits(String(cartCount))}
                </span>
              </span>
              <span className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>
                عرض السلة
              </span>
            </span>
            <span className="flex items-center gap-1 font-extrabold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>
              {toArabicDigits(String(cartTotal))} <SarSymbol size={16} />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── sub-components ───────────────────────── */

function PriceTag({ item }: { item: PublicMenuItem }) {
  const multi = item.variants.length > 1;
  const price = multi ? minPrice(item) : Number(item.variants[0]?.price ?? 0);
  return (
    <span className="inline-flex items-center gap-1 font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--price-color)" }}>
      {multi && <span className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>من</span>}
      {toArabicDigits(String(price))}
      <SarSymbol size={13} />
    </span>
  );
}

function AddButton({ onClick, label = "إضافة" }: { onClick: (e: React.MouseEvent) => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid place-items-center w-10 h-10 rounded-xl text-white active:scale-90 transition-transform"
      style={{ background: "var(--brand)", boxShadow: "var(--shadow-pill)" }}
    >
      <PlusIcon size={20} />
    </button>
  );
}

function MiniBadge({ item }: { item: PublicMenuItem }) {
  const b = badgeOf(item);
  if (!b) return null;
  if (b.kind === "hot")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "var(--accent-soft)", color: "var(--brand-strong)" }}>
        <FlameIcon size={11} /> {b.label}
      </span>
    );
  if (b.kind === "veg")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(34,139,84,0.10)", color: "#1f7a47" }}>
        <LeafIcon size={11} /> {b.label}
      </span>
    );
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "var(--accent-soft)", color: "var(--brand-strong)" }}>
      {b.label}
    </span>
  );
}

function CalorieChip({ kcal }: { kcal: number | null }) {
  if (!kcal) return null;
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--calorie-bg)", color: "var(--calorie-text)" }}>
      {toArabicDigits(String(kcal))} سعرة
    </span>
  );
}

function FeaturedCard({
  item,
  cat,
  priority,
  onPrimary,
}: {
  item: PublicMenuItem;
  cat: PublicCategory;
  priority: boolean;
  onPrimary: (item: PublicMenuItem, cat: PublicCategory) => void;
}) {
  const img = imgFor(item);
  return (
    <button
      onClick={() => onPrimary(item, cat)}
      className="snap-start shrink-0 w-[82%] sm:w-[58%] lg:w-[38%] text-right relative rounded-[22px] overflow-hidden active:scale-[0.985] transition-transform"
      style={{ aspectRatio: "16 / 10", background: "var(--card-bg)", boxShadow: "var(--shadow-card)" }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="ml-kenburns absolute inset-0 w-full h-full object-cover" loading={priority ? "eager" : "lazy"} decoding="async" />
      ) : (
        <div className="absolute inset-0" style={{ background: "var(--accent-soft)" }} />
      )}
      {/* rising steam + a periodic light sweep make the hero feel alive */}
      <SteamCss mode="always" smoke tone="soft" count={4} className="opacity-95" />
      <span
        aria-hidden
        className="ml-shimmer absolute inset-y-0 w-1/2 -left-1/4 pointer-events-none"
        style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.40), transparent)" }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,12,9,0.82) 6%, rgba(15,12,9,0.30) 46%, transparent 72%)" }} />
      <div className="absolute top-3 right-3">
        <MiniBadge item={item} />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-white font-bold text-[17px] leading-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
            {item.name_ar}
          </div>
          <div className="mt-1 inline-flex items-center gap-1 text-white font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            <span className="text-[10px] font-semibold opacity-80">{item.variants.length > 1 ? "من" : ""}</span>
            {toArabicDigits(String(minPrice(item)))}
            <SarSymbol size={13} />
          </div>
        </div>
        <span className="grid place-items-center w-10 h-10 rounded-xl text-white shrink-0" style={{ background: "var(--brand)", boxShadow: "var(--shadow-pill)" }}>
          <PlusIcon size={20} />
        </span>
      </div>
    </button>
  );
}

function PopularCard({
  item,
  cat,
  onPrimary,
}: {
  item: PublicMenuItem;
  cat: PublicCategory;
  onPrimary: (item: PublicMenuItem, cat: PublicCategory) => void;
}) {
  const img = imgFor(item);
  return (
    <div
      className="snap-start shrink-0 w-[160px] rounded-[18px] overflow-hidden flex flex-col"
      style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}
    >
      <button onClick={() => onPrimary(item, cat)} className="relative block aspect-[5/4] active:opacity-95">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full" style={{ background: "var(--accent-soft)" }} />
        )}
        {isHot(item) && img && <SteamCss mode="always" tone="soft" count={2} className="opacity-80" />}
        <div className="absolute top-2 right-2">
          <MiniBadge item={item} />
        </div>
      </button>
      <div className="p-2.5 flex flex-col gap-1.5 flex-1">
        <div className="font-bold text-[13px] leading-snug line-clamp-2 min-h-[2.4em]" style={{ fontFamily: "var(--font-display)" }}>
          {item.name_ar}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <PriceTag item={item} />
          <AddButton
            onClick={(e) => {
              e.stopPropagation();
              onPrimary(item, cat);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  cat,
  onPrimary,
}: {
  item: PublicMenuItem;
  cat: PublicCategory;
  onPrimary: (item: PublicMenuItem, cat: PublicCategory) => void;
}) {
  const img = imgFor(item);
  return (
    <div
      onClick={() => onPrimary(item, cat)}
      className="group flex gap-3.5 p-2.5 rounded-[18px] cursor-pointer active:scale-[0.99] transition-transform"
      style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative w-[92px] h-[92px] rounded-2xl overflow-hidden shrink-0" style={{ background: "var(--accent-soft)" }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span className="absolute inset-0 grid place-items-center" style={{ color: "var(--brand)", opacity: 0.5 }}>
            <CategoryIcon nameAr={cat.name_ar} slug={cat.slug} size={30} />
          </span>
        )}
        {isHot(item) && img && <SteamCss mode="always" tone="soft" count={2} className="opacity-80" />}
      </div>
      <div className="flex-1 min-w-0 flex flex-col py-0.5">
        <div className="flex items-start gap-2">
          <h3 className="font-bold text-[15px] leading-snug flex-1" style={{ fontFamily: "var(--font-display)" }}>
            {item.name_ar}
          </h3>
        </div>
        {item.description_ar && (
          <p className="text-[12px] mt-0.5 leading-snug line-clamp-1" style={{ color: "var(--text-secondary)" }}>
            {item.description_ar}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <MiniBadge item={item} />
          <CalorieChip kcal={item.calories_kcal} />
        </div>
        <div className="mt-auto pt-1.5 flex items-center justify-between">
          <PriceTag item={item} />
          <AddButton
            onClick={(e) => {
              e.stopPropagation();
              onPrimary(item, cat);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function DeliveryFooter() {
  return (
    <footer className="px-4 mt-12 space-y-3">
      <div className="rounded-2xl p-5 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <h3 className="text-[13px] font-bold mb-2.5" style={{ fontFamily: "var(--font-display)" }}>
          السعرات اليومية المرجعية
        </h3>
        <div className="flex items-center justify-center gap-5 flex-wrap text-[12px]" style={{ color: "var(--text-secondary)" }}>
          <span><b style={{ color: "var(--ink)" }}>رجل</b> ٢٥٠٠~</span>
          <span><b style={{ color: "var(--ink)" }}>امرأة</b> ٢٠٠٠~</span>
          <span><b style={{ color: "var(--ink)" }}>طفل</b> ١٤٠٠–٢٠٠٠~</span>
        </div>
        <p className="text-[10px] mt-2.5 leading-snug" style={{ color: "var(--text-secondary)", opacity: 0.8 }}>
          القيم تقديرية وتختلف حسب العمر والنشاط البدني. المصدر: الهيئة العامة للغذاء والدواء (SFDA).
        </p>
      </div>
      <div className="rounded-2xl p-5 space-y-1.5" style={{ background: "var(--accent-soft)", border: "1px solid var(--card-border)" }}>
        <h3 className="text-[13px] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--brand-strong)" }}>
          تنبيه حساسية الطعام
        </h3>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--ink)" }}>
          يرجى إعلام الموظف بأي حساسية غذائية لديك <b>قبل الطلب</b>. قد تتواجد مسببات الحساسية في بيئة المطبخ حتى في الأصناف التي لا تحتوي عليها مباشرة.
        </p>
        <p className="text-[10px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          المسببات الـ١٤ الأساسية: جلوتين · حليب · بيض · أسماك · قشريات · فول سوداني · مكسرات · صويا · سمسم · كرفس · خردل · كبريتات · ترمس · رخويات.
        </p>
      </div>
      <p className="text-center text-[10px] pt-1" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
        Powered by MenuLink
      </p>
    </footer>
  );
}
