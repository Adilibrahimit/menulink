// Phase 1a — classify the local library and build contact-sheet montages for the
// unlabeled files so they can be vision-identified.
// Outputs (to scratchpad): library-triage.json, montage-*.png, montage-index.json.
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { sharp, slugify, canonicalCategory, LIBRARY_ROOT, SKILL_DATA, SCRATCH } from "./lib.mjs";

const IMG = /\.(jpe?g|png|jfif|webp)$/i;
const dict = JSON.parse(readFileSync(`${SKILL_DATA}/dish-dictionary.json`, "utf8"));
const dictBySlug = new Map();
const dictByEn = new Map();
const dictByAr = new Map();
for (const d of dict) {
  dictBySlug.set(d.key, d);
  for (const s of d.slugs) if (!dictBySlug.has(s)) dictBySlug.set(s, d);
  if (d.name_en) dictByEn.set(slugify(d.name_en), d);
  for (const a of d.names_ar) dictByAr.set(a.replace(/\s+/g, " ").trim(), d);
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === "_review" || e.name.startsWith("__")) continue; walk(p, acc); }
    else if (IMG.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk(LIBRARY_ROOT);

const UNLABELED = /^(DSC|Screenshot|download|images|IMG|PXL|photo_|received_|FB_IMG|WhatsApp)/i;
const HASHY = /^[0-9a-f]{8}-[0-9a-f]{4}-|^[0-9a-f]{16,}$|^[A-Za-z0-9_-]{22,}$|^\d{3,}[A-Za-z]/;
const JUNK_NAME = /logo|qr[-_ ]|poster|page-0|screen.?menu|مضغوط|favicon|banner/i;

function classify(base) {
  if (JUNK_NAME.test(base)) return "junk";
  if (UNLABELED.test(base) || HASHY.test(base)) return "unlabeled";
  // sentence/hashtag spam filenames → treat as unlabeled (vision will confirm)
  if (base.includes("#") || base.split(/\s+/).length > 5) return "unlabeled";
  return "named";
}

function matchDict(base) {
  const sl = slugify(base);
  return dictBySlug.get(sl) || dictByEn.get(sl) || dictByAr.get(base.replace(/\s+/g, " ").trim()) || null;
}

const named = [], unlabeled = [], junk = [];
for (const p of files) {
  const ext = path.extname(p);
  const base = path.basename(p, ext);
  const cls = classify(base);
  if (cls === "junk") { junk.push({ path: p }); continue; }
  if (cls === "unlabeled") { unlabeled.push({ path: p }); continue; }
  const hit = matchDict(base);
  const slug = hit ? hit.key : slugify(base);
  const category = hit ? hit.category : canonicalCategory(base);
  named.push({
    path: p, slug,
    name_ar: hit?.name_ar || "", name_en: hit?.name_en || base.replace(/\s+/g, " ").trim(),
    category, matched: !!hit,
  });
}

writeFileSync(`${SCRATCH}/library-triage.json`, JSON.stringify({ named, unlabeled, junk }, null, 1));
console.log(`files: ${files.length} | named: ${named.length} (matched dict: ${named.filter(n => n.matched).length}) | unlabeled: ${unlabeled.length} | junk-by-name: ${junk.length}`);

// Build montages of the unlabeled files for the vision pass.
const TH = 200, PAD = 30, COLS = 5, ROWS = 6, PER = COLS * ROWS;
const cellW = TH, cellH = TH + PAD;
const index = [];
let sheet = 0;
for (let i = 0; i < unlabeled.length; i += PER) {
  const batch = unlabeled.slice(i, i + PER);
  const comp = [];
  for (let j = 0; j < batch.length; j++) {
    const col = j % COLS, row = Math.floor(j / COLS), cell = i + j;
    let thumb;
    try { thumb = await sharp(batch[j].path).resize(TH, TH, { fit: "cover" }).toBuffer(); }
    catch { thumb = await sharp({ create: { width: TH, height: TH, channels: 3, background: "#883333" } }).png().toBuffer(); }
    const lbl = Buffer.from(`<svg width="${cellW}" height="${PAD}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="20" font-family="monospace" font-size="17" fill="#0f0">#${cell}</text></svg>`);
    comp.push({ input: lbl, left: col * cellW, top: row * cellH });
    comp.push({ input: thumb, left: col * cellW, top: row * cellH + PAD });
    index.push({ cell, path: batch[j].path });
  }
  const out = await sharp({ create: { width: COLS * cellW, height: ROWS * cellH, channels: 3, background: "#222" } }).composite(comp).png().toBuffer();
  writeFileSync(`${SCRATCH}/montage-${sheet}.png`, out);
  sheet++;
}
writeFileSync(`${SCRATCH}/montage-index.json`, JSON.stringify(index, null, 0));
console.log(`montages: ${sheet} sheets covering ${unlabeled.length} unlabeled files (montage-index.json)`);
