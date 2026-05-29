import type { ThemeConfig } from "../themes";

// Override only valid, known layout flags from a template's default_config_json over the base
// ThemeConfig. Unknown keys / invalid values are ignored, so a bad config can never break render.
export function resolveThemeLayout(base: ThemeConfig, config: unknown): ThemeConfig {
  if (!config || typeof config !== "object") return base;
  const c = config as Record<string, unknown>;
  const out: ThemeConfig = { ...base };
  if (c.menuLayout === "card-grid" || c.menuLayout === "heritage-list") out.menuLayout = c.menuLayout;
  if (c.categoryStyle === "pills" || c.categoryStyle === "tabs") out.categoryStyle = c.categoryStyle;
  if (c.menuCardStyle === "stitch-navy" || c.menuCardStyle === "default" || c.menuCardStyle === "premium-lounge") out.menuCardStyle = c.menuCardStyle;
  if (c.headerStyle === "dark-navy" || c.headerStyle === "brand-filled" || c.headerStyle === "velora-hero") out.headerStyle = c.headerStyle;
  if (c.cartBarStyle === "gold-navy" || c.cartBarStyle === "brand-default") out.cartBarStyle = c.cartBarStyle;
  if (typeof c.hasItemDetailSheet === "boolean") out.hasItemDetailSheet = c.hasItemDetailSheet;
  if (c.bottomNavItems === 3 || c.bottomNavItems === 5) out.bottomNavItems = c.bottomNavItems;
  return out;
}
