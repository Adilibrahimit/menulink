import type { CSSProperties } from "react";
import type { ThemeConfig } from "./themes";
import { RZRZ_THEME, MAZAJ_ALMOSAFER_THEME } from "./themes";

// ============================================================================
// MenuLink · Design Library
//
// A small set of ready, genuinely-distinct full-page menu designs that ops can
// assign to ANY restaurant via restaurants.menu_design_key (migration 0069),
// decoupling the *design* from the *slug*. NULL key = today's per-slug behavior
// (getTheme(slug)), so existing tenants render unchanged.
//
// Each entry carries a complete ThemeConfig (color tokens + fonts + layout
// flags). app/m/[slug]/page.tsx resolves the key here and applies the entry's
// theme + CSS vars + Google-fonts URL. Adding a future client design = build
// its layout/tokens, then register one entry below.
// ============================================================================

export type DesignLibraryEntry = {
  key: string;
  name_ar: string;
  description_ar: string;
  theme: ThemeConfig;
};

// "Premium Epicurean" — a 5-star dark/gold photo-forward design (no client yet;
// added so it can be assigned later). Tokens mirror docs/design-print-studio/
// New folder/DESIGN.md: charcoal #14130f canvas, amber-gold #e6c383 accents,
// parchment #e7e2da text, Tajawal headings + Cairo body. Rendered by the
// dedicated premium-epicurean-menu.tsx browse layout (menuLayout flag below).
const PREMIUM_EPICUREAN_THEME: ThemeConfig = {
  slug: "premium-epicurean",
  cssVars: {
    "--brand": "#e6c383",
    "--bg": "#14130f",
    "--ink": "#e7e2da",
    "--accent-gold": "#e6c383",
    "--header-bg": "#14130f",
    "--header-text": "#e7e2da",
    "--price-color": "#e6c383",
    "--card-bg": "#1d1c17",
    "--card-border": "rgba(230,195,131,0.12)",
    "--divider": "rgba(230,195,131,0.18)",
    "--text-secondary": "#d0c5b5",
    "--calorie-bg": "rgba(230,195,131,0.08)",
    "--calorie-text": "#e6c383",
    "--cta-bg": "#e6c383",
    "--cta-text": "#412d00",
    // premium-only extras (consumed by premium-epicurean-menu.tsx + premium BottomNav)
    "--surface-elevated": "#21201b",
    "--surface-deep": "#0f0e0a",
    "--on-primary": "#412d00",
  },
  fonts: {
    display: "Tajawal",
    body: "Cairo",
    googleUrl:
      "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Tajawal:wght@500;700&display=swap",
  },
  categoryStyle: "pills",
  menuCardStyle: "premium-lounge",
  headerStyle: "dark-navy",
  bottomNavItems: 3,
  cartBarStyle: "gold-navy",
  hasItemDetailSheet: false,
  checkoutStyle: "drawer",
  loginFlow: "default",
  posterStyle: "default",
  menuLayout: "premium-epicurean",
};

