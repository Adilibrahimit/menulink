import { cookies } from "next/headers";
import type { Locale } from "./locales";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./locales";
import ar from "./ar";
import en from "./en";

export type { Locale };
export { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./locales";
export { dir, isRTL } from "./rtl";
export { formatNumber, formatCurrency, formatDate, toArabicIndic } from "./format";

export type Dictionary = Record<string, Record<string, string>>;

const dictionaries: Record<Locale, Dictionary> = { ar, en };

export function getLocale(): Locale {
  const c = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : DEFAULT_LOCALE;
}

export function getDictionary(locale?: Locale): Dictionary {
  const l = locale ?? getLocale();
  return dictionaries[l];
}

export function t(
  key: string,
  params?: Record<string, string | number>,
  locale?: Locale,
): string {
  const dict = getDictionary(locale);
  const [section, field] = key.split(".", 2);
  const text = dict[section]?.[field] ?? key;
  if (!params) return text;
  let result = text;
  for (const [k, v] of Object.entries(params)) {
    result = result.replace(`{${k}}`, String(v));
  }
  return result;
}
