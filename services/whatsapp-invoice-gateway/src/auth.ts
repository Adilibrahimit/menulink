import { Env, addHoursIso } from "./env";
import { Repo } from "./d1";
import { sha256Hex, verifyEcdsaP256 } from "./crypto";

export interface AuthResult { ok: boolean; tenantId?: string; installationId?: string; error?: string }

/**
 * Verify an installation-authenticated request (Codex #1 — ECDSA, no shared secret).
 * Headers: X-Inst-Id, X-Timestamp (unix sec), X-Nonce, X-Signature (base64 raw r||s).
 * Signed canonical message: `${installationId}\n${timestamp}\n${nonce}\n${sha256hex(rawBody)}`.
 * Rejects: missing headers, clock skew, unknown/disabled installation, replayed nonce, bad signature.
 */
export async function verifyInstallationRequest(env: Env, repo: Repo, req: Request, rawBody: string): Promise<AuthResult> {
  const id = req.headers.get("X-Inst-Id");
  const ts = req.headers.get("X-Timestamp");
  const nonce = req.headers.get("X-Nonce");
  const sig = req.headers.get("X-Signature");
  if (!id || !ts || !nonce || !sig) return { ok: false, error: "missing auth headers" };

  const skew = parseInt(env.AUTH_SKEW_SECONDS || "120", 10);
  const tsNum = parseInt(ts, 10);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > skew) return { ok: false, error: "timestamp skew" };

  const inst = await repo.getInstallation(id);
  if (!inst || inst.status !== "active") return { ok: false, error: "unknown/disabled installation" };

  if (await repo.nonceSeen(nonce)) return { ok: false, error: "nonce replay" };

  const bodyHash = await sha256Hex(rawBody);
  const message = `${id}\n${ts}\n${nonce}\n${bodyHash}`;
  if (!(await verifyEcdsaP256(inst.publicKey, message, sig))) return { ok: false, error: "bad signature" };

  // accept → burn the nonce (replay protection) and refresh last-seen
  await repo.storeNonce(nonce, id, addHoursIso(new Date(), 1));
  return { ok: true, tenantId: inst.tenantId, installationId: id };
}