// "RzRz Signature" — warm "Ember & Charcoal" heritage design for a Bukhari
// (rice + grilled chicken) restaurant. Espresso/charcoal canvas (#18110D, every
// surface step carries a red-brown undertone) with a single BRASS #C9A24B for
// chrome (section headers, hairlines, chips, variant outlines) and a restricted
// EMBER #D17A2E reserved for the price, the CTA fill, and the wordmark. Amiri
// (display) + Tajawal (body). Rendered by rzrz-signature-menu.tsx — hot dishes
// carry featherweight CSS steam on hover and the hero hosts the one Remotion
// signature-dish spotlight. Visibly distinct from premium-epicurean.
const RZRZ_SIGNATURE_THEME: ThemeConfig = {
  slug: "rzrz-signature",
  cssVars: {
    "--brand": "#D17A2E",
    "--bg": "#18110D",
    "--ink": "#F4E9D8",
    "--accent-gold": "#C9A24B",
    "--header-bg": "#18110D",
    "--header-text": "#F4E9D8",
    "--price-color": "#D17A2E",
    "--card-bg": "#2A1E16",
    "--card-border": "rgba(154,135,111,0.14)",
    "--divider": "rgba(154,135,111,0.16)",
    "--text-secondary": "#C9B8A3",
    "--calorie-bg": "rgba(201,162,75,0.08)",
    "--calorie-text": "#C9A24B",
    "--cta-bg": "#D17A2E",
    "--cta-text": "#18110D",
    "--surface-elevated": "#34271D",
    "--surface-deep": "#211711",
    "--on-primary": "#18110D",
    // signature-only extras (ember accents + steam tint consumed by the layout/CSS)
    "--ember": "#D17A2E",
    "--ember-hover": "#E0883B",
    "--ember-glow": "rgba(214,138,74,0.30)",
    "--header-glass": "rgba(24,18,13,0.82)",
    "--steam-tint": "rgba(255,248,236,0.92)",
  },
  fonts: {
    display: "Amiri",
    body: "Tajawal",
    googleUrl:
      "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@300;400;500;700&display=swap",
  },
  categoryStyle: "pills",
  menuCardStyle: "signature",
  headerStyle: "dark-navy",
  bottomNavItems: 3,
  cartBarStyle: "gold-navy",
  hasItemDetailSheet: false,
  checkoutStyle: "drawer",
  loginFlow: "default",
  posterStyle: "default",
  menuLayout: "rzrz-signature",
};

// "Delivery Modern" — a clean, premium food-delivery-app language (Cava / Uber
// Eats lineage) on a WARM-STONE light canvas with KO-KO red as a controlled
// accent. Distinctive type: Changa (display) + Readex Pro (body/UI), not the
// generic system stack. Rendered by koko-delivery-menu.tsx with a crafted inline
// SVG icon set (zero emojis), a swipeable featured rail, an icon category rail,
// popular-cards + list-rows rhythm, and a spring-in cart pill. Light flow → uses
// the standard CartDrawer + ItemCustomizerSheet (no dark checkout).
const DELIVERY_MODERN_THEME: ThemeConfig = {
  slug: "delivery-modern",
  cssVars: {
    "--brand": "#D32027",
    "--bg": "#F6F4EF",
    "--ink": "#181410",
    "--accent-gold": "#D32027",
    "--header-bg": "#FFFFFF",
    "--header-text": "#181410",
    "--price-color": "#181410",
    "--card-bg": "#FFFFFF",
    "--card-border": "rgba(24,20,16,0.07)",
    "--divider": "rgba(24,20,16,0.07)",
    "--text-secondary": "#78716A",
    "--calorie-bg": "rgba(211,32,39,0.06)",
    "--calorie-text": "#B0161C",
    "--cta-bg": "#D32027",
    "--cta-text": "#FFFFFF",
    "--surface-elevated": "#FFFFFF",
    // delivery-modern extras (consumed by koko-delivery-menu.tsx + globals.css)
    "--brand-strong": "#B0161C",
    "--accent-soft": "rgba(211,32,39,0.08)",
    "--app-glass": "rgba(246,244,239,0.80)",
    "--ring": "rgba(24,20,16,0.10)",
    "--shadow-card": "0 1px 2px rgba(24,20,16,0.05), 0 8px 22px rgba(24,20,16,0.06)",
    "--shadow-pill": "0 10px 30px rgba(211,32,39,0.34)",
    "--shadow-float": "0 14px 40px rgba(24,20,16,0.16)",
  },
  fonts: {
    display: "Changa",
    body: "Readex Pro",
    googleUrl:
      "https://fonts.googleapis.com/css2?family=Changa:wght@500;600;700;800&family=Readex+Pro:wght@300;400;500;600;700&display=swap",
  },
  categoryStyle: "pills",
  menuCardStyle: "default",
  headerStyle: "brand-filled",
  bottomNavItems: 5,
  cartBarStyle: "brand-default",
  hasItemDetailSheet: true,
  checkoutStyle: "drawer",
  loginFlow: "default",
  posterStyle: "default",
  menuLayout: "delivery-modern",
};

