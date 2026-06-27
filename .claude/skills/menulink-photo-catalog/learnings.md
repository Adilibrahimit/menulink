# Photo-catalog learnings

Accumulated heuristics for sourcing/matching menu photos. Append after every photo session.

Format: `### LRN-YYYY-MM-DD-<id> (confidence)` · Context · Learning · Source.

---

### LRN-2026-06-27-audit (high)
**Context:** Coffee Secret gap-fill used Pexels top-1 result + name_en fallback, applied without looking.
**Learning:** NEVER apply an auto-fetched photo without a visual audit. It shipped an **alcohol bottle** (ice-carcade ← "tequila"), **live chickens** (chicken-nuggets), product cartons for lattes, and bubble-tea for milk-tea. Always build a contact-sheet montage of candidates and *look* before applying. Default to a neutral correct-category photo over a wrong-but-specific one.
**Source:** session:2026-06-27 | customer:coffee-secret

### LRN-2026-06-27-reuse (high)
**Context:** Coffee Secret needed branded sodas (Pepsi/7up/diet/Code Red/Red Bull) + Holsten malt flavors + a mojito.
**Learning:** Sister Saudi tenants already have correct, real product photos — **reuse them** ("same as almosafer"). Mazaj Almosafer had every branded soda + all Holsten flavors + ONE standard mojito photo reused across all its mojitos; rzrz-bukhari had a real كركديه (hibiscus) drink. Copy the bytes to the new tenant's `menu/<slug>.webp`. This is why the catalog indexes client photos, not just the library.
**Source:** session:2026-06-27 | customer:coffee-secret

### LRN-2026-06-27-mojito (medium)
**Context:** 6 mojito variants, no distinct photos.
**Learning:** For many near-identical variants (mojitos, flavored shisha heads, holsten flavors), one good **standard photo** applied to all is acceptable and looks clean — the owner can swap later. Don't burn time finding 6 distinct mojito shots.
**Source:** session:2026-06-27 | customer:coffee-secret

### LRN-2026-06-27-excel-en (medium)
**Context:** Client "had no English"; turned out the Baladi POS xlsx held English in a side column.
**Learning:** Check the source POS export for an existing English column before translating. Keep the client's own English verbatim (e.g. "Fakhfakhina", "Shuklamo") — only translate what's genuinely missing.
**Source:** session:2026-06-27 | customer:coffee-secret

### LRN-2026-06-28-vision-montage (high)
**Context:** ~185 unlabeled library files (DSC*/Screenshot*) needed identifying.
**Learning:** Contact-sheet montages (sharp tiles + #N index labels) + a `catalog-vision-id` Workflow (one vision agent per sheet, parallel) identify ~30 photos/agent fast. Mark non-food (app/menu screenshots, logos) as junk → `_review/`, never guess. Some branded-can shots get over-flagged as junk; spot-check `_review/` for recoverable product photos.
**Source:** session:2026-06-28 | catalog build

### LRN-2026-06-28-port-gotcha (low)
**Context:** Local `next start` verification served a stale build.
**Learning:** `TaskStop` on a `next start` may report success while the node process keeps holding the port → a fresh server fails with EADDRINUSE and you screenshot the OLD build. Kill the PID by port (`netstat -ano | grep :PORT` → `taskkill //F //PID`) before re-verifying.
**Source:** session:2026-06-28
