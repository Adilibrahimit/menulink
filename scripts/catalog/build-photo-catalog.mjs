// Phase 3 — generate the master catalog from the cleaned library + client photos.
// Outputs: <skill>/data/photo-catalog.json (committed) + <skill>/data/photo-catalog.xlsx (local, gitignored).
// Re-runnable: re-scan + re-query → new photos auto-appear.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import ExcelJS from "file:///D:/menulink/apps/web/node_modules/exceljs/excel.js";
import { sharp, slugify, LIBRARY_ROOT, SKILL_DATA } from "./lib.mjs";

const IMG = /\.(jpe?g|png|jfif|webp)$/i;
const dict = JSON.parse(readFileSync(`${SKILL_DATA}/dish-dictionary.json`, "utf8"));
const clientPhotos = JSON.parse(readFileSync(`${SKILL_DATA}/client-photos.json`, "utf8"));
const dictBy = new Map();
for (const d of dict) { dictBy.set(d.key, d); if (d.name_en) dictBy.set(slugify(d.name_en), d); }
const titleize = (k) => k.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const rows = new Map(); // key -> row
function row(key, category) {
  let r = rows.get(key);
  if (!r) { r = { key, name_ar: "", name_en: titleize(key), category, sources: [] }; rows.set(key, r); }
  return r;
}

// 1) library files
for (const e of readdirSync(LIBRARY_ROOT, { withFileTypes: true })) {
  if (!e.isDirectory() || e.name === "_review") continue;
  for (const f of readdirSync(path.join(LIBRARY_ROOT, e.name))) {
    if (!IMG.test(f)) continue;
    const key = slugify(path.basename(f, path.extname(f)).replace(/-\d+$/, ""));
    if (!key) continue;
    const r = row(key, e.name);
    const hit = dictBy.get(key);
    if (hit) { if (!r.name_ar) r.name_ar = hit.name_ar; if (hit.name_en) r.name_en = hit.name_en; }
    r.sources.push({ type: "library", location: path.join(LIBRARY_ROOT, e.name, f), provenance: "library" });
  }
}
// 2) client photos (storage URLs; downloaded copies are already in the library scan)
for (const c of clientPhotos) {
  const r = row(c.key, c.category);
  if (!r.name_ar && c.name_ar) r.name_ar = c.name_ar;
  if (c.name_en) r.name_en = c.name_en;
  for (const s of c.sources) r.sources.push(s);
}

const catalog = [...rows.values()].sort((a, b) => (a.category + a.name_en).localeCompare(b.category + b.name_en));

// ---- photo-catalog.json (committed) — library paths repo-relative for portability ----
mkdirSync(SKILL_DATA, { recursive: true });
const rel = (loc) => String(loc).replace(/\\/g, "/").replace("D:/menulink/", "");
const catalogJson = catalog.map((r) => ({
  ...r,
  sources: r.sources.map((s) => (s.type === "library" ? { ...s, location: rel(s.location) } : s)),
}));
writeFileSync(`${SKILL_DATA}/photo-catalog.json`, JSON.stringify(catalogJson, null, 1));

// ---- photo-catalog.xlsx (local visual) ----
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Catalog");
ws.columns = [
  { header: "Category", key: "cat", width: 14 },
  { header: "الصنف (عربي)", key: "ar", width: 26 },
  { header: "Dish (English)", key: "en", width: 28 },
  { header: "Photo", key: "img", width: 14 },
  { header: "#", key: "n", width: 4 },
  { header: "Sources", key: "src", width: 30 },
  { header: "Primary location", key: "loc", width: 70 },
];
ws.getRow(1).font = { bold: true };
ws.views = [{ state: "frozen", ySplit: 1 }];

let rNo = 2;
for (const r of catalog) {
  const local = r.sources.find((s) => s.type === "library");
  const prov = [...new Set(r.sources.map((s) => s.provenance))].join(", ");
  ws.addRow({
    cat: r.category, ar: r.name_ar, en: r.name_en, n: r.sources.length,
    src: prov, loc: (local || r.sources[0])?.location || "",
  });
  ws.getRow(rNo).height = 48;
  if (local) {
    try {
      const buf = await sharp(local.location).resize(64, 64, { fit: "cover" }).png().toBuffer();
      const id = wb.addImage({ buffer: buf, extension: "png" });
      ws.addImage(id, { tl: { col: 3.1, row: rNo - 1 + 0.1 }, ext: { width: 60, height: 60 } });
    } catch {}
  }
  rNo++;
}

// summary sheet
const sum = wb.addWorksheet("Summary");
sum.columns = [{ header: "Category", key: "c", width: 16 }, { header: "Dishes", key: "n", width: 10 }, { header: "With local photo", key: "l", width: 18 }];
sum.getRow(1).font = { bold: true };
const byCat = {};
for (const r of catalog) { const k = r.category; byCat[k] ??= { n: 0, l: 0 }; byCat[k].n++; if (r.sources.some((s) => s.type === "library")) byCat[k].l++; }
for (const [c, v] of Object.entries(byCat).sort()) sum.addRow({ c, n: v.n, l: v.l });
sum.addRow({ c: "TOTAL", n: catalog.length, l: catalog.filter((r) => r.sources.some((s) => s.type === "library")).length });

await wb.xlsx.writeFile(`${SKILL_DATA}/photo-catalog.xlsx`);
console.log(`catalog: ${catalog.length} dishes`);
console.log("by category:", JSON.stringify(Object.fromEntries(Object.entries(byCat).map(([c, v]) => [c, v.n])), null, 0));
console.log(`local-photo coverage: ${catalog.filter((r) => r.sources.some((s) => s.type === "library")).length}/${catalog.length}`);
