// Phase 1c — apply rename-map.json: rename each file to <slug>.<ext> and move it
// into Menu Pics/<category>/ ; junk/review go to Menu Pics/_review/.
// Idempotent + collision-safe. Set DRY=1 to preview without moving.
import { readFileSync, existsSync, mkdirSync, renameSync, readdirSync } from "node:fs";
import path from "node:path";
import { LIBRARY_ROOT, SCRATCH } from "./lib.mjs";

const DRY = process.env.DRY === "1";
const map = JSON.parse(readFileSync(`${SCRATCH}/rename-map.json`, "utf8"));

const taken = new Set();
function uniqueTarget(dir, slug, ext) {
  let name = `${slug}${ext}`;
  let n = 2;
  while (existsSync(path.join(dir, name)) || taken.has(path.join(dir, name).toLowerCase())) {
    name = `${slug}-${n}${ext}`; n++;
  }
  const full = path.join(dir, name);
  taken.add(full.toLowerCase());
  return full;
}

const summary = {};
let moved = 0, skipped = 0, review = 0;
for (const e of map) {
  if (!existsSync(e.path)) { skipped++; continue; } // already moved (idempotent)
  const ext = path.extname(e.path).toLowerCase();
  let destDir, dest;
  if (e.action !== "keep" || !e.slug) {
    destDir = path.join(LIBRARY_ROOT, "_review");
    dest = path.join(destDir, path.basename(e.path));
    review++;
  } else {
    destDir = path.join(LIBRARY_ROOT, e.category || "misc");
    dest = uniqueTarget(destDir, e.slug, ext);
    summary[e.category] = (summary[e.category] || 0) + 1;
    moved++;
  }
  if (path.resolve(e.path) === path.resolve(dest)) { skipped++; continue; }
  if (!DRY) { mkdirSync(destDir, { recursive: true }); renameSync(e.path, dest); }
}

console.log(`${DRY ? "[DRY] " : ""}moved: ${moved} | review: ${review} | skipped(missing/in-place): ${skipped}`);
console.log("by category:", JSON.stringify(summary, null, 0));
if (!DRY) {
  const cats = readdirSync(LIBRARY_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
  const counts = {};
  for (const c of cats) counts[c.name] = readdirSync(path.join(LIBRARY_ROOT, c.name)).length;
  console.log("folders now:", JSON.stringify(counts, null, 0));
}
