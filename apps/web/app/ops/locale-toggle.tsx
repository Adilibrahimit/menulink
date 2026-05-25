"use client";

import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/locales";

export default function LocaleToggle({ current }: { current: Locale }) {
  const router = useRouter();
  const next: Locale = current === "ar" ? "en" : "ar";
  const label = current === "ar" ? "EN" : "ع";

  return (
    <button
      onClick={async () => {
        await setLocale(next);
        router.refresh();
      }}
      className="text-neutral-400 hover:text-neutral-100 text-xs border border-neutral-700 rounded px-2 py-1"
      title={current === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      {label}
    </button>
  );
}
