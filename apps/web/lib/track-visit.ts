import { headers } from "next/headers";
import { createHash } from "crypto";
import type { createClient } from "@/lib/supabase-server";

// Bots / link-preview crawlers we must NOT count as visits. WhatsApp is the
// primary share channel for menus, so its preview fetch would otherwise inflate
// every count before a human ever opens the menu.
const BOT_RE =
  /bot|crawler|spider|crawl|facebookexternalhit|whatsapp|telegram|slackbot|twitterbot|discordbot|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|go-http/i;

// Riyadh (UTC+3) calendar date as YYYY-MM-DD, so the daily-device bucket aligns
// with the restaurant's real day, not UTC midnight (which would split an evening
// service across two days). en-CA formats as YYYY-MM-DD.
function riyadhDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

/**
 * Best-effort server-side menu-visit log for /m/[slug]. Never throws.
 *
 * - Skips bot / link-preview crawlers (UA filter).
 * - Skips when the visit arrived via the dynamic short-link /q/[code], which
 *   already logged the scan (`cameViaQr`) — prevents double-counting.
 * - Stores only sha256(ip | ua | riyadh-date) as the dedup key; no raw IP.
 */
export async function logMenuView(
  sb: ReturnType<typeof createClient>,
  slug: string,
  tableLabel: string | null,
  cameViaQr: boolean,
): Promise<void> {
  try {
    if (cameViaQr) return;
    const h = headers();
    const ua = h.get("user-agent") ?? "";
    if (!ua || BOT_RE.test(ua)) return;
    const ipHash = createHash("sha256")
      .update(`${clientIp(h)}|${ua}|${riyadhDate()}`)
      .digest("hex");
    await sb.rpc("log_menu_view", {
      p_slug: slug,
      p_table: tableLabel,
      p_user_agent: ua,
      p_referrer: h.get("referer"),
      p_ip_hash: ipHash,
    });
  } catch {
    // tracking is best-effort; it must never affect the menu render
  }
}
