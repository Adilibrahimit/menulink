import { Env, nowIso, addHoursIso } from "./env";
import { Repo } from "./d1";
import { verifyMetaSignature, sha256Hex, deriveCwh } from "./crypto";
import { fromMetaStatus, rankOf } from "./status";
import { verifyInstallationRequest } from "./auth";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p === "/webhook" && req.method === "GET") return verifyChallenge(url, env);
      if (p === "/webhook" && req.method === "POST") return await handleWebhook(req, env);
      if (p === "/api/v1/messages/register" && req.method === "POST") return await handleRegister(req, env);
      if (p === "/api/v1/window" && req.method === "GET") return await handleWindow(req, env, url);
      if (p === "/api/v1/status-sync" && req.method === "GET") return await handleStatusSync(req, env, url);
      if (p === "/api/v1/heartbeat" && req.method === "POST") return await handleHeartbeat(req, env);
      if (p === "/api/v1/health" && req.method === "GET") return json({ ok: true, ts: nowIso() });
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "internal", detail: redact(e) }, 500);
    }
  },

  // retention cron (Codex retention policy)
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await Repo.of(env).retentionCleanup(new Date());
  },
};

function verifyChallenge(url: URL, env: Env): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN && challenge)
    return new Response(challenge, { status: 200 });
  return new Response("forbidden", { status: 403 });
}

async function handleWebhook(req: Request, env: Env): Promise<Response> {
  const raw = await req.text();
  if (!(await verifyMetaSignature(env.META_APP_SECRET, raw, req.headers.get("x-hub-signature-256"))))
    return json({ error: "bad signature" }, 401);

  const repo = Repo.of(env);
  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ ok: true }); } // ack malformed; nothing to do
  const windowHours = parseInt(env.WINDOW_HOURS || "24", 10);

  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const pnid: string | null = value?.metadata?.phone_number_id ?? null;
      if (!pnid) continue;
      const tenant = await repo.resolveTenantByPhoneNumberId(pnid);
      if (!tenant) continue; // unknown phone_number_id → quarantine by ignoring (logged via 200)

      // status events
      for (const st of value?.statuses ?? []) {
        const canonical = fromMetaStatus(st?.status);
        if (!canonical) continue;
        const eventId = await sha256Hex(`${pnid}|${st?.id}|${st?.status}|${st?.timestamp}`);
        const isNew = await repo.insertEventIdempotent(eventId, {
          tenantId: tenant.tenantId, pnid, metaMessageId: st?.id ?? null, eventType: st?.status ?? null,
          statusRank: rankOf(canonical), eventTs: tsToIso(st?.timestamp),
          expiresAt: addDaysIso(new Date(), 30),
        });
        if (!isNew) continue; // idempotent: duplicate webhook
        const err = st?.errors?.[0];
        await repo.upsertStatusMonotonic(st?.id, tenant.tenantId, canonical, tsToIso(st?.timestamp),
          err ? String(err.code ?? "") : null, err ? redactErr(err) : null);
      }

      // inbound customer messages → open/refresh the 24h service window (Codex #3)
      for (const msg of value?.messages ?? []) {
        const from: string | undefined = msg?.from;
        if (!from) continue;
        const cwh = await deriveCwh(tenant.windowSalt, from);
        const last = tsToIso(msg?.timestamp) ?? nowIso();
        await repo.upsertWindow(tenant.tenantId, pnid, cwh, last, addHoursIso(new Date(last), windowHours));
      }
    }
  }
  return json({ ok: true });
}

async function handleRegister(req: Request, env: Env): Promise<Response> {
  const raw = await req.text();
  const repo = Repo.of(env);
  const auth = await verifyInstallationRequest(env, repo, req, raw);
  if (!auth.ok) return json({ error: auth.error }, 401);
  const m = JSON.parse(raw);
  if (m.tenantId && m.tenantId !== auth.tenantId) return json({ error: "tenant mismatch" }, 403);
  await repo.registerMapping({
    tenantId: auth.tenantId!, installationId: auth.installationId!,
    localJobId: String(m.localJobId ?? ""), invoiceIdHash: String(m.invoiceIdHash ?? ""),
    metaMessageId: String(m.metaMessageId ?? ""), phoneNumberId: String(m.phoneNumberId ?? ""),
  });
  return json({ ok: true });
}

async function handleWindow(req: Request, env: Env, url: URL): Promise<Response> {
  const repo = Repo.of(env);
  const auth = await verifyInstallationRequest(env, repo, req, "");
  if (!auth.ok) return json({ error: auth.error }, 401);
  const cwh = url.searchParams.get("cwh");
  if (!cwh) return json({ error: "cwh required" }, 400);
  const w = await repo.getWindow(auth.tenantId!, cwh);
  const open = !!w && new Date(w.expiresAt).getTime() > Date.now();
  return json({ open, window_expires_at: w?.expiresAt ?? null, last_customer_message_at: w?.lastAt ?? null, as_of: nowIso() });
}

async function handleStatusSync(req: Request, env: Env, url: URL): Promise<Response> {
  const repo = Repo.of(env);
  const auth = await verifyInstallationRequest(env, repo, req, "");
  if (!auth.ok) return json({ error: auth.error }, 401);
  const cursor = url.searchParams.get("cursor") || "1970-01-01T00:00:00.000Z";
  const limit = Math.min(500, parseInt(url.searchParams.get("limit") || "200", 10));
  const items = await repo.statusSince(auth.tenantId!, cursor, limit);
  const next = items.length ? String(items[items.length - 1].updated_at) : cursor;
  return json({ items, cursor: next });
}

async function handleHeartbeat(req: Request, env: Env): Promise<Response> {
  const raw = await req.text();
  const repo = Repo.of(env);
  const auth = await verifyInstallationRequest(env, repo, req, raw);
  if (!auth.ok) return json({ error: auth.error }, 401);
  await repo.touchInstallation(auth.installationId!);
  return json({ ok: true });
}

function tsToIso(ts: unknown): string | null {
  if (ts == null) return null;
  const n = typeof ts === "number" ? ts : parseInt(String(ts), 10);
  return Number.isFinite(n) ? new Date(n * 1000).toISOString() : null;
}
function addDaysIso(base: Date, d: number): string { return new Date(base.getTime() + d * 86400_000).toISOString(); }
function redact(e: unknown): string { return (e instanceof Error ? e.message : String(e)).slice(0, 120); }
function redactErr(err: any): string { return String(err?.title ?? err?.message ?? "error").slice(0, 120); }
