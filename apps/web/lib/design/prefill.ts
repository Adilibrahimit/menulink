// Build a draft profile's initial brand tokens: template defaults first, then
// the restaurant's current live colors layered on top, so the operator starts
// from what the live menu shows. Pure — reuses mergeTokens. (DS-2)

import { mergeTokens } from "./tokens";
import type { DesignTokens } from "./types";

export type RestaurantBrandFields = {
  primary_color?: string | null;
  background_color?: string | null;
};

export function prefillBrandTokens(
  templateTokens: Partial<DesignTokens> | null | undefined,
  restaurant: RestaurantBrandFields,
): DesignTokens {
  const colors: Record<string, string> = {};
  if (restaurant.primary_color) colors.primary = restaurant.primary_color;
  if (restaurant.background_color) colors.background = restaurant.background_color;
  const liveOverrides: Partial<DesignTokens> =
    Object.keys(colors).length > 0 ? ({ colors } as Partial<DesignTokens>) : {};
  return mergeTokens(templateTokens ?? undefined, liveOverrides);
}
