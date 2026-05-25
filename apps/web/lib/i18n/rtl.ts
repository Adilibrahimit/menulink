import type { Locale } from "./locales";

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isRTL(locale: Locale): boolean {
  return locale === "ar";
}
