// Deterministic data hashing for export freshness (DS-1 foundation).
// computeDataHash() produces a stable sha256 over canonicalized JSON so an
// export row's data_hash changes iff its source inputs change. Used by DS-4/DS-5
// to mark exports outdated. Pure module — Node built-in crypto, no new dep.

import { createHash } from "node:crypto";

// Canonical JSON: object keys sorted recursively, arrays preserved in order,
// undefined dropped. Guarantees the same input object always stringifies the same.
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] === undefined) continue;
    out[key] = canonicalize(obj[key]);
  }
  return out;
}

export function computeDataHash(input: unknown): string {
  const canonical = JSON.stringify(canonicalize(input));
  return createHash("sha256").update(canonical).digest("hex");
}
