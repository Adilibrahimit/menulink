import type { CSSProperties } from "react";

/** A single stat shown in the heritage-list hero info bar.
 *  `value` of "__count__" resolves to the category count, "__items__" to the total item count. */
export type HeroStat = { value: string; label_ar: string };

export type ThemeConfig = {
  slug: string;
  cssVars: Record<string, string>;
  fonts: {
    display: string;
    body: string;
    googleUrl: string | null;
  };
  categoryStyle: "pills" | "tabs";
  menuCardStyle: "stitch-navy" | "default" | "premium-lounge";
  headerStyle: "dark-navy" | "brand-filled" | "velora-hero";
  bottomNavItems: 3 | 5;
  cartBarStyle: "gold-navy" | "brand-default";
  hasItemDetailSheet: boolean;
  checkoutStyle: "stepper" | "drawer";
  loginFlow: "google-first" | "default";
  posterStyle: "default" | "heritage-emerald";
  menuLayout: "card-grid" | "heritage-list" | "premium-epicurean";
  // Optional heritage-list hero overrides. When unset, the component falls back to
  // the original Mazaj literals so existing tenants render identically.
  heroBrandMark?: "dallah" | "coffee-cup";
  heroTaglineEn?: string | null; // explicit null hides the Latin tagline
  heroStats?: HeroStat[];
  // When true, the menu renders bilingual (English name_en under the Arabic name
  // on item cards + section headers). Defaults to false so existing tenants stay Arabic-only.
  bilingual?: boolean;
};

