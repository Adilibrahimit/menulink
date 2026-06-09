export interface Env {
  DB: D1Database;
  // secrets (wrangler secret put):
  META_APP_SECRET: string;
  WEBHOOK_VERIFY_TOKEN: string;
  // vars:
  WINDOW_HOURS: string;
  AUTH_SKEW_SECONDS: string;
}

export function nowIso(): string { return new Date().toISOString(); }
export function addHoursIso(base: Date, hours: number): string {
  return new Date(base.getTime() + hours * 3600_000).toISOString();
}