// "KO-KO Fast-food" — the default card-grid layout baked with KO-KO's bold red
// brand on cream. Mirrors what buildCssVars() produces for the default theme
// using KO-KO's DB colors (primary #D32027, background #FAF6EE), so the look is
// portable to any client picking it.
const KOKO_FASTFOOD_THEME: ThemeConfig = {
  slug: "koko-fastfood",
  cssVars: {
    "--brand": "#D32027",
    "--bg": "#FAF6EE",
    "--ink": "#29170f",
    "--accent-gold": "#fdc415",
    "--header-bg": "#D32027",
    "--header-text": "#ffffff",
    "--price-color": "#D32027",
    "--card-bg": "#ffffff",
    "--card-border": "rgba(0,0,0,0.05)",
    "--divider": "#e5e7eb",
    "--text-secondary": "#71717a",
    "--calorie-bg": "#fffbeb",
    "--calorie-text": "#92400e",
    "--cta-bg": "#D32027",
    "--cta-text": "#ffffff",
  },
  fonts: {
    display: "Tajawal",
    body: "Cairo",
    googleUrl: null,
  },
  categoryStyle: "tabs",
  menuCardStyle: "default",
  headerStyle: "brand-filled",
  bottomNavItems: 3,
  cartBarStyle: "brand-default",
  hasItemDetailSheet: false,
  checkoutStyle: "drawer",
  loginFlow: "default",
  posterStyle: "default",
  menuLayout: "card-grid",
};

// The library, in picker display order. premium-epicurean leads (the new
// flagship); the other three are the existing built designs, lifted so the
// picker can assign them to any client.
export const DESIGN_LIBRARY: DesignLibraryEntry[] = [
  {
    key: "premium-epicurean",
    name_ar: "بريميوم — تجربة فاخرة",
    description_ar: "تصميم داكن ذهبي خمس نجوم، صور كبيرة لكل طبق (Epicurean).",
    theme: PREMIUM_EPICUREAN_THEME,
  },
  {
    key: "rzrz-signature",
    name_ar: "توقيع رزرز — جمر وفحم",
    description_ar:
      "تراثي داكن دافئ (جمر/برونز) مع بخار حيّ على الأطباق الساخنة وفيديو توقيع للطبق المميز.",
    theme: RZRZ_SIGNATURE_THEME,
  },
  {
    key: "delivery-modern",
    name_ar: "تطبيق توصيل حديث",
    description_ar:
      "نمط تطبيقات التوصيل (Cava/Uber Eats): قاعدة فاتحة دافئة، أيقونات SVG، شريط أطباق مميزة، صفوف قائمة، وحركات راقية.",
    theme: DELIVERY_MODERN_THEME,
  },
  {
    key: "koko-fastfood",
    name_ar: "وجبات سريعة — جريء",
    description_ar: "شبكة بطاقات بألوان جريئة (نمط كوكو).",
    theme: KOKO_FASTFOOD_THEME,
  },
  {
    key: "rzrz-navy",
    name_ar: "كحلي — Stitch",
    description_ar: "كحلي أنيق مع ذهبي، بطاقات Stitch (نمط رزرز).",
    theme: { ...RZRZ_THEME, slug: "rzrz-navy" },
  },
  {
    key: "almosafer-heritage",
    name_ar: "تراثي — قائمة",
    description_ar: "أخضر تراثي بقائمة عمودية أنيقة (نمط مزاج المسافر).",
    theme: { ...MAZAJ_ALMOSAFER_THEME, slug: "almosafer-heritage" },
  },
];

const BY_KEY: Record<string, DesignLibraryEntry> = Object.fromEntries(
  DESIGN_LIBRARY.map((d) => [d.key, d]),
);

export function getDesign(key: string | null | undefined): DesignLibraryEntry | null {
  if (!key) return null;
  return BY_KEY[key] ?? null;
}

// Produce the CSS-var style object for a library theme — the entry's color
// tokens plus the two font vars, mirroring buildCssVars() in themes.ts so the
// page wrapper themes identically whether the design comes from a slug or a key.
export function cssVarsForTheme(theme: ThemeConfig): CSSProperties {
  return {
    ...theme.cssVars,
    "--font-display": `${theme.fonts.display}, system-ui, sans-serif`,
    "--font-body": `${theme.fonts.body}, system-ui, sans-serif`,
  } as CSSProperties;
}