const DEFAULT_THEME: ThemeConfig = {
  slug: "default",
  cssVars: {},
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

export const RZRZ_THEME: ThemeConfig = {
  slug: "rzrz-bukhari",
  cssVars: {
    "--brand": "#00143d",
    "--bg": "#faf9f6",
    "--ink": "#1a1c1a",
    "--accent-gold": "#FDC26D",
    "--header-bg": "#00143d",
    "--header-text": "#ffffff",
    "--price-color": "#B22A2A",
    "--card-bg": "#ffffff",
    "--card-border": "#e3e2e0",
    "--divider": "#e3e2e0",
    "--text-secondary": "#45464e",
    "--calorie-bg": "#fef1d1",
    "--calorie-text": "#8B5E00",
    "--cta-bg": "#FDC26D",
    "--cta-text": "#00143d",
  },
  fonts: {
    display: "Alexandria",
    body: "Alexandria",
    googleUrl: "https://fonts.googleapis.com/css2?family=Alexandria:wght@400;600;700;800&display=swap",
  },
  categoryStyle: "pills",
  menuCardStyle: "stitch-navy",
  headerStyle: "dark-navy",
  bottomNavItems: 5,
  cartBarStyle: "gold-navy",
  hasItemDetailSheet: true,
  checkoutStyle: "stepper",
  loginFlow: "google-first",
  posterStyle: "default",
  menuLayout: "card-grid",
};

export const MAZAJ_ALMOSAFER_THEME: ThemeConfig = {
  slug: "mazaj-almosafer",
  cssVars: {
    "--brand": "#0F2D26",
    "--bg": "#F4E8D4",
    "--ink": "#2A1810",
    "--accent-gold": "#C9A961",
    "--header-bg": "#0F2D26",
    "--header-text": "#F4E8D4",
    "--price-color": "#C9A961",
    "--card-bg": "#FBF5E8",
    "--card-border": "#D8C9A8",
    "--divider": "#D8C9A8",
    "--text-secondary": "#6B5847",
    "--calorie-bg": "#FBF5E8",
    "--calorie-text": "#A0813F",
    "--cta-bg": "#0F2D26",
    "--cta-text": "#C9A961",
    // Heritage-list tokens (these literals were previously hardcoded in the component).
    "--card-fallback-to": "#1A4A3F",
    "--dot-color": "201,169,97",
  },
  fonts: {
    display: "Reem Kufi",
    body: "Tajawal",
    googleUrl:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Dancing+Script:wght@400;500;600;700&family=Reem+Kufi:wght@400;500;600;700&family=Tajawal:wght@300;400;500;700&display=swap",
  },
  categoryStyle: "pills",
  menuCardStyle: "default",
  headerStyle: "dark-navy",
  bottomNavItems: 3,
  cartBarStyle: "brand-default",
  hasItemDetailSheet: false,
  checkoutStyle: "drawer",
  loginFlow: "default",
  posterStyle: "heritage-emerald",
  menuLayout: "heritage-list",
};

export const COFFEE_SECRET_THEME: ThemeConfig = {
  slug: "coffee-secret",
  cssVars: {
    "--brand": "#0C3B3C",
    "--bg": "#F5ECDD",
    "--ink": "#23201A",
    "--accent-gold": "#C9A24B",
    "--header-bg": "#0C3B3C",
    "--header-text": "#F5ECDD",
    "--price-color": "#0C3B3C",
    "--card-bg": "#FBF6EC",
    "--card-border": "#E2D6BE",
    "--divider": "#E2D6BE",
    "--text-secondary": "#5E5848",
    "--calorie-bg": "#FBF6EC",
    "--calorie-text": "#9A7B33",
    "--cta-bg": "#0C3B3C",
    "--cta-text": "#C9A24B",
    // Heritage-list tokens (teal-tuned).
    "--card-fallback-to": "#0A2F30",
    "--dot-color": "201,162,75",
  },
  fonts: {
    // Same stack as Mazaj minus Dancing Script (unused by the heritage layout) — no extra families loaded.
    display: "Reem Kufi",
    body: "Tajawal",
    googleUrl:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Reem+Kufi:wght@400;500;600;700&family=Tajawal:wght@300;400;500;700&display=swap",
  },
  categoryStyle: "pills",
  menuCardStyle: "default",
  headerStyle: "dark-navy",
  bottomNavItems: 3,
  cartBarStyle: "brand-default",
  hasItemDetailSheet: false,
  checkoutStyle: "drawer",
  loginFlow: "default",
  posterStyle: "default",
  menuLayout: "heritage-list",
  heroBrandMark: "coffee-cup",
  heroTaglineEn: "Where every cup tells a secret",
  heroStats: [
    { value: "+18", label_ar: "شيشة" },
    { value: "__count__", label_ar: "قسم" },
    { value: "__items__", label_ar: "صنف" },
  ],
  bilingual: true,
};

// Mazaj Almosafer — Al-Rawdah branch (2nd branch, separate page). Identical design to
// branch 1 (MAZAJ_ALMOSAFER_THEME), but bilingual: English shown under Arabic on items +
// section headers, and the English brand name surfaced via the hero tagline slot.
export const MAZAJ_ALMOSAFER_RAWDAH_THEME: ThemeConfig = {
  ...MAZAJ_ALMOSAFER_THEME,
  slug: "mazaj-almosafer-rawdah",
  heroTaglineEn: "Mazaj Almosafer · Al-Rawdah",
  bilingual: true,
};

const THEMES: Record<string, ThemeConfig> = {
  "rzrz-bukhari": RZRZ_THEME,
  "mazaj-almosafer": MAZAJ_ALMOSAFER_THEME,
  "mazaj-almosafer-rawdah": MAZAJ_ALMOSAFER_RAWDAH_THEME,
  "coffee-secret": COFFEE_SECRET_THEME,
};

export function getTheme(slug: string): ThemeConfig {
  return THEMES[slug] ?? DEFAULT_THEME;
}

export function isDefault(theme: ThemeConfig): boolean {
  return theme.slug === "default";
}

export function buildCssVars(
  slug: string,
  db: { primary_color: string; background_color: string },
): CSSProperties {
  const theme = getTheme(slug);
  const base = isDefault(theme)
    ? {
        "--brand": db.primary_color || "#ac0015",
        "--bg": db.background_color || "#fff8f6",
        "--ink": "#29170f",
        "--accent-gold": "#fdc415",
        "--header-bg": db.primary_color || "#ac0015",
        "--header-text": "#ffffff",
        "--price-color": db.primary_color || "#ac0015",
        "--card-bg": "#ffffff",
        "--card-border": "rgba(0,0,0,0.05)",
        "--divider": "#e5e7eb",
        "--text-secondary": "#71717a",
        "--calorie-bg": "#fffbeb",
        "--calorie-text": "#92400e",
        "--cta-bg": db.primary_color || "#ac0015",
        "--cta-text": "#ffffff",
      }
    : theme.cssVars;

  return {
    ...base,
    "--font-display": `${theme.fonts.display}, system-ui, sans-serif`,
    "--font-body": `${theme.fonts.body}, system-ui, sans-serif`,
  } as CSSProperties;
}
