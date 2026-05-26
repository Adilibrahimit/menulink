"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type OutboxRow = {
  id: string;
  restaurant_id: string;
  order_id: string;
  payload: Record<string, unknown> | null;
  status: string;
  claimed_by: string | null;
  claimed_at: string | null;
  pos_invoice_id: string | null;
  pos_invoice_no: number | null;
  attempts: number;
  last_error: string | null;
  last_attempted_at: string | null;
  synced_at: string | null;
  branch_id: string | null;
  operation_type: string | null;
  created_at: string;
};

type SyncEventRow = {
  id: string;
  order_id: string | null;
  provider: string;
  operation_type: string;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  external_invoice_id: string | null;
  created_at: string;
};

type PosSettingsRow = {
  restaurant_id: string;
  pos_kind: string;
  pos_branch_id: number | null;
  online_customer_id: number | null;
  counter_id: number | null;
  invoice_type: number | null;
  default_user_id: number | null;
  tax_percent: string;
  is_tax_inclusive: boolean;
  enabled: boolean;
  branch_id: string | null;
  notes: string | null;
};

type ItemMapRow = {
  restaurant_id: string;
  menu_item_id: string;
  pos_item_id: number;
  pos_variant_key: string | null;
  pos_item_name: string | null;
  display_name_override: string | null;
  notes: string | null;
};

type PosCatalogRow = {
  pos_item_id: number;
  pos_item_name: string | null;
  pos_category: string | null;
  price: number | null;
  is_active: boolean;
};

type Props = {
  restaurantId: string;
  outbox: OutboxRow[];
  syncEvents: SyncEventRow[];
  posSettings: PosSettingsRow | null;
  itemMap: ItemMapRow[];
  menuItems: { id: string; name_ar: string; is_active: boolean }[];
  branches: { id: string; name_ar: string }[];
  posCatalog: PosCatalogRow[];
};

const TABS = [
  { key: "overview", label: "نظرة عامة", icon: "📊" },
  { key: "outbox", label: "صندوق الصادر", icon: "📤" },
  { key: "events", label: "سجل المزامنة", icon: "📋" },
  { key: "settings", label: "إعدادات POS", icon: "⚙️" },
  { key: "mapping", label: "ربط الأصناف", icon: "🔗" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "معلّق" },
  claimed: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "قيد المعالجة" },
  synced: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "تمت المزامنة" },
  failed: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", label: "فشل" },
  skipped: { bg: "bg-neutral-100 border-neutral-200", text: "text-neutral-500", label: "تم تخطيه" },
  success: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "نجاح" },
  timeout: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "انتهى الوقت" },
};

const OP_TYPE_LABEL: Record<string, string> = {
  create_delivery_invoice: "إنشاء فاتورة توصيل",
  update_delivery_status: "تحديث حالة التوصيل",
  assign_driver: "تعيين سائق",
  settle_driver_cash: "تسوية كاش السائق",
  cancel_delivery_invoice: "إلغاء فاتورة توصيل",
  open_table: "فتح طاولة",
  add_table_items: "إضافة أصناف للطاولة",
  close_table_sync: "إغلاق طاولة",
  generic: "عام",
};

const POS_KIND_LABEL: Record<string, string> = {
  rzrz: "RzRz",
  foodics: "Foodics",
  marn: "Marn",
  loyverse: "Loyverse",
  other: "أخرى",
  none: "بدون",
};

function redactPhone(phone: string | undefined | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return digits.slice(0, 3) + "***" + digits.slice(-2);
}

