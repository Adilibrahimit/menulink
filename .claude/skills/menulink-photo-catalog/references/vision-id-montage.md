# Vision-ID via contact-sheet montages

The technique for (a) identifying unlabeled library files and (b) auditing fetched candidates before applying. Photos are cheap to look at in a grid; one-by-one is slow.

## Build a montage

`sharp` tiles into a grid, each cell labelled `#N` in a black bar, plus a JSON index `cell → filepath`:

```js
const TH=200, PAD=30, COLS=5, ROWS=6, PER=COLS*ROWS;
for (let i=0; i<files.length; i+=PER) {
  const comp=[];
  for (let j=0; j<batch.length; j++){
    const thumb = await sharp(batch[j]).resize(TH,TH,{fit:"cover"}).toBuffer();
    const lbl = Buffer.from(`<svg width="${TH}" height="${PAD}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="20" font-family="monospace" font-size="17" fill="#0f0">#${i+j}</text></svg>`);
    comp.push({input:lbl,left:col*TH,top:row*(TH+PAD)}, {input:thumb,left:col*TH,top:row*(TH+PAD)+PAD});
  }
  // composite onto a #222 canvas, write montage-<n>.png
}
```

`scripts/catalog/triage-library.mjs` already does this. SVG labels must escape `<`,`>`,`&`.

## Identify at scale — the `catalog-vision-id` Workflow

One vision agent per montage sheet, in **parallel**, each `Read`s its PNG and returns a label per `#N` tile:

```js
const sheets = Array.from({length: SHEETS}, (_,i)=>i)
const results = await parallel(sheets.map((s)=>()=>
  agent(`Read ${SCRATCH}/montage-${s}.png. Each tile is labelled #N top-left. For every tile return {cell, en, category, action}. action: keep | junk (non-food: app/menu screenshot, logo, blurry) | review.`,
    { phase:'Identify', schema: LABEL_SCHEMA })))
```

~30 photos/agent, ~7 agents → ~185 files in one pass. Merge labels with `montage-index.json` → `rename-map.json`.

## Gotchas

- Pass paths as **hardcoded literals** in the workflow script, not via `args` (args binding was unreliable — a 0-agent run is the tell).
- `sharp` must be required by absolute path (`D:/menulink/apps/web/node_modules/sharp`).
- Some branded-can/bottle shots get over-flagged `junk`; sweep `_review/` afterward for recoverable product photos.
- For an **apply audit**, montage the *final stored* images (fetch each `slug.webp` public URL) and eyeball the whole section before declaring done.
