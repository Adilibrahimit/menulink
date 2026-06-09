// Security primitives for the gateway. Uses WebCrypto (globalThis.crypto.subtle) — available in the
// Workers runtime and in Node 18+/vitest, so the same code is unit-tested locally.

const enc = new TextEncoder();

export function bytesToHex(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  return Array.from(u).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Constant-time comparison of two equal-length hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(data: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(data));
  return bytesToHex(d);
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(sig);
}

/** Verify Meta's X-Hub-Signature-256: header is "sha256=<hex>" over the raw request body. */
export async function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!header) return false;
  const expected = "sha256=" + (await hmacSha256Hex(appSecret, rawBody));
  return timingSafeEqualHex(header.trim(), expected);
}

/**
 * Verify an installation's ECDSA P-256 signature (Codex #1 — asymmetric, no shared secret).
 * publicKeyB64 = base64 SPKI (DER). signatureB64 = base64 raw r||s (IEEE-P1363, 64 bytes) — the format
 * .NET ECDsa.SignData produces and WebCrypto verify expects.
 */
export async function verifyEcdsaP256(publicKeyB64: string, message: string, signatureB64: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "spki", b64ToBytes(publicKeyB64),
      { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" }, key, b64ToBytes(signatureB64), enc.encode(message)
    );
  } catch {
    return false;
  }
}

/** customer_wa_id_hash = SHA-256(tenant window_salt | E164). Must match the Bridge derivation. */
export function deriveCwh(windowSalt: string, e164: string): Promise<string> {
  return sha256Hex(windowSalt + "|" + e164);
}
