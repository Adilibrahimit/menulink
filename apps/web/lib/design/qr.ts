// QR destination + short-code helpers (DS-1 foundation).
// URL/code strings only — no QR rendering (that is DS-4). Pure module; the
// existing /admin/qr flow and qrcode lib are untouched. Not imported anywhere yet.

import { randomBytes } from "node:crypto";

import type { QrTargetType } from "./types";

export type QrTarget =
  | { type: "menu" }
  | { type: "table"; tableLabel: string }
  | { type: "offer"; offerId: string }
  | { type: "category"; categoryId: string }
  | { type: "item"; itemId: string };

// Builds the canonical customer-facing destination path for a QR target.
// Returns a relative path under /m/{slug}; the caller prefixes the origin.
export function buildQrDestination(slug: string, target: QrTarget): string {
  const base = `/m/${slug}`;
  switch (target.type) {
    case "menu":
      return base;
    case "table":
      return `${base}?type=dine_in&table=${encodeURIComponent(target.tableLabel)}`;
    case "offer":
      return `${base}/offers/${encodeURIComponent(target.offerId)}`;
    case "category":
      return `${base}#cat-${encodeURIComponent(target.categoryId)}`;
    case "item":
      return `${base}/items/${encodeURIComponent(target.itemId)}`;
  }
}

export function qrTargetTypeOf(target: QrTarget): QrTargetType {
  return target.type;
}

const SHORT_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

// Generates a url-safe short code for qr_links.code (the /q/{code} key, DS-4).
// Uniqueness is enforced by the unique constraint on qr_links.code at insert time.
export function generateShortCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += SHORT_CODE_ALPHABET[bytes[i] % SHORT_CODE_ALPHABET.length];
  }
  return code;
}
