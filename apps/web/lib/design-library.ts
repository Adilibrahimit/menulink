import type { CSSProperties } from "react";
import type { ThemeConfig } from "./themes";
import { RZRZ_THEME, MAZAJ_ALMOSAFER_THEME, WADI_LOUNGE_THEME } from "./themes";

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
  {
    key: "wadi-lounge",
    name_ar: "لاونج — داكن ذهبي مزخرف",
    description_ar: "أسود فاخر مع ذهبي عربيسك، بطاقات بإطار مزخرف وشارات سعر سداسية (نمط وادي المسافر).",
    theme: WADI_LOUNGE_THEME,
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
