"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./locales";
import type { Locale } from "./locales";

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  cookies().set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });
}
