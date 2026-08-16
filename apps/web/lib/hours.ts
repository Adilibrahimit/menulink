// Working hours for a restaurant or a branch.
//
// This is the UX half. The BOUNDARY is public.is_within_hours() + the
// orders_check_open_hours trigger (migration 0080) — an order placed while
// closed is refused there even if this file says otherwise. Keep the two in
// sync; if you change the format or the wrap-past-midnight rule here, change
// 0080 too.
//
// Replaces the ad-hoc parser that used to live inside closed-popup.tsx, which
// hardcoded Asia/Riyadh and accepted exactly one window per day.

import { toArabicDigits } from "./arabic";

/** One day: a window, several windows, "closed", "24/7", or absent. */
export type DayHours = string | string[] | null;
export type HoursJson = Record<string, DayHours> | null | undefined;

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const DAY_LABELS_AR: Record<string, string> = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت",
};

const CLOSED = new Set(["closed", "مغلق"]);
const ALWAYS = new Set(["24/7", "24-7", "open", "مفتوح"]);

/** Local weekday + minutes-since-midnight in an arbitrary IANA timezone. */
function localNow(at: Date, tz: string): { day: string; minutes: number } {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
      })
        .formatToParts(at)
        .map((p) => [p.type, p.value]),
    );
  } catch {
    // Bad tz string shouldn't take a restaurant offline.
    return localNow(at, "Asia/Riyadh");
  }
  return {
    day: (parts.weekday || "sun").toLowerCase().slice(0, 3),
    // some engines render midnight as "24"
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

/** "HH:MM-HH:MM" -> [openMinutes, closeMinutes], or null if unparseable. */
function parseWindow(win: string): [number, number] | null {
  const m = win.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [oh, om, ch, cm] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  // Out of range means a typo, and a typo must fail OPEN (windowOpen treats null
  // as open). Returning the arithmetic instead produced a window no clock can be
  // inside — "25:00-26:00" spans minutes 1500-1560 while a day only reaches
  // 1439 — so a fumbled digit closed the restaurant permanently. 24:00 is a
  // legitimate way to write end-of-day and stays as 1440.
  if (oh > 24 || ch > 24 || om > 59 || cm > 59) return null;
  return [oh * 60 + om, ch * 60 + cm];
}

/** Normalize a day entry to a list of window strings. */
export function windowsFor(entry: DayHours): string[] {
  if (entry == null) return [];
  return (Array.isArray(entry) ? entry : [entry]).map((w) => String(w).trim()).filter(Boolean);
}

function windowOpen(win: string, minutes: number): boolean {
  const w = win.toLowerCase();
  if (CLOSED.has(w)) return false;
  if (ALWAYS.has(w)) return true;
  const parsed = parseWindow(w);
  if (!parsed) return true; // a typo must not take the restaurant offline
  const [open, close] = parsed;
  return close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close;
}

function fmtTime(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  const suffix = h24 < 12 ? "ص" : "م";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${toArabicDigits(String(h12))}:${toArabicDigits(String(mm).padStart(2, "0"))} ${suffix}`;
}

export type OpenState = {
  open: boolean;
  /** Today's windows, normalized — for display. */
  today: string[];
  /** e.g. "نفتح ٤:٠٠ م" or "نفتح الإثنين ١٢:٠٠ م". Null when open or unknown. */
  nextOpenLabel: string | null;
};

/**
 * Is this restaurant/branch open right now?
 *
 * Fails OPEN whenever hours are absent or unparseable — an owner who never
 * configured hours must keep taking orders. Mirrors public.is_within_hours().
 */
export function getOpenState(
  hours: HoursJson,
  tz: string = "Asia/Riyadh",
  at: Date = new Date(),
): OpenState {
  if (!hours || typeof hours !== "object") return { open: true, today: [], nextOpenLabel: null };

  const { day, minutes } = localNow(at, tz);
  const todayWindows = windowsFor(hours[day]);

  // Day not listed, or listed with nothing usable ("" / []), means UNCONFIGURED
  // and therefore open — same as is_within_hours. Only the literal "closed"
  // closes a day. Without the second half of this test an empty string read as
  // closed here and as open on the server, so the customer saw a closed menu
  // while the API happily took orders.
  if (hours[day] == null || todayWindows.length === 0) {
    return { open: true, today: [], nextOpenLabel: null };
  }

  const open = todayWindows.some((w) => windowOpen(w, minutes));
  if (open) return { open: true, today: todayWindows, nextOpenLabel: null };

  return { open: false, today: todayWindows, nextOpenLabel: nextOpening(hours, day, minutes) };
}

/** First window start from now, scanning today then the next 7 days. */
function nextOpening(hours: Record<string, DayHours>, today: string, minutes: number): string | null {
  const start = DAY_KEYS.indexOf(today as (typeof DAY_KEYS)[number]);
  if (start < 0) return null;

  for (let offset = 0; offset <= 7; offset++) {
    const key = DAY_KEYS[(start + offset) % 7];
    const opens = windowsFor(hours[key])
      .filter((w) => !CLOSED.has(w.toLowerCase()))
      .map((w) => (ALWAYS.has(w.toLowerCase()) ? 0 : parseWindow(w)?.[0]))
      .filter((m): m is number => typeof m === "number")
      .sort((a, b) => a - b);

    for (const openAt of opens) {
      if (offset === 0 && openAt <= minutes) continue; // already passed today
      const when = fmtTime(openAt);
      return offset === 0 ? `نفتح ${when}` : `نفتح ${DAY_LABELS_AR[key]} ${when}`;
    }
  }
  return null;
}

/** Human label for one day, for the hours list in the closed popup. */
export function dayLabel(entry: DayHours): string {
  const wins = windowsFor(entry);
  if (wins.length === 0) return "—";
  return wins
    .map((w) => (CLOSED.has(w.toLowerCase()) ? "مغلق" : ALWAYS.has(w.toLowerCase()) ? "٢٤ ساعة" : w))
    .join(" · ");
}
