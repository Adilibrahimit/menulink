# DS-7 Export Management — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps `- [ ]`.

**Goal:** Export fingerprint (outdated-detection) + save QR exports to storage + a per-link saved-
exports list with download + outdated badge. No Chromium.
**Branch:** `ds-7-export-mgmt`. Migration **0067**. **Verify:** tsc/build + live RPC read + clone insert.

## Files
- Create `apps/web/supabase/migrations/0067_get_export_fingerprint.sql`.
- Create `apps/web/app/ops/tenants/[id]/design/export-actions.ts` (`recordQrExport`).
- Modify `apps/web/app/ops/tenants/[id]/design/qr-tab.tsx` (thread exports+fingerprint; save btn + list).
- Modify `apps/web/app/ops/tenants/[id]/design/page.tsx` (load qr_exports + fingerprint; pass props).

## Task 1 — migration + server action (subagent)

**0067_get_export_fingerprint.sql** (exact):
```sql
-- DS-7: export fingerprint for outdated-detection.
-- md5 over the composed output of the three public RPCs (menu + promotions + design tokens).
-- Any change to menu/prices/images/promotions/design ⇒ new hash ⇒ stored exports become outdated.
create or replace function public.get_export_fingerprint(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5(
    coalesce(public.get_public_menu(p_slug)::text, '') ||
    coalesce(public.get_active_promotions(p_slug)::text, '') ||
    coalesce(public.get_published_design(p_slug)::text, '')
  );
$$;

grant execute on function public.get_export_fingerprint(text) to anon, authenticated;
```

**export-actions.ts** (exact):
```ts
"use server";

import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function recordQrExport(input: {
  restaurantId: string;
  slug: string;
  qrLinkId: string;
  pngDataUrl: string;
}): Promise<{ error?: string }> {
  await requireOps();

  const base64 = input.pngDataUrl.split(",")[1] ?? "";
  if (!base64) return { error: "صورة غير صالحة" };

  const sb = createClient();
  const { data: fp } = await sb.rpc("get_export_fingerprint", { p_slug: input.slug });
  const fingerprint = typeof fp === "string" ? fp : "";

  const admin = adminClient();
  const buffer = Buffer.from(base64, "base64");
  const path = `exports/${input.restaurantId}/qr/${input.qrLinkId}-${Date.now()}.png`;
  const up = await admin.storage
    .from("menu-images")
    .upload(path, buffer, { contentType: "image/png", upsert: true });
  if (up.error) return { error: up.error.message };

  const { data: pub } = admin.storage.from("menu-images").getPublicUrl(path);

  const { error } = await admin.from("qr_exports").insert({
    restaurant_id: input.restaurantId,
    qr_link_id: input.qrLinkId,
    export_type: "png",
    file_url: pub.publicUrl,
    data_hash: fingerprint,
    status: "rendered",
    rendered_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/ops/tenants/${input.restaurantId}/design`);
  return {};
}
```

- [ ] Subagent: create both files. (No tsc/build yet — Task 2 wires the UI; build at end of Task 2.)
- [ ] MAIN: review (RPC additive/anon-read; action ops-only, admin upload to existing bucket, insert
      matches `qr_exports` columns). Commit `DS-7: fingerprint RPC + recordQrExport action`.

## Task 2 — qr-tab + page wiring (subagent)

**qr-tab.tsx edits** (exact find/replace):

1. After `import { createQrCode } from "./qr-actions";` add:
```ts
import { recordQrExport } from "./export-actions";
```

2. After the `type QrLinkRow = ...` line add:
```ts
type QrExportRow = {
  id: string; qr_link_id: string; file_url: string | null;
  data_hash: string | null; status: string; rendered_at: string | null;
};
```

3. Change the `QrTab` signature line:
```ts
}: { restaurant: Restaurant; templates: Template[]; qrProfiles: QrProfileRow[] }) {
```
→
```ts
}: {
  restaurant: Restaurant; templates: Template[]; qrProfiles: QrProfileRow[];
  exports: QrExportRow[]; fingerprint: string;
}) {
```
and add `exports, fingerprint,` to the destructured params (the `{ restaurant, templates, qrProfiles, }` list becomes `{ restaurant, templates, qrProfiles, exports, fingerprint, }`).

4. Replace the `flatMap` render line:
```tsx
          <QrLinkCard key={l.id} restaurant={restaurant} profileName={p.name_ar} link={l} />
```
→
```tsx
          <QrLinkCard
            key={l.id}
            restaurant={restaurant}
            profileName={p.name_ar}
            link={l}
            exports={exports.filter((e) => e.qr_link_id === l.id)}
            fingerprint={fingerprint}
          />
```

5. Change `QrLinkCard` signature:
```ts
function QrLinkCard({
  restaurant, profileName, link,
}: { restaurant: Restaurant; profileName: string; link: QrLinkRow }) {
```
→
```ts
function QrLinkCard({
  restaurant, profileName, link, exports, fingerprint,
}: {
  restaurant: Restaurant; profileName: string; link: QrLinkRow;
  exports: QrExportRow[]; fingerprint: string;
}) {
  const router = useRouter();
```

6. In `QrLinkCard`, after the `async function dl(...) { ... }` block (right before `return (`), add:
```ts
  async function saveExport() {
    if (!url) return;
    setBusy("save");
    try {
      const d = await QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 2, width: 1024 });
      const res = await recordQrExport({
        restaurantId: restaurant.id, slug: restaurant.slug, qrLinkId: link.id, pngDataUrl: d,
      });
      if (!res.error) router.refresh();
    } finally { setBusy(null); }
  }
```

7. In the `QrLinkCard` button row, after the SVG button add a save button:
```tsx
          <button onClick={saveExport} disabled={busy !== null}
            className="text-xs rounded bg-neutral-800 border border-neutral-700 px-2 py-1 hover:bg-neutral-700 disabled:opacity-60">{busy === "save" ? "..." : "💾 حفظ نسخة"}</button>
```

8. Replace the closing of the text column — change:
```tsx
        </div>
      </div>
    </div>
  );
}
```
(the end of `QrLinkCard`) → insert the saved-exports list before the two closing `</div>`s. Exact: after the button-row's closing `</div>` (the `<div className="mt-2 flex gap-2 ...">...</div>`) add:
```tsx
        {exports.length > 0 && (
          <div className="mt-3 space-y-1 text-[11px]">
            {exports.map((e) => {
              const outdated = !!fingerprint && e.data_hash !== fingerprint;
              return (
                <div key={e.id} className="flex items-center gap-2 justify-center sm:justify-start text-neutral-400">
                  {e.file_url
                    ? <a href={e.file_url} target="_blank" rel="noreferrer" className="underline hover:text-neutral-200">تحميل</a>
                    : <span>—</span>}
                  <span className="font-mono" dir="ltr">{e.rendered_at ? new Date(e.rendered_at).toLocaleDateString("ar") : ""}</span>
                  {outdated
                    ? <span className="rounded bg-amber-900/50 border border-amber-800 text-amber-300 px-1">قديم — تغيّرت البيانات</span>
                    : <span className="rounded bg-green-900/40 border border-green-800 text-green-300 px-1">محدّث</span>}
                </div>
              );
            })}
          </div>
        )}
