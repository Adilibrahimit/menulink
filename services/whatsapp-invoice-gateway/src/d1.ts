import { Env, nowIso } from "./env";
import { reduceStatus, rankOf, StatusName } from "./status";

/** Thin tenant-scoped D1 repository. No invoice files / Meta tokens are ever stored. */
export class Repo {
  constructor(private db: D1Database) {}
  static of(env: Env) { return new Repo(env.DB); }

  async resolveTenantByPhoneNumberId(pnid: string): Promise<{ tenantId: string; windowSalt: string } | null> {
    const row = await this.db.prepare(
      `SELECT t.tenant_id AS tenantId, t.window_salt AS windowSalt
         FROM phone_numbers p JOIN tenants t ON t.tenant_id = p.tenant_id
        WHERE p.phone_number_id = ? AND p.status='active' AND t.status='active'`
    ).bind(pnid).first<{ tenantId: string; windowSalt: string }>();
    return row ?? null;
  }

  async getInstallation(id: string): Promise<{ tenantId: string; publicKey: string; status: string } | null> {
    return (await this.db.prepare(
      `SELECT tenant_id AS tenantId, public_key AS publicKey, status
         FROM installations WHERE installation_id = ? AND key_status='active'`
    ).bind(id).first<{ tenantId: string; publicKey: string; status: string }>()) ?? null;
  }

  async nonceSeen(nonce: string): Promise<boolean> {
    const r = await this.db.prepare(`SELECT 1 FROM auth_nonces WHERE nonce = ?`).bind(nonce).first();
    return !!r;
  }
  async storeNonce(nonce: string, installationId: string, expiresAtIso: string): Promise<void> {
    await this.db.prepare(`INSERT OR IGNORE INTO auth_nonces(nonce, installation_id, seen_at, expires_at) VALUES(?,?,?,?)`)
      .bind(nonce, installationId, nowIso(), expiresAtIso).run();
  }

  async touchInstallation(id: string): Promise<void> {
    await this.db.prepare(`UPDATE installations SET last_seen_at=? WHERE installation_id=?`).bind(nowIso(), id).run();
  }

  /** Idempotent webhook-event insert keyed by payload hash. Returns true if newly inserted. */
  async insertEventIdempotent(eventId: string, e: {
    tenantId: string | null; pnid: string | null; metaMessageId: string | null;
    eventType: string | null; statusRank: number | null; eventTs: string | null; expiresAt: string | null;
  }): Promise<boolean> {
    const res = await this.db.prepare(
      `INSERT OR IGNORE INTO webhook_events(event_id, tenant_id, phone_number_id, meta_message_id, event_type, status_rank, event_timestamp, received_at, expires_at)
       VALUES(?,?,?,?,?,?,?,?,?)`
    ).bind(eventId, e.tenantId, e.pnid, e.metaMessageId, e.eventType, e.statusRank, e.eventTs, nowIso(), e.expiresAt).run();
    return (res.meta.changes ?? 0) > 0;
  }

  async getStatus(metaMessageId: string): Promise<{ status: StatusName; installationId: string | null } | null> {
    const r = await this.db.prepare(
      `SELECT current_status AS status, installation_id AS installationId FROM message_status WHERE meta_message_id=?`
    ).bind(metaMessageId).first<{ status: StatusName; installationId: string | null }>();
    return r ?? null;
  }

  /** Monotonic upsert of a message's status (Codex #4). Mapping may not exist yet → installation_id stays null. */
  async upsertStatusMonotonic(metaMessageId: string, tenantId: string, incoming: StatusName, eventTs: string | null,
    errorCode?: string | null, errorMsg?: string | null): Promise<StatusName> {
    const cur = await this.getStatus(metaMessageId);
    const next = reduceStatus(cur?.status ?? null, incoming);
    const ts = nowIso();
    const tsCol = incoming === "Sent" ? "sent_at" : incoming === "Delivered" ? "delivered_at"
      : incoming === "Read" ? "read_at" : incoming === "Failed" ? "failed_at" : null;
    if (!cur) {
      await this.db.prepare(
        `INSERT INTO message_status(meta_message_id, tenant_id, current_status, status_rank, error_code, error_message_redacted, ${tsCol ?? "updated_at"}, updated_at)
         VALUES(?,?,?,?,?,?,?,?)`
      ).bind(metaMessageId, tenantId, next, rankOf(next), errorCode ?? null, errorMsg ?? null, eventTs ?? ts, ts).run();
    } else if (next !== cur.status || incoming === "Failed") {
      const setTs = tsCol ? `, ${tsCol}=?` : "";
      const binds: unknown[] = [next, rankOf(next), errorCode ?? null, errorMsg ?? null];
      if (tsCol) binds.push(eventTs ?? ts);
      binds.push(ts, metaMessageId);
      await this.db.prepare(
        `UPDATE message_status SET current_status=?, status_rank=?, error_code=COALESCE(?,error_code), error_message_redacted=COALESCE(?,error_message_redacted)${setTs}, updated_at=? WHERE meta_message_id=?`
      ).bind(...binds).run();
    }
    return next;
  }