function redactPayload(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!payload) return null;
  const safe = { ...payload };
  if (typeof safe.phone === "string") safe.phone = redactPhone(safe.phone);
  if (typeof safe.address === "string") safe.address = "***";
  if (typeof safe.name === "string") safe.name = "***";
  return safe;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${Math.floor(hours / 24)} يوم`;
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_PILL[status] ?? STATUS_PILL.pending;
  return (
    <span className={`inline-block text-[10px] font-semibold border rounded-full px-2 py-0.5 ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export default function PosDashboard({
  restaurantId,
  outbox: initialOutbox,
  syncEvents: initialSyncEvents,
  posSettings,
  itemMap,
  menuItems,
  branches,
  posCatalog,
}: Props) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [outbox, setOutbox] = useState<OutboxRow[]>(initialOutbox);
  const [syncEvents, setSyncEvents] = useState<SyncEventRow[]>(initialSyncEvents);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [localItemMap] = useState<ItemMapRow[]>(itemMap);
  const [branchFilter, setBranchFilter] = useState("all");

  // Realtime subscription on pos_outbox
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`pos_outbox:${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pos_outbox", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          setOutbox((prev) => [payload.new as OutboxRow, ...prev].slice(0, 200));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pos_outbox", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          setOutbox((prev) => prev.map((r) => (r.id === (payload.new as OutboxRow).id ? { ...r, ...(payload.new as OutboxRow) } : r)));
        }
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [restaurantId]);

  // Overview stats
  const stats = useMemo(() => {
    const synced = outbox.filter((r) => r.status === "synced").length;
    const failed = outbox.filter((r) => r.status === "failed").length;
    const pending = outbox.filter((r) => r.status === "pending").length;
    const claimed = outbox.filter((r) => r.status === "claimed").length;
    const total = synced + failed;
    const successRate = total > 0 ? (synced / total) * 100 : 0;

    const durations = syncEvents.filter((e) => e.duration_ms).map((e) => e.duration_ms!);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const timestamps = [
      ...outbox.filter((r) => r.claimed_at).map((r) => new Date(r.claimed_at!).getTime()),
      ...outbox.filter((r) => r.synced_at).map((r) => new Date(r.synced_at!).getTime()),
    ];
    const lastActivity = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
    const oldestPending = outbox
      .filter((r) => r.status === "pending")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

    let health: "active" | "idle" | "stale" = "idle";
    if (pending === 0 && lastActivity) health = "idle";
    if (lastActivity && Date.now() - new Date(lastActivity).getTime() < 5 * 60 * 1000) health = "active";
    if (oldestPending && Date.now() - new Date(oldestPending.created_at).getTime() > 5 * 60 * 1000 && (!lastActivity || Date.now() - new Date(lastActivity).getTime() > 5 * 60 * 1000)) health = "stale";
    if (outbox.length === 0) health = "idle";

    const recentFailures = outbox.filter((r) => r.status === "failed").slice(0, 5);

    return { synced, failed, pending, claimed, successRate, avgDuration, lastActivity, health, recentFailures };
  }, [outbox, syncEvents]);

  const filteredOutbox = useMemo(() => {
    let filtered = outbox;
    if (statusFilter !== "all") filtered = filtered.filter((r) => r.status === statusFilter);
    if (branchFilter !== "all") filtered = filtered.filter((r) => r.branch_id === branchFilter);
    return filtered;
  }, [outbox, statusFilter, branchFilter]);

  const mappedIds = new Set(localItemMap.map((m) => m.menu_item_id));
  const unmapped = menuItems.filter((mi) => !mappedIds.has(mi.id));

  async function refreshSyncEvents() {
    const sb = createClient();
    const { data } = await sb
      .from("pos_sync_events")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setSyncEvents(data as SyncEventRow[]);
  }

  const healthConfig = {
    active: { bg: "bg-green-50 border-green-200", text: "text-green-700", icon: "🟢", label: "نشط" },
    idle: { bg: "bg-neutral-50 border-neutral-200", text: "text-neutral-600", icon: "⚪", label: "خامل" },
    stale: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", icon: "🔴", label: "متأخر — قد يكون Bridge غير متصل" },
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "shrink-0 h-9 px-3 rounded-lg text-xs font-semibold transition-colors " +
              (tab === t.key
                ? "bg-brand-primary text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")
            }
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ OVERVIEW ═══════════════ */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="تمت المزامنة" value={String(stats.synced)} color="green" />
            <KpiCard label="فشل" value={String(stats.failed)} color="rose" />
            <KpiCard label="معلّق" value={String(stats.pending)} color="amber" />
            <KpiCard label="قيد المعالجة" value={String(stats.claimed)} color="blue" />
            <KpiCard label="نسبة النجاح" value={stats.synced + stats.failed > 0 ? `${stats.successRate.toFixed(0)}%` : "—"} color="emerald" />
            <KpiCard label="متوسط المدة" value={stats.avgDuration > 0 ? `${stats.avgDuration.toFixed(0)}ms` : "—"} color="purple" />
          </div>

          {/* Sync activity banner */}
          <div className={`border rounded-xl p-4 flex items-center gap-3 ${healthConfig[stats.health].bg}`}>
            <span className="text-2xl">{healthConfig[stats.health].icon}</span>
            <div className="flex-1">
              <div className={`text-sm font-bold ${healthConfig[stats.health].text}`}>
                آخر نشاط مزامنة: {healthConfig[stats.health].label}
              </div>
              {stats.lastActivity && (
                <div className="text-xs text-neutral-500 mt-0.5">
                  {timeAgo(stats.lastActivity)} — {new Date(stats.lastActivity).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                </div>
              )}
              {!stats.lastActivity && outbox.length === 0 && (
                <div className="text-xs text-neutral-500 mt-0.5">لا توجد طلبات في صندوق الصادر بعد</div>
              )}
            </div>
          </div>

          {/* Recent failures */}
          {stats.recentFailures.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3 text-rose-700">❌ آخر الأخطاء</h3>
              <div className="space-y-2">
                {stats.recentFailures.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 text-xs bg-rose-50 border border-rose-200 rounded-lg p-2">
                    <span className="font-mono text-neutral-400 shrink-0" dir="ltr">#{r.order_id.slice(0, 8)}</span>
                    <span className="text-rose-700 flex-1 truncate">{r.last_error || "خطأ غير محدد"}</span>
                    <span className="text-neutral-400 shrink-0">{timeAgo(r.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ OUTBOX ═══════════════ */}
      {tab === "outbox" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-brand-primary"
            >
              <option value="all">كل الحالات</option>
              <option value="pending">معلّق</option>
              <option value="claimed">قيد المعالجة</option>
              <option value="synced">تمت المزامنة</option>
              <option value="failed">فشل</option>
              <option value="skipped">تم تخطيه</option>
            </select>
            {branches.length > 1 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-9 px-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-brand-primary"
              >
                <option value="all">كل الفروع</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name_ar}</option>
                ))}
              </select>
            )}
            <span className="text-xs text-neutral-500 self-center">{filteredOutbox.length} سجل</span>
          </div>

          {filteredOutbox.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
              <div className="text-3xl mb-2">📤</div>
              <p className="text-sm text-neutral-600">لا توجد سجلات في صندوق الصادر.</p>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-400 border-b border-neutral-100">
                      <th className="text-right py-2 px-3 font-medium">الطلب</th>
                      <th className="text-center py-2 px-2 font-medium">الحالة</th>
                      <th className="text-center py-2 px-2 font-medium">فاتورة POS</th>
                      <th className="text-center py-2 px-2 font-medium">المحاولات</th>
                      <th className="text-right py-2 px-3 font-medium">آخر خطأ</th>
                      <th className="text-right py-2 px-3 font-medium">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOutbox.map((r) => (
                      <>
                        <tr
                          key={r.id}
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          className="border-b border-neutral-50 hover:bg-neutral-50 cursor-pointer"
                        >
                          <td className="py-2 px-3 font-mono" dir="ltr">#{r.order_id.slice(0, 8)}</td>
                          <td className="py-2 px-2 text-center"><StatusPill status={r.status} /></td>
                          <td className="py-2 px-2 text-center font-mono" dir="ltr">{r.pos_invoice_no ?? "—"}</td>
                          <td className="py-2 px-2 text-center">{r.attempts}</td>
                          <td className="py-2 px-3 text-right text-neutral-500 max-w-[200px] truncate" title={r.last_error ?? ""}>
                            {r.last_error ? r.last_error.slice(0, 60) : "—"}
                          </td>
                          <td className="py-2 px-3 text-right text-neutral-400">{timeAgo(r.created_at)}</td>
                        </tr>
                        {expandedId === r.id && (
                          <tr key={`${r.id}-detail`}>
                            <td colSpan={6} className="bg-neutral-50 px-4 py-3">
                              <div className="space-y-2 text-xs">
                                <div className="grid grid-cols-2 gap-2">
                                  <div><span className="text-neutral-400">Order ID:</span> <span className="font-mono" dir="ltr">{r.order_id}</span></div>
                                  <div><span className="text-neutral-400">Bridge:</span> {r.claimed_by || "—"}</div>
                                  <div><span className="text-neutral-400">Claimed:</span> {r.claimed_at ? new Date(r.claimed_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" }) : "—"}</div>
                                  <div><span className="text-neutral-400">Synced:</span> {r.synced_at ? new Date(r.synced_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" }) : "—"}</div>
                                  <div><span className="text-neutral-400">POS Invoice ID:</span> <span className="font-mono" dir="ltr">{r.pos_invoice_id || "—"}</span></div>
                                  <div><span className="text-neutral-400">Operation:</span> {OP_TYPE_LABEL[r.operation_type ?? ""] ?? r.operation_type ?? "—"}</div>
                                </div>
                                {r.last_error && (
                                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-rose-700">{r.last_error}</div>
                                )}
                                {r.payload && (
                                  <details>
                                    <summary className="cursor-pointer text-neutral-400 hover:text-neutral-600">عرض البيانات (مخفية البيانات الشخصية)</summary>
                                    <pre className="mt-1 bg-white border border-neutral-200 rounded-lg p-2 overflow-x-auto text-[10px] max-h-48" dir="ltr">
                                      {JSON.stringify(redactPayload(r.payload), null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ SYNC EVENTS ═══════════════ */}
      {tab === "events" && (
        <div className="space-y-3">
          <button
            onClick={refreshSyncEvents}
            className="h-9 px-4 rounded-lg bg-neutral-100 text-xs font-semibold hover:bg-neutral-200"
          >
            🔄 تحديث
          </button>

          {syncEvents.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm text-neutral-600">لا توجد سجلات مزامنة بعد.</p>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-400 border-b border-neutral-100">
                      <th className="text-right py-2 px-3 font-medium">الطلب</th>
                      <th className="text-center py-2 px-2 font-medium">المزود</th>
                      <th className="text-right py-2 px-2 font-medium">العملية</th>
                      <th className="text-center py-2 px-2 font-medium">الحالة</th>
                      <th className="text-center py-2 px-2 font-medium">المدة</th>
                      <th className="text-right py-2 px-3 font-medium">الخطأ</th>
                      <th className="text-right py-2 px-3 font-medium">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncEvents.map((e) => (
                      <tr key={e.id} className="border-b border-neutral-50">
                        <td className="py-2 px-3 font-mono" dir="ltr">{e.order_id ? `#${e.order_id.slice(0, 8)}` : "—"}</td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                            {POS_KIND_LABEL[e.provider] ?? e.provider}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">{OP_TYPE_LABEL[e.operation_type] ?? e.operation_type}</td>
                        <td className="py-2 px-2 text-center"><StatusPill status={e.status} /></td>
                        <td className="py-2 px-2 text-center font-mono" dir="ltr">{e.duration_ms != null ? `${e.duration_ms}ms` : "—"}</td>
                        <td className="py-2 px-3 text-right text-neutral-500 max-w-[200px] truncate" title={e.error_message ?? ""}>
                          {e.error_message ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-right text-neutral-400">{timeAgo(e.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ SETTINGS ═══════════════ */}
      {tab === "settings" && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          {!posSettings ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">⚙️</div>
              <p className="text-sm text-neutral-600">لم يتم تهيئة إعدادات نقاط البيع بعد.</p>
              <p className="text-xs text-neutral-400 mt-1">تواصل مع فريق الدعم لتهيئة الربط.</p>
            </div>
          ) : (
            <dl className="space-y-3">
              <SettingsRow label="نوع POS" value={POS_KIND_LABEL[posSettings.pos_kind] ?? posSettings.pos_kind} />
              <SettingsRow
                label="الحالة"
                value={posSettings.enabled ? "✅ مفعّل" : "❌ معطّل"}
              />
              <SettingsRow label="POS Branch ID" value={posSettings.pos_branch_id?.toString() ?? "—"} mono />
              <SettingsRow label="Online Customer ID" value={posSettings.online_customer_id?.toString() ?? "—"} mono />
              <SettingsRow label="Counter ID" value={posSettings.counter_id?.toString() ?? "—"} mono />
              <SettingsRow label="Invoice Type" value={posSettings.invoice_type?.toString() ?? "—"} mono />
              <SettingsRow label="الضريبة" value={`${posSettings.tax_percent}% ${posSettings.is_tax_inclusive ? "(شامل)" : "(غير شامل)"}`} />
              <SettingsRow label="Default User ID" value={posSettings.default_user_id?.toString() ?? "—"} mono />
              {posSettings.notes && <SettingsRow label="ملاحظات" value={posSettings.notes} />}
            </dl>
          )}
        </div>
      )}

      {/* ═══════════════ ITEM MAPPING ═══════════════ */}
      {tab === "mapping" && (
        <MappingTab
          itemMap={localItemMap}
          menuItems={menuItems}
          posCatalog={posCatalog}
          unmapped={unmapped}
        />
      )}
    </div>
  );
}

