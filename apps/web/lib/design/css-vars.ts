// Map resolved design tokens to the PWA's existing CSS-variable palette, and
// build a Google-Fonts URL for the profile's heading/body fonts. Pure — DS-3.
// Only emits a var when its source token is a non-empty string, so callers can
// safely merge the result over buildCssVars(...) without blanking base vars.

import type { DesignTokens } from "./types";

export function tokensToCssVars(tokens: DesignTokens): Record<string, string> {
  const c = (tokens?.colors ?? {}) as Record<string, string | undefined>;
  const vars: Record<string, string> = {};
  const set = (k: string, v: string | undefined) => {
    if (typeof v === "string" && v.trim()) vars[k] = v;
  };
  set("--brand", c.primary);
  set("--bg", c.background);
  set("--ink", c.text);
  set("--card-bg", c.surface);
  set("--text-secondary", c.muted);
  set("--accent-gold", c.accent);
  set("--price-color", c.primary);
  set("--header-bg", c.primary);
  set("--cta-bg", c.primary);
  const t = tokens?.typography;
  // Latin display face (e.g. Cormorant Garamond) goes FIRST so Latin glyphs use
  // it while Arabic falls through to the Arabic face (e.g. Tajawal). A Latin-only
  // serif has no Arabic glyphs, so this ordering is required, not cosmetic.
  const latin = t?.latin?.trim();
  const stack = (primary: string) =>
    latin && latin.toLowerCase() !== primary.toLowerCase()
      ? `${latin}, ${primary}, system-ui, sans-serif`
      : `${primary}, system-ui, sans-serif`;
  if (t?.heading?.trim()) vars["--font-display"] = stack(t.heading);
  if (t?.body?.trim()) vars["--font-body"] = stack(t.body);
  return vars;
}

// Fonts that are not Google-hosted (or are CSS keywords) are skipped.
const SKIP_FONTS = new Set(["geist", "system-ui", "sans-serif", "serif", "monospace", "inherit"]);

export function googleFontsUrl(tokens: DesignTokens): string | null {
  const raw = [tokens?.typography?.heading, tokens?.typography?.body, tokens?.typography?.latin];
  const names = Array.from(
    new Set(
      raw
        .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
        .map((n) => n.trim())
        .filter((n) => !SKIP_FONTS.has(n.toLowerCase())),
    ),
  );
  if (names.length === 0) return null;
  const families = names
    .map((n) => `family=${encodeURIComponent(n).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
