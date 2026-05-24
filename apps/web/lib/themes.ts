import type { CSSProperties } from "react";

export type ThemeConfig = {
  slug: string;
  cssVars: Record<string, string>;
  fonts: {
    display: string;
    body: string;
    googleUrl: string | null;
  };
  categoryStyle: "pills" | "tabs";
  menuCardStyle: "stitch-navy" | "default";
  headerStyle: "dark-navy" | "brand-filled";
  bottomNavItems: 3 | 5;
  cartBarStyle: "gold-navy" | "brand-default";
  hasItemDetailSheet: boolean;
  checkoutStyle: "stepper" | "drawer";
  loginFlow: "google-first" | "default";
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
};

const RZRZ_THEME: ThemeConfig = {
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
};

const THEMES: Record<string, ThemeConfig> = {
  "rzrz-bukhari": RZRZ_THEME,
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
