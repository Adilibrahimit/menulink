import { getDesign } from "./design-library";

// ============================================================================
// Print design tokens — resolves a tenant's menu_design_key into the color
// palette used by the A4/A3 print menu (app/print/[slug]/[size]/page.tsx), so
// the printed menu matches the tenant's customer-facing design:
//   - premium-epicurean -> dark charcoal + gold (VELORA reference)
//   - everything else    -> light cream + brand-color accent (KO-KO reference)
// QR codes always render dark-on-light regardless of palette (readability).
// ============================================================================

export type PrintTokens = {
  isDark: boolean;
  bg: string;        // page background
  ink: string;       // primary text
  accent: string;    // headings / prices / rules
  accentText: string;// text ON the accent (e.g. price chips)
  cardBg: string;    // item card surface
  cardBorder: string;
  secondary: string; // muted text (descriptions, footnotes)
  divider: string;
  surface: string;   // elevated panels (header strip, footer)
  heroScrim: string; // gradient over the hero photo
};

export function resolvePrintTokens(
  menuDesignKey: string | null | undefined,
  primaryColor: string,
): PrintTokens {
  const design = getDesign(menuDesignKey);
  if (design && design.theme.menuLayout === "premium-epicurean") {
    const v = design.theme.cssVars;
    return {
      isDark: true,
      bg: v["--bg"] ?? "#14130f",
      ink: v["--ink"] ?? "#e7e2da",
      accent: v["--accent-gold"] ?? "#e6c383",
      accentText: v["--cta-text"] ?? "#412d00",
      cardBg: v["--card-bg"] ?? "#1d1c17",
      cardBorder: v["--card-border"] ?? "rgba(230,195,131,0.18)",
      secondary: v["--text-secondary"] ?? "#d0c5b5",
      divider: v["--divider"] ?? "rgba(230,195,131,0.22)",
      surface: v["--surface-elevated"] ?? "#21201b",
      heroScrim: "linear-gradient(to top, #14130f 6%, rgba(20,19,15,0.55) 42%, rgba(20,19,15,0.15) 78%)",
    };
  }
  const accent = primaryColor || "#D32027";
  return {
    isDark: false,
    bg: "#FBF8F3",
    ink: "#211b16",
    accent,
    accentText: "#ffffff",
    cardBg: "#ffffff",
    cardBorder: "rgba(0,0,0,0.08)",
    secondary: "#6f6a64",
    divider: "rgba(0,0,0,0.10)",
    surface: "#f4efe7",
    heroScrim: "linear-gradient(to top, rgba(0,0,0,0.72) 4%, rgba(0,0,0,0.30) 45%, rgba(0,0,0,0.05) 80%)",
  };
}
