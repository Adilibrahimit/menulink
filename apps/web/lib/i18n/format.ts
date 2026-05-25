import type { Locale } from "./locales";

const ARABIC_INDIC: Record<string, string> = {
  "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
  "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩",
};

export function toArabicIndic(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => ARABIC_INDIC[d] ?? d);
}

export function formatNumber(value: number, locale: Locale): string {
  if (locale === "ar") return toArabicIndic(value);
  return String(value);
}

export function formatCurrency(value: number, locale: Locale): string {
  const formatted = value.toFixed(2).replace(/\.?0+$/, "");
  if (locale === "ar") return `${toArabicIndic(formatted)} ر.س`;
  return `${formatted} SAR`;
}

export function formatDate(value: string | Date, locale: Locale): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    timeZone: "Asia/Riyadh",
  });
}
