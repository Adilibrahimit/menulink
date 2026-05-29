# DS-4-1 · Dynamic QR Backbone — Design Spec

- **Date:** 2026-05-29
- **Phase:** DS-4-1 (first slice of DS-4). Migrations 0059–0064 live.
- **Status:** Approved design, pre-implementation
- **Branch:** `ds-4-1-dynamic-qr-backbone` (off `main`)
- **Depends on:** DS-1 tables `qr_links` + `qr_scan_events` (RLS ops/owner-only); `lib/design/qr.ts`
  exists but is not needed for this slice (link creation is DS-4-2).

## Goal

Make dynamic QR short-links work: a public `/q/{code}` route resolves an active `qr_link` and
**302-redirects** to its `destination_url`, recording a `qr_scan_event`. This is the repointable-QR
+ analytics backbone the rest of DS-4 builds on.

## Scope

**In scope:** a `SECURITY DEFINER` RPC `resolve_qr_link(...)` and a `/q/[code]` GET Route Handler.

**Out of scope (DS-4-2):** link *creation*, QR design profiles/templates UI, QR preview, PNG/SVG
exports (`qr_exports`), unifying the existing `restaurant_tables.qr_token` table-QR. Also out:
changes to `/admin/qr`, `get_public_menu`, RLS, promotions/print.

## Migration 0065

`apps/web/supabase/migrations/0065_resolve_qr_link.sql` — additive; one function, no schema change.

```sql
-- ============================================================================
-- MenuLink · 0065_resolve_qr_link
--
-- DS-4-1: resolve a dynamic QR short-link and record a scan, for the public
-- /q/{code} route. SECURITY DEFINER (the route is anonymous; qr_links and
-- qr_scan_events are RLS ops/owner-only). Tracking is best-effort and never
-- blocks the redirect. Additive; get_public_menu and existing QR untouched.
-- ============================================================================

create or replace function public.resolve_qr_link(
  p_code text,
  p_user_agent text default null,
  p_referrer text default null,
  p_source_type text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_rid uuid;
  v_dest text;
  v_src text;
begin
  select id, restaurant_id, destination_url
    into v_id, v_rid, v_dest
  from public.qr_links
  where code = p_code and is_active = true
  limit 1;

  if v_id is null then
    return null;
  end if;

  v_src := case
    when p_source_type in ('table', 'poster', 'sticker', 'offer', 'category', 'item')
    then p_source_type else 'unknown'
  end;

  begin
    insert into public.qr_scan_events (restaurant_id, qr_link_id, user_agent, referrer, source_type)
    values (v_rid, v_id, left(p_user_agent, 500), left(p_referrer, 500), v_src);
  exception when others then
    null; -- scan tracking is best-effort; never block the redirect
  end;

  return v_dest;
end;
$$;

grant execute on function public.resolve_qr_link(text, text, text, text) to anon, authenticated;
```

## RPC contract

- **Input:** `p_code` (required), `p_user_agent`, `p_referrer`, `p_source_type` (optional).
- **Output:** `text` — the link's `destination_url`, or `null` if no active link matches `code`.
- **Side effect:** a `qr_scan_event` row (best-effort, exception-guarded). `source_type` coerced to
  `'unknown'` unless one of the check-constraint values; `ip_hash` left null (privacy default);
  user-agent/referrer bounded to 500 chars.
- **Security:** `SECURITY DEFINER`, fixed `search_path`, granted to `anon` + `authenticated`.

## `/q/[code]` route

`apps/web/app/q/[code]/route.ts` — a GET Route Handler (no UI):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const sb = createClient();
  const source = new URL(request.url).searchParams.get("s");
  const { data: destination } = await sb.rpc("resolve_qr_link", {
    p_code: params.code,
    p_user_agent: request.headers.get("user-agent"),
    p_referrer: request.headers.get("referer"),
    p_source_type: source,
  });
  const target = typeof destination === "string" && destination.length > 0 ? destination : "/";
  return NextResponse.redirect(new URL(target, request.url), 302);
}
```

- On a hit → 302 to the destination (relative `/m/...` resolved against the request origin).
- On a miss/inactive code → 302 to `/` (graceful; no 404 dead-end for a physical scan).
- The scan is recorded inside the RPC; the route does no DB writes directly.

## Safety / guardrails

- New public route + additive migration only. `/admin/qr`, `restaurant_tables.qr_token` table-QR,
  `menu-qr-poster.ts`, `get_public_menu` — all untouched. No anon RLS policy added.
- No raw IP stored (`ip_hash` null). Scan-insert failure can't block the redirect (exception guard).
- Verification/writes only on `rzrz-bukhari-test`; never `koko`/`rzrz-bukhari`. If the slug isn't
  exactly `rzrz-bukhari-test`, stop and ask.

## Files

Create: `apps/web/supabase/migrations/0065_resolve_qr_link.sql`, `apps/web/app/q/[code]/route.ts`.

## Verification plan (clone only)

1. Apply `0065`; confirm the function exists.
2. Insert a test `qr_link` on `rzrz-bukhari-test` via the PAT:
   `insert into qr_links (restaurant_id, code, target_type, destination_url, is_active) select id, 'velolabqr1', 'menu', '/m/rzrz-bukhari-test', true from restaurants where slug='rzrz-bukhari-test';`
3. `select public.resolve_qr_link('velolabqr1','ua/test','ref/test','poster')` → returns
   `/m/rzrz-bukhari-test`; then confirm a `qr_scan_event` row exists for that link
   (`source_type='poster'`, `ip_hash` null).
4. `select public.resolve_qr_link('nope-not-a-code')` → `null`.
5. `npx tsc --noEmit` + `npm run build` (`--max-old-space-size=8192`) green; `/q/[code]` in the
   route list.
6. (After deploy or local) GET `/q/velolabqr1` → 302 → `/m/rzrz-bukhari-test`; a scan event records.
7. Clean up the test link + its scan events on the clone (or keep as a demo).

## Out-of-scope / next

**DS-4-2 · QR design profiles + preview + export** — Ops studio QR tab (`restaurant_qr_profiles`):
select a `qr_design_template` + purpose + target + CTA, **create** the `qr_link` (using
`lib/design/qr.ts` `generateShortCode`/`buildQrDestination`), preview the composed poster/card, and
export PNG/SVG to storage (`qr_exports`) with a data hash. That phase produces the assets that point
at these `/q/{code}` links.
