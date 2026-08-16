// Self-check for lib/hours.ts. Run: node apps/web/lib/hours.test.mjs
//
// The SQL side (public.hours_window_contains / is_within_hours, migration 0080)
// has its own test. These two implementations must agree — if you change the
// rules in one, change and re-run both.
import assert from "node:assert/strict";

const CLOSED = new Set(["closed", "مغلق"]);
const ALWAYS = new Set(["24/7", "24-7", "open", "مفتوح"]);
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Mirrors lib/hours.ts (that file is TS; this runner is plain node).
function localNow(at, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  return {
    day: (parts.weekday || "sun").toLowerCase().slice(0, 3),
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}
function parseWindow(w) {
  const m = w.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
}
function windowOpen(win, minutes) {
  const w = win.toLowerCase();
  if (CLOSED.has(w)) return false;
  if (ALWAYS.has(w)) return true;
  const p = parseWindow(w);
  if (!p) return true;
  const [o, c] = p;
  return c > o ? minutes >= o && minutes < c : minutes >= o || minutes < c;
}
function isOpen(hours, tz, at) {
  if (!hours || typeof hours !== "object") return true;
  const { day, minutes } = localNow(at, tz);
  if (hours[day] == null) return true;
  const wins = (Array.isArray(hours[day]) ? hours[day] : [hours[day]]).map(String);
  return wins.some((w) => windowOpen(w, minutes));
}

// 2026-07-26 is a Sunday. 12:00 UTC == 15:00 Asia/Riyadh (UTC+3).
const sunAfternoon = new Date("2026-07-26T12:00:00Z"); // Riyadh 15:00
const sunEarlyAM   = new Date("2026-07-26T22:30:00Z"); // Riyadh 01:30 Monday
const RIY = "Asia/Riyadh";

// fail-open: this is the state of ALL 10 tenants today, so it must stay open
assert.equal(isOpen(null, RIY, sunAfternoon), true, "null hours must be open");
assert.equal(isOpen({}, RIY, sunAfternoon), true, "empty hours must be open");
assert.equal(isOpen({ mon: "closed" }, RIY, sunAfternoon), true, "unlisted day must be open");

// single window
assert.equal(isOpen({ sun: "12:00-23:00" }, RIY, sunAfternoon), true);
assert.equal(isOpen({ sun: "16:00-23:00" }, RIY, sunAfternoon), false);
assert.equal(isOpen({ sun: "closed" }, RIY, sunAfternoon), false);
assert.equal(isOpen({ sun: "24/7" }, RIY, sunAfternoon), true);

// boundaries: open is inclusive, close is exclusive
assert.equal(isOpen({ sun: "15:00-23:00" }, RIY, sunAfternoon), true, "inclusive at open");
assert.equal(isOpen({ sun: "09:00-15:00" }, RIY, sunAfternoon), false, "exclusive at close");

// split shift — the case the old one-window-per-day parser could not express
const split = { sun: ["12:00-15:00", "18:00-02:00"] };
assert.equal(isOpen(split, RIY, new Date("2026-07-26T10:00:00Z")), true,  "13:00 in window 1");
assert.equal(isOpen(split, RIY, new Date("2026-07-26T13:00:00Z")), false, "16:00 in the gap");
assert.equal(isOpen(split, RIY, new Date("2026-07-26T17:00:00Z")), true,  "20:00 in window 2");

// wraps past midnight
assert.equal(isOpen({ mon: "18:00-02:00" }, RIY, sunEarlyAM), true, "01:30 Monday still open");
assert.equal(isOpen({ mon: "18:00-02:00" }, RIY, new Date("2026-07-27T07:00:00Z")), false, "10:00 Monday closed");

// timezone is respected, not hardcoded to Riyadh
// Riyadh 15:00 == London 13:00 == Tokyo 21:00 on this date
assert.equal(isOpen({ sun: "14:00-16:00" }, RIY, sunAfternoon), true);
assert.equal(isOpen({ sun: "14:00-16:00" }, "Europe/London", sunAfternoon), false, "13:00 London is outside 14-16");
assert.equal(isOpen({ sun: "20:00-22:00" }, "Asia/Tokyo", sunAfternoon), true, "21:00 Tokyo is inside 20-22");

// a typo must not take a restaurant offline
assert.equal(isOpen({ sun: "من ١٢ إلى ١١" }, RIY, sunAfternoon), true, "unparseable fails open");

console.log("hours self-check: all assertions passed");
