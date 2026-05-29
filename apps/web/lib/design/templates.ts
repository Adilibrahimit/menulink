// Stable template-key registry (DS-1 foundation).
// These const arrays are the single source of truth that migration 0059's seed
// mirrors. Code should reference templates by key, never by UUID. Pure module.

import type { DesignTokens, Tier } from "./types";

export const BRAND_TEMPLATE_KEYS = [
  "koko-bold-v1",
  "rzrz-navy-v1",
  "velora-premium-v1",
  "standard-clean-v1",
  "cafe-minimal-v1",
] as const;

export const PAGE_TEMPLATE_KEYS = [
  "fast-food-grid-v1",
  "premium-lounge-grid-v1",
] as const;

export const PRINT_TEMPLATE_KEYS = [
  "a3-full-menu-bold-v1",
  "a4-full-menu-clean-v1",
] as const;

export const QR_TEMPLATE_KEYS = [
  "qr-standard-a4-poster-v1",
  "qr-standard-table-tent-v1",
  "qr-koko-bold-poster-v1",
  "qr-rzrz-navy-table-v1",
  "qr-velora-premium-card-v1",
] as const;

export type BrandTemplateKey = (typeof BRAND_TEMPLATE_KEYS)[number];
export type PageTemplateKey = (typeof PAGE_TEMPLATE_KEYS)[number];
export type PrintTemplateKey = (typeof PRINT_TEMPLATE_KEYS)[number];
export type QrTemplateKey = (typeof QR_TEMPLATE_KEYS)[number];

// Typed registry of brand-template seed defaults, for reuse by later phases
// (DS-2 preview, DS-3 resolver). Kept in sync with the 0059 seed payloads.
export const BRAND_TEMPLATE_DEFAULTS: Record<
  BrandTemplateKey,
  { tier: Tier; businessType: string; tokens: DesignTokens }
> = {
  "koko-bold-v1": {
    tier: "standard",
    businessType: "broasted",
    tokens: {
      colors: { background: "#FAF6EE", surface: "#FFFFFF", primary: "#D32027", primaryDark: "#A0181D", accent: "#FFC619", text: "#2A1810", muted: "#71717A" },
      typography: { heading: "Tajawal", body: "Cairo", latin: "Geist" },
      mood: "bold-fast-food",
      radius: { card: "18px", button: "14px" },
    },
  },
  "rzrz-navy-v1": {
    tier: "pro",
    businessType: "rice-restaurant",
    tokens: {
      colors: { background: "#061A3A", surface: "#FFFFFF", primary: "#C8A15A", accent: "#F7C948", text: "#0B1220", muted: "#6B7280" },
      typography: { heading: "Alexandria", body: "Cairo", latin: "Geist" },
      mood: "navy-saudi-restaurant",
      radius: { card: "20px", button: "999px" },
    },
  },
  "velora-premium-v1": {
    tier: "premium",
    businessType: "restaurant-cafe-lounge",
    tokens: {
      colors: { background: "#0F0E0D", surface: "#1C1A17", surfaceSoft: "#25221D", primary: "#C8A15A", accent: "#6B1E1E", secondaryBrown: "#3A3026", secondaryGreen: "#183A2F", text: "#F3EBDD", muted: "#A79A86", line: "#4A3821" },
      typography: { heading: "Tajawal", body: "Tajawal", latin: "Cormorant Garamond" },
      mood: "premium-lounge",
      radius: { card: "22px", button: "16px" },
    },
  },
  "standard-clean-v1": {
    tier: "standard",
    businessType: "general",
    tokens: {
      colors: { background: "#FAF6EE", surface: "#FFFFFF", primary: "#D32027", text: "#18181B", muted: "#71717A" },
      typography: { heading: "Tajawal", body: "Cairo", latin: "Geist" },
      mood: "clean-general",
    },
  },
  "cafe-minimal-v1": {
    tier: "standard",
    businessType: "cafe",
    tokens: {
      colors: { background: "#F8F4ED", surface: "#FFFFFF", primary: "#3D2914", accent: "#C9A86A", text: "#1A1108", muted: "#8B7B6B" },
      typography: { heading: "Tajawal", body: "Cairo", latin: "Geist" },
      mood: "calm-cafe",
    },
  },
};
