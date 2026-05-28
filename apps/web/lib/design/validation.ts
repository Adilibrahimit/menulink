// Minimal validators for the Design & Print Studio (DS-1 foundation).
// Boundary checks for tokens, promotions, and QR targets. Pure module.

import type { DesignTokens, QrPurpose, QrTargetType } from "./types";

export type ValidationResult = { ok: boolean; errors: string[] };

const QR_TARGET_TYPES: readonly QrTargetType[] = [
  "menu", "table", "offer", "category", "item",
];

// Required keys for a usable token set (colors + typography backbone).
export function validateTokens(tokens: Partial<DesignTokens> | null | undefined): ValidationResult {
  const errors: string[] = [];
  if (!tokens || typeof tokens !== "object") {
    return { ok: false, errors: ["tokens must be an object"] };
  }
  const colors = tokens.colors;
  if (!colors || typeof colors !== "object") {
    errors.push("tokens.colors is required");
  } else {
    for (const key of ["background", "surface", "primary", "text"] as const) {
      if (typeof colors[key] !== "string" || !colors[key]) {
        errors.push(`tokens.colors.${key} is required`);
      }
    }
  }
  const typography = tokens.typography;
  if (!typography || typeof typography !== "object") {
    errors.push("tokens.typography is required");
  } else {
    for (const key of ["heading", "body"] as const) {
      if (typeof typography[key] !== "string" || !typography[key]) {
        errors.push(`tokens.typography.${key} is required`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export type PromotionPriceInput = {
  old_price?: number | null;
  new_price?: number | null;
  bundle_price?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

// A promotion is valid if any discounted new_price is below its old_price
// (bundles are exempt — bundle_price has its own pricing), and dates are ordered.
export function validatePromotion(input: PromotionPriceInput): ValidationResult {
  const errors: string[] = [];
  const hasBundle = typeof input.bundle_price === "number";

  if (
    !hasBundle &&
    typeof input.new_price === "number" &&
    typeof input.old_price === "number" &&
    input.new_price >= input.old_price
  ) {
    errors.push("new_price must be lower than old_price (unless a bundle_price is set)");
  }

  if (input.starts_at && input.ends_at) {
    const start = Date.parse(input.starts_at);
    const end = Date.parse(input.ends_at);
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
      errors.push("ends_at must not be before starts_at");
    }
  }

  return { ok: errors.length === 0, errors };
}

export function isQrTargetType(value: string): value is QrTargetType {
  return (QR_TARGET_TYPES as readonly string[]).includes(value);
}

// Guards a QR target against the check-constraint enum. Throws on invalid input.
// (purpose and target_type share the same value set.)
export function assertQrTarget(value: string): asserts value is QrPurpose {
  if (!isQrTargetType(value)) {
    throw new Error(
      `invalid QR target/purpose: "${value}" (expected one of ${QR_TARGET_TYPES.join(", ")})`,
    );
  }
}