  /**
   * Idempotent mapping register + reconcile orphan status (Codex #4).
   * Tenant-scoped: a meta_message_id already owned by ANOTHER tenant is rejected (no cross-tenant takeover).
   * Returns false on a cross-tenant attempt so the caller can 403.
   */
  async registerMapping(m: {
    tenantId: string; installationId: string; localJobId: string; invoiceIdHash: string;
    metaMessageId: string; phoneNumberId: string;
  }): Promise<boolean> {
    const existing = await this.db.prepare(
      `SELECT tenant_id AS tenantId FROM message_mappings WHERE meta_message_id=?`
    ).bind(m.metaMessageId).first<{ tenantId: string }>();
    if (existing && existing.tenantId !== m.tenantId) return false; // cross-tenant takeover refused

    await this.db.prepare(
      `INSERT INTO message_mappings(tenant_id, installation_id, local_job_id, invoice_id_hash, meta_message_id, phone_number_id, created_at)
       VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(meta_message_id) DO UPDATE SET installation_id=excluded.installation_id, local_job_id=excluded.local_job_id
       WHERE message_mappings.tenant_id = excluded.tenant_id`
    ).bind(m.tenantId, m.installationId, m.localJobId, m.invoiceIdHash, m.metaMessageId, m.phoneNumberId, nowIso()).run();
    // reconcile: attach installation only to THIS tenant's already-recorded status
    await this.db.prepare(
      `UPDATE message_status SET installation_id=?, updated_at=? WHERE meta_message_id=? AND tenant_id=? AND (installation_id IS NULL OR installation_id='')`
    ).bind(m.installationId, nowIso(), m.metaMessageId, m.tenantId).run();
    return true;
  }

  async upsertWindow(tenantId: string, pnid: string | null, cwh: string, lastMsgAtIso: string, expiresAtIso: string): Promise<void> {
    await this.db.prepare(
      `INSERT INTO customer_service_windows(tenant_id, phone_number_id, customer_wa_id_hash, last_customer_message_at, window_expires_at, updated_at)
       VALUES(?,?,?,?,?,?)
       ON CONFLICT(tenant_id, customer_wa_id_hash) DO UPDATE SET phone_number_id=excluded.phone_number_id,
         last_customer_message_at=excluded.last_customer_message_at, window_expires_at=excluded.window_expires_at, updated_at=excluded.updated_at`
    ).bind(tenantId, pnid, cwh, lastMsgAtIso, expiresAtIso, nowIso()).run();
  }

  async getWindow(tenantId: string, cwh: string): Promise<{ expiresAt: string; lastAt: string } | null> {
    const r = await this.db.prepare(
      `SELECT window_expires_at AS expiresAt, last_customer_message_at AS lastAt FROM customer_service_windows WHERE tenant_id=? AND customer_wa_id_hash=?`
    ).bind(tenantId, cwh).first<{ expiresAt: string; lastAt: string }>();
    return r ?? null;
  }

  async statusSince(tenantId: string, cursorIso: string, limit: number): Promise<Array<Record<string, unknown>>> {
    const rs = await this.db.prepare(
      `SELECT meta_message_id, current_status, status_rank, error_code, error_message_redacted, updated_at
         FROM message_status WHERE tenant_id=? AND updated_at > ? ORDER BY updated_at LIMIT ?`
    ).bind(tenantId, cursorIso, limit).all();
    return rs.results as Array<Record<string, unknown>>;
  }

  async retentionCleanup(now: Date): Promise<{ events: number; nonces: number; windows: number }> {
    const nowI = now.toISOString();
    const e = await this.db.prepare(`DELETE FROM webhook_events WHERE expires_at IS NOT NULL AND expires_at < ?`).bind(nowI).run();
    const n = await this.db.prepare(`DELETE FROM auth_nonces WHERE expires_at < ?`).bind(nowI).run();
    const w = await this.db.prepare(`DELETE FROM customer_service_windows WHERE window_expires_at < ?`).bind(addDaysIso(now, -7)).run();
    return { events: e.meta.changes ?? 0, nonces: n.meta.changes ?? 0, windows: w.meta.changes ?? 0 };
  }
}

function addDaysIso(base: Date, days: number): string { return new Date(base.getTime() + days * 86400_000).toISOString(); }