```

**page.tsx edits** (exact find/replace):

1. Change the destructure + Promise.all opening:
```ts
  const [{ data: r }, { data: profiles }, { data: brandTemplates }, { data: pageTemplates }, { data: qrProfiles }, { data: qrTemplates }, { data: promotions }] =
    await Promise.all([
```
→
```ts
  const [{ data: r }, { data: profiles }, { data: brandTemplates }, { data: pageTemplates }, { data: qrProfiles }, { data: qrTemplates }, { data: promotions }, { data: qrExports }] =
    await Promise.all([
```

2. Add a query to the `Promise.all` array — after the `promotions` select block (the one ending `.order("priority", { ascending: false }).order("created_at", { ascending: false }),`) add:
```ts
      sb.from("qr_exports")
        .select("id, qr_link_id, file_url, data_hash, status, rendered_at")
        .eq("restaurant_id", params.id)
        .order("rendered_at", { ascending: false }),
```

3. After `if (!r) notFound();` add:
```ts
  const { data: fingerprint } = await sb.rpc("get_export_fingerprint", { p_slug: r.slug });
```

4. Change the QrTab render:
```tsx
          <QrTab restaurant={r as any} templates={(qrTemplates ?? []) as any} qrProfiles={(qrProfiles ?? []) as any} />
```
→
```tsx
          <QrTab restaurant={r as any} templates={(qrTemplates ?? []) as any} qrProfiles={(qrProfiles ?? []) as any} exports={(qrExports ?? []) as any} fingerprint={(fingerprint as string) ?? ""} />
```

- [ ] Subagent: apply the qr-tab + page edits; `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` then `npm run build` green.
- [ ] MAIN: review diffs (qr-tab additions surgical; page load+render correct). Commit `DS-7: QR exports save/list + outdated badge`.

## Task 3 — apply + verify + proof + PR (MAIN)
- [ ] Apply 0067 to live via PAT (additive RPC). Read-only verify: `get_export_fingerprint('rzrz-bukhari-test')` = 32-char md5; called twice unchanged = identical; `get_export_fingerprint('koko')` differs (non-null).
- [ ] Clone/test-tenant write check: insert a `qr_exports` row for the `rzrz-bukhari-test` restaurant (mirrors recordQrExport: export_type 'png', data_hash = current fingerprint, status 'rendered') → reads back; flip the fingerprint (or note) → would show outdated. Delete the test row. `koko` qr_exports untouched.
- [ ] Proof `docs/proofs/DS-7-export-mgmt.md`; push; PR (base main); merge+deploy.

## Self-Review
- Fingerprint RPC (outdated detection) → Task 1 ✓ · save-to-storage + record → Task 1 action + Task 2 button ✓ · list + outdated badge → Task 2 ✓.
- Additive: new RPC + new action + QR-tab/page additions; ops-only; existing bucket; no Chromium/deps/bucket. ✓
- Deferred (documented in spec/proof): server-side Chromium PDF, print-export storage, regenerate worker. ✓
