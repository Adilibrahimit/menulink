// Phase 1b — merge the triage + the vision labels into a single rename-map.json.
// Inputs (scratchpad): library-triage.json, montage-index.json, vision-labels.json
// Output (scratchpad): rename-map.json — [{ path, slug, name_ar, name_en, category, action }]
import { readFileSync, writeFileSync } from "node:fs";
import { slugify, SCRATCH } from "./lib.mjs";

const triage = JSON.parse(readFileSync(`${SCRATCH}/library-triage.json`, "utf8"));
const montageIdx = JSON.parse(readFileSync(`${SCRATCH}/montage-index.json`, "utf8"));
const vision = JSON.parse(readFileSync(`${SCRATCH}/vision-labels.json`, "utf8")); // [{cell,en,category,action}]

const cellToPath = new Map(montageIdx.map((m) => [m.cell, m.path]));
const labelByCell = new Map(vision.map((l) => [l.cell, l]));

const map = [];

// named files: keep as-is (slug + category already resolved by triage)
for (const n of triage.named) {
  map.push({ path: n.path, slug: n.slug, name_ar: n.name_ar || "", name_en: n.name_en || "", category: n.category, action: "keep" });
}
// junk-by-name → quarantine for review
for (const j of triage.junk) {
  map.push({ path: j.path, slug: "", name_ar: "", name_en: "", category: "_review", action: "review" });
}
// unlabeled → use the vision label
for (const m of montageIdx) {
  const l = labelByCell.get(m.cell);
  if (!l) { map.push({ path: m.path, slug: "", name_ar: "", name_en: "", category: "_review", action: "review" }); continue; }
  if (l.action === "keep") {
    map.push({ path: m.path, slug: slugify(l.en), name_ar: "", name_en: l.en, category: l.category, action: "keep" });
  } else {
    map.push({ path: m.path, slug: "", name_ar: "", name_en: l.en || "", category: "_review", action: "review" });
  }
}

writeFileSync(`${SCRATCH}/rename-map.json`, JSON.stringify(map, null, 1));
const keep = map.filter((m) => m.action === "keep").length;
console.log(`rename-map: ${map.length} entries (keep: ${keep}, review/junk: ${map.length - keep})`);