function MappingTab({
  itemMap,
  menuItems,
  posCatalog,
  unmapped,
}: {
  itemMap: ItemMapRow[];
  menuItems: { id: string; name_ar: string; is_active: boolean }[];
  posCatalog: PosCatalogRow[];
  unmapped: { id: string; name_ar: string }[];
}) {
  const catalogMap = new Map(posCatalog.map((c) => [c.pos_item_id, c]));
  const mappedPosIds = new Set(itemMap.map((m) => m.pos_item_id));
  const orphanPosItems = posCatalog.filter((c) => !mappedPosIds.has(c.pos_item_id) && c.is_active);

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold">ربط الأصناف</span>
          <span className="text-xs text-neutral-500">
            {itemMap.length} من {menuItems.length} صنف مربوط
          </span>
        </div>
        <div className="h-3 rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-primary/70"
            style={{ width: `${menuItems.length > 0 ? (itemMap.length / menuItems.length) * 100 : 0}%` }}
          />
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-neutral-400">
          <span>✅ مربوط: {itemMap.length}</span>
          <span>⚠️ غير مربوط: {unmapped.length}</span>
          {orphanPosItems.length > 0 && <span>🔍 أصناف POS بدون ربط: {orphanPosItems.length}</span>}
        </div>
      </div>

      {/* Mapped items */}
      {itemMap.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">✅ أصناف مربوطة ({itemMap.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-100">
                  <th className="text-right py-2 font-medium">صنف MenuLink</th>
                  <th className="text-right py-2 font-medium">اسم POS</th>
                  <th className="text-center py-2 font-medium w-20">POS ID</th>
                  <th className="text-center py-2 font-medium w-20">Variant</th>
                  <th className="text-center py-2 font-medium w-16">المطابقة</th>
                </tr>
              </thead>
              <tbody>
                {itemMap.map((m) => {
                  const mi = menuItems.find((i) => i.id === m.menu_item_id);
                  const cat = catalogMap.get(m.pos_item_id);
                  const posName = m.pos_item_name ?? cat?.pos_item_name ?? null;
                  const menuName = mi?.name_ar ?? "";
                  const hasMatch = posName != null;
                  return (
                    <tr key={`${m.menu_item_id}-${m.pos_variant_key}`} className="border-b border-neutral-50 last:border-0">
                      <td className="py-2 text-right font-semibold text-neutral-800">{menuName || m.menu_item_id.slice(0, 8)}</td>
                      <td className="py-2 text-right text-neutral-500">{posName ?? "—"}</td>
                      <td className="py-2 text-center font-mono text-neutral-600" dir="ltr">{m.pos_item_id}</td>
                      <td className="py-2 text-center font-mono text-neutral-400" dir="ltr">{m.pos_variant_key ?? "—"}</td>
                      <td className="py-2 text-center">
                        {hasMatch ? (
                          <span className="inline-block w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] leading-5 text-center">✓</span>
                        ) : (
                          <span className="inline-block w-5 h-5 rounded-full bg-neutral-100 text-neutral-400 text-[10px] leading-5 text-center">?</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmapped MenuLink items */}
      {unmapped.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3 text-amber-700">⚠️ أصناف MenuLink غير مربوطة ({unmapped.length})</h3>
          <div className="space-y-1">
            {unmapped.map((mi) => (
              <div key={mi.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-neutral-50 last:border-0">
                <span className="text-amber-500">●</span>
                <span className="text-neutral-700 flex-1 min-w-0 truncate">{mi.name_ar}</span>
                <span className="text-[10px] text-neutral-400 bg-neutral-50 rounded-full px-2 py-0.5">لم يتم تعيين POS ID</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-neutral-400 mt-3">
            تواصل مع فريق الدعم لربط الأصناف المتبقية. الطلبات التي تحتوي على أصناف غير مربوطة لن تُرسل للمطبخ بشكل صحيح.
          </p>
        </div>
      )}

      {/* Orphan POS items (in POS catalog but not mapped to any MenuLink item) */}
      {orphanPosItems.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3 text-blue-700">🔍 أصناف POS بدون ربط بـ MenuLink ({orphanPosItems.length})</h3>
          <p className="text-[10px] text-neutral-400 mb-3">
            هذه الأصناف موجودة في نظام نقاط البيع لكن ليس لها مقابل في قائمة MenuLink.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-100">
                  <th className="text-center py-2 font-medium w-20">POS ID</th>
                  <th className="text-right py-2 font-medium">اسم POS</th>
                  <th className="text-right py-2 font-medium w-20">التصنيف</th>
                  <th className="text-center py-2 font-medium w-20">السعر</th>
                </tr>
              </thead>
              <tbody>
                {orphanPosItems.map((c) => (
                  <tr key={c.pos_item_id} className="border-b border-neutral-50 last:border-0">
                    <td className="py-1.5 text-center font-mono" dir="ltr">{c.pos_item_id}</td>
                    <td className="py-1.5 text-right text-neutral-700">{c.pos_item_name ?? "—"}</td>
                    <td className="py-1.5 text-right text-neutral-400">{c.pos_category ?? "—"}</td>
                    <td className="py-1.5 text-center font-mono" dir="ltr">{c.price != null ? `${c.price}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {posCatalog.length === 0 && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-center">
          <p className="text-xs text-neutral-500">
            📋 لم يتم استيراد قائمة أصناف POS بعد. عند تشغيل Bridge App مع خاصية المزامنة، ستظهر الأصناف هنا تلقائياً.
          </p>
        </div>
      )}

      {itemMap.length === 0 && unmapped.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">🔗</div>
          <p className="text-sm text-neutral-600">لا توجد أصناف في القائمة.</p>
        </div>
      )}
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
};

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl px-3 py-3 text-center`}>
      <div className={`text-xl font-bold ${c.text}`}>{value}</div>
      <div className="text-[10px] text-neutral-500 font-semibold mt-0.5">{label}</div>
    </div>
  );
}

function SettingsRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={`text-xs font-semibold text-neutral-800 ${mono ? "font-mono" : ""}`} dir={mono ? "ltr" : undefined}>{value}</dd>
    </div>
  );
}
