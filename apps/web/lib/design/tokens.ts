// Design token defaults + override-merge logic (DS-1 foundation).
// Override priority (later wins): system -> template -> profile -> output.
// Pure module — no Supabase, no React, imported by no route yet.

import type { DesignTokens } from "./types";

// Baseline mirrors the standard-clean-v1 seed (the pack's "general/standard"
// identity). This is a helper constant, not a DB row.
export const SYSTEM_DEFAULT_TOKENS: DesignTokens = {
  colors: {
    background: "#FAF6EE",
    surface: "#FFFFFF",
    primary: "#D32027",
    text: "#18181B",
    muted: "#71717A",
  },
  typography: {
    heading: "Tajawal",
    body: "Cairo",
    latin: "Geist",
  },
  mood: "clean-general",
  radius: {
    card: "18px",
    button: "14px",
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// Deep-merge two token layers; `override` wins on conflict. Undefined override
// values are ignored so a sparse layer never blanks a populated base key.
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Merge token layers in override-priority order (earliest = lowest priority).
// Always seeds from SYSTEM_DEFAULT_TOKENS so the result is a complete DesignTokens.
export function mergeTokens(
  ...layers: Array<Partial<DesignTokens> | null | undefined>
): DesignTokens {
  let acc: Record<string, unknown> = { ...(SYSTEM_DEFAULT_TOKENS as Record<string, unknown>) };
  for (const layer of layers) {
    if (!layer) continue;
    acc = deepMerge(acc, layer as Record<string, unknown>);
  }
  return acc as unknown as DesignTokens;
}
