import { getDesign } from "./design-library";

// ============================================================================
// Print design tokens — resolves a tenant's menu_design_key into the color
// palette used by the A4/A3 print menu (app/print/[slug]/[size]/page.tsx), so
// the printed menu matches the tenant's customer-facing design:
//   - dark ordering designs (premium-epicurean, rzrz-signature) -> dark charcoal
//     + gold/brass, with the hero scrim derived from the design's own --bg
//   - everything else -> light cream + brand-color accent (KO-KO reference)
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

// Dark customer-menu designs whose printed output should also be dark. A new
// dark menuLayout MUST be added here or its print/poster falls back to light.
const DARK_PRINT_LAYOUTS = new Set(["premium-epicurean", "rzrz-signature"]);

// "#18110D" -> "24, 17, 13" so rgba() scrim stops can be built from a theme --bg.
function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(n)) return "20, 19, 15"; // safe dark fallback
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function resolvePrintTokens(
  menuDesignKey: string | null | undefined,
  primaryColor: string,
): PrintTokens {
  const design = getDesign(menuDesignKey);
  if (design && DARK_PRINT_LAYOUTS.has(design.theme.menuLayout)) {
    const v = design.theme.cssVars;
    const bg = v["--bg"] ?? "#14130f";
    const rgb = hexToRgbTriplet(bg);
    return {
      isDark: true,
      bg,
      ink: v["--ink"] ?? "#e7e2da",
      accent: v["--accent-gold"] ?? "#e6c383",
      accentText: v["--cta-text"] ?? "#412d00",
      cardBg: v["--card-bg"] ?? "#1d1c17",
      cardBorder: v["--card-border"] ?? "rgba(230,195,131,0.18)",
      secondary: v["--text-secondary"] ?? "#d0c5b5",
      divider: v["--divider"] ?? "rgba(230,195,131,0.22)",
      surface: v["--surface-elevated"] ?? "#21201b",
      // Scrim derived from the design's own canvas so the hero fade meets the
      // page seamlessly (premium #14130f and rzrz #18110D differ).
      heroScrim: `linear-gradient(to top, ${bg} 6%, rgba(${rgb}, 0.55) 42%, rgba(${rgb}, 0.15) 78%)`,
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
