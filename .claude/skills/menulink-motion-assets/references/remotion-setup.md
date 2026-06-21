# Remotion Setup & Render Worker

Practical guide to building the DS-8 render layer. Remotion renders React components to
video frame-by-frame (server-side, headless Chromium). Keep it **out of `apps/web`** —
it's a build-time/worker concern, never a PWA runtime dependency.

> Verify exact API names against the installed Remotion version (`remotion --version`) and
> the docs — Remotion's API is stable but evolves. The shapes below match Remotion 4.x.

## Package layout (matches the DS-8 spec)

```
packages/remotion-renderer/
├── package.json            # remotion, @remotion/bundler, @remotion/renderer, react, react-dom
├── remotion.config.ts      # setVideoImageFormat('jpeg'), concurrency, etc.
├── src/
│   ├── index.ts            # registerRoot(RemotionRoot)
│   ├── Root.tsx            # the 3 <Composition>s — ids MUST match composition_id
│   ├── compositions/
│   │   ├── PromoReel.tsx
│   │   ├── ItemSpotlight.tsx
│   │   └── OfferStory.tsx
│   ├── components/         # shared: PriceTag, BrandBar, KenBurnsImage, ArabicText
│   └── theme.ts            # maps tenant brand tokens → composition styling
└── render.ts               # the async worker: props → render → upload → DB
```

## Root.tsx — composition registration

fps = 30. `durationInFrames = fps * duration_seconds` from the seeded templates.

```tsx
import { Composition } from 'remotion';
import { PromoReel } from './compositions/PromoReel';
import { ItemSpotlight } from './compositions/ItemSpotlight';
import { OfferStory } from './compositions/OfferStory';

const FPS = 30;
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PromoReel"     component={PromoReel}     fps={FPS}
      durationInFrames={FPS * 15} width={1080} height={1920} defaultProps={promoDefaults} />
    <Composition id="ItemSpotlight" component={ItemSpotlight} fps={FPS}
      durationInFrames={FPS * 8}  width={1080} height={1080} defaultProps={spotlightDefaults} />
    <Composition id="OfferStory"    component={OfferStory}    fps={FPS}
      durationInFrames={FPS * 10} width={1080} height={1920} defaultProps={offerDefaults} />
  </>
);
```

Dimensions by `format`: `reel_9_16` & `story_9_16` → 1080×1920, `square_1_1` → 1080×1080,
`landscape_16_9` → 1920×1080.

## Composition props = layered merge

Resolve props in this order (later wins), then pass as `inputProps`:

1. `motion_templates.default_props_json` — base content/layout for the composition.
2. `restaurant_motion_profiles.props_json` — tenant's chosen content (which item/offer, copy).
3. **Brand tokens** from the tenant's published `restaurant_design_profiles`
   (primary/accent/ink/canvas colors, Arabic + Latin font families). This is what makes a
   reel look like *that* restaurant. Use `apps/web/lib/design/` resolvers; do not hardcode.

Real menu data (item name_ar/name_en, price, photo URL, calories) and promotions come from
the same tables the PWA/print uses — fetch, don't fabricate. Prices are VAT-inclusive and
shown in Arabic-Indic numerals to match the customer surfaces.

## render.ts — the async worker

```ts
import path from 'path';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';

export async function renderMotionExport(opts: {
  compositionId: 'PromoReel' | 'ItemSpotlight' | 'OfferStory';
  inputProps: Record<string, unknown>;
  outFile: string;
}) {
  const serveUrl = await bundle({ entryPoint: path.resolve(__dirname, 'src/index.ts') });
  const composition = await selectComposition({ serveUrl, id: opts.compositionId, inputProps: opts.inputProps });
  await renderMedia({
    composition, serveUrl, codec: 'h264',
    outputLocation: opts.outFile, inputProps: opts.inputProps,
  });
  return opts.outFile; // then upload to Storage + patch motion_exports
}
```

### Job orchestration (mirror DS-7 export flow)

1. Insert/find a `motion_exports` row, `status='queued'`, with a computed `data_hash`.
2. Flip to `status='rendering'`; record start time.
3. `renderMotionExport(...)` → local MP4.
4. Upload to Supabase Storage (service role); get public/signed URL.
5. Patch the row: `file_url`, `rendered_at=now()`, `duration_ms`, `status='rendered'`.
6. On any throw: `status='failed'`, set `error_message`; allow retry.
7. When source data/props change so `data_hash` differs, mark prior exports `outdated`.

Writes use the **service role** (RLS gives owners read-only) or an ops server action.

## Manual / CLI render (for testing one composition)

```bash
npx remotion render src/index.ts PromoReel out/promo.mp4 --props=./props.json
npx remotion studio        # live preview while building compositions
```

## Licensing — a real go-live gate (DS-8 guardrail line 100)

Remotion is **source-available, not MIT**. As a general shape: free for individuals and
small companies, but organizations above a small headcount need a **paid company license**,
and automated/cloud rendering sold as a service has its own terms. MenuLink would be selling
automated video generation to restaurants — so this is a commercial use that very likely
needs a license.

**Before shipping this as a paid feature:** read the current terms at
`https://www.remotion.dev/license` and `https://www.remotion.dev/docs/license`, confirm
the company-size threshold and whether the SaaS/rendering use is covered, and get the
license in place. Do not assume — the terms are the authority and can change. The DS-8
spec explicitly requires validating commercial licensing first.
