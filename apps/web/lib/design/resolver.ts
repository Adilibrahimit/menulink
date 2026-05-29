// Design token resolver (DS-1 foundation).
// Composes the override chain into a complete DesignTokens set:
//   system defaults -> template -> restaurant profile -> output-specific.
// EXPORTED BUT IMPORTED BY NO ROUTE in DS-1. DS-3 wires this into /m/[slug];
// wiring it earlier would change live tenant rendering. Pure module.

import { mergeTokens } from "./tokens";
import type { DesignTokens } from "./types";

export type ResolveDesignTokensInput = {
  // Brand/page template default_tokens_json (lowest priority above system).
  templateTokens?: Partial<DesignTokens> | null;
  // Restaurant design profile brand_tokens_json.
  profileTokens?: Partial<DesignTokens> | null;
  // Output-specific custom tokens (print/QR profile overrides). Highest priority.
  outputTokens?: Partial<DesignTokens> | null;
};

export function resolveDesignTokens(input: ResolveDesignTokensInput = {}): DesignTokens {
  return mergeTokens(input.templateTokens, input.profileTokens, input.outputTokens);
}
