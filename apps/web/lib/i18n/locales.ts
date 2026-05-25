export type Locale = "ar" | "en";

export const LOCALES: Locale[] = ["ar", "en"];

export const DEFAULT_LOCALE: Locale = "ar";

export const LOCALE_COOKIE = "menulink_locale";

export function isLocale(v: unknown): v is Locale {
  return v === "ar" || v === "en";
}
