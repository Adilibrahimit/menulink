import { describe, it, expect } from "vitest";
import { verifyMetaSignature, hmacSha256Hex, verifyEcdsaP256, deriveCwh, sha256Hex, bytesToHex } from "../src/crypto";
import { reduceStatus, fromMetaStatus, rankOf } from "../src/status";

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));

describe("Meta webhook signature (HMAC-SHA256)", () => {
  it("accepts a correct sha256= header and rejects tampered/absent", async () => {
    const secret = "app-secret-123";
    const body = '{"entry":[{"id":"1"}]}';
    const good = "sha256=" + (await hmacSha256Hex(secret, body));
    expect(await verifyMetaSignature(secret, body, good)).toBe(true);
    expect(await verifyMetaSignature(secret, body + "x", good)).toBe(false);
    expect(await verifyMetaSignature(secret, body, "sha256=deadbeef")).toBe(false);
    expect(await verifyMetaSignature(secret, body, null)).toBe(false);
  });
});

describe("Installation ECDSA P-256 (Codex #1 — asymmetric)", () => {
  it("verifies a genuine signature and rejects tampered sig / wrong key", async () => {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey));
    const pubB64 = b64(spki);
    const msg = "inst-1\n1736400000\nnonce-abc\n" + (await sha256Hex("body"));
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, new TextEncoder().encode(msg)));
    const sigB64 = b64(sig);

    expect(await verifyEcdsaP256(pubB64, msg, sigB64)).toBe(true);
    expect(await verifyEcdsaP256(pubB64, msg + "x", sigB64)).toBe(false);   // tampered message
    const flipped = new Uint8Array(sig); flipped[0] ^= 0xff;
    expect(await verifyEcdsaP256(pubB64, msg, b64(flipped))).toBe(false);    // tampered signature

    const other = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const otherSpki = b64(new Uint8Array(await crypto.subtle.exportKey("spki", other.publicKey)));
    expect(await verifyEcdsaP256(otherSpki, msg, sigB64)).toBe(false);       // wrong key
  });
});

describe("monotonic status reducer (Codex #4)", () => {
  it("never regresses and Failed is terminal", () => {
    expect(reduceStatus(null, "Sent")).toBe("Sent");
    expect(reduceStatus("Sent", "Delivered")).toBe("Delivered");
    expect(reduceStatus("Read", "Delivered")).toBe("Read");   // no regress
    expect(reduceStatus("Delivered", "Sent")).toBe("Delivered"); // no regress
    expect(reduceStatus("Delivered", "Failed")).toBe("Failed");  // failure wins
    expect(reduceStatus("Failed", "Read")).toBe("Failed");       // terminal sticks
    expect(rankOf("Read")).toBeGreaterThan(rankOf("Delivered"));
    expect(fromMetaStatus("DELIVERED")).toBe("Delivered");
    expect(fromMetaStatus("bogus")).toBeNull();
  });
});

describe("customer_wa_id_hash (Codex #3)", () => {
  it("is deterministic SHA-256(salt|e164) and salt-separated", async () => {
    const cwh = await deriveCwh("tenant-salt", "966500000001");
    expect(cwh).toBe(await sha256Hex("tenant-salt|966500000001"));
    expect(cwh).not.toBe(await deriveCwh("other-salt", "966500000001")); // salt matters (tenant isolation)
    expect(cwh).toHaveLength(64);
    expect(bytesToHex(new Uint8Array([0, 255]))).toBe("00ff");
  });
});
