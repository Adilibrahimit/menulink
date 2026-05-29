# Proof · DS-4-1 — Dynamic QR Backbone

- **Date:** 2026-05-29
- **Phase:** DS-4-1 (first slice of DS-4). Migrations 0059–0065 live.
- **Branch:** `ds-4-1-dynamic-qr-backbone` (off `main`)
- **Spec/Plan:** `docs/superpowers/specs/2026-05-29-ds-4-1-dynamic-qr-backbone-design.md` ·
  `docs/superpowers/plans/2026-05-29-ds-4-1-dynamic-qr-backbone.md`

## Goal

A public `/q/{code}` route resolves an active `qr_link` and 302-redirects to its `destination_url`,
recording a `qr_scan_event` — the repointable-QR + analytics backbone for DS-4.

## Files changed

```
A apps/web/supabase/migrations/0065_resolve_qr_link.sql
A apps/web/app/q/[code]/route.ts
A docs/proofs/DS-4-1-dynamic-qr-backbone.md
```

Subagent-driven: one implementer subagent per task; main-agent review + verification + commit;
all live-DB ops by the main agent on `rzrz-bukhari-test` only.

## Migration 0065 / RPC

`public.resolve_qr_link(p_code, p_user_agent, p_referrer, p_source_type) returns text` —
`SECURITY DEFINER`, `set search_path = public`, granted to `anon` + `authenticated`. `plpgsql`:
looks up the active `qr_link` by `code`; returns `null` if none; else inserts a `qr_scan_event`
(inside an exception guard so tracking never blocks the redirect; `source_type` coerced to
`'unknown'` unless an allowed value; `ip_hash` left null; user-agent/referrer bounded to 500) and
returns `destination_url`. Bypasses RLS (route is anonymous) — same pattern as `get_public_menu`.
`get_public_menu` and existing QR untouched; no anon RLS added.

## Route

`apps/web/app/q/[code]/route.ts` — a GET Route Handler: resolves `code` via the RPC (passing
user-agent/referer headers + optional `?s=` source), 302-redirects to the destination
(`new URL(dest, request.url)` so relative `/m/...` resolves against the origin); miss → 302 to `/`.
Builds as a 0 B dynamic route (`ƒ`) — pure redirect, no JS bundle.

## Verification (live, `rzrz-bukhari-test` only)

Inserted a test link `velolabqr1 → /m/rzrz-bukhari-test` on the clone, then:

| Check | Result |
|---|---|
| `resolve_qr_link('velolabqr1', …, 'poster')` | `/m/rzrz-bukhari-test` |
| `resolve_qr_link('velolabqr1', …, 'sticker')` | `/m/rzrz-bukhari-test` |
| scan events recorded (fresh count) | **2** (source kinds: poster, sticker) |
| `ip_hash` stored | **null** (no raw IP) |
| `resolve_qr_link('nope-not-real')` | **null** |

Note: counting scans *within the same `SELECT`* that calls the RPC shows 0 (single-statement
snapshot — the count can't see the row the volatile function just inserted); a fresh query
confirms the insert committed. Verified in a separate query (count = 2).

- `npx tsc --noEmit` clean; `npm run build` SUCCESS (`/q/[code]` in the route list).

## Guardrails verified

- Existing `/admin/qr`, `restaurant_tables.qr_token` table-QR, `menu-qr-poster.ts`, and
  `get_public_menu` are untouched. No anon RLS policy added.
- No raw IP (`ip_hash` null). Scan-insert failure can't block the redirect (exception guard).
- Additive migration; no destructive SQL. All writes on `rzrz-bukhari-test` only.

## Known limitations

- **No link creation yet** — links are created in DS-4-2 (the QR design/profile UI). The demo
  link `velolabqr1` was inserted directly on the clone for verification and **kept** as a live
  demo (delete anytime).
- HTTP-level 302 confirmed by build + the RPC; an end-to-end browser GET on `/q/velolabqr1` is an
  operator smoke step after deploy.

## Next

**DS-4-2 · QR design profiles + preview + export** — Ops QR tab (`restaurant_qr_profiles`): pick a
`qr_design_template` + purpose + target + CTA, **create** the `qr_link` (via `lib/design/qr.ts`),
preview the composed poster/card, export PNG/SVG to storage (`qr_exports`) with a data hash.
