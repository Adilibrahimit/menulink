"use client";

import { useMemo, useState } from "react";

type Row = {
  customer_id: string;
  name: string | null;
  phone: string;
  segment: string | null;
  frequency: number;
  monetary: number;
  recency_days: number | null;
  avg_order_value: number | null;
  lifetime_value: number;
  first_order_at: string | null;
  last_order_at: string | null;
};

type SortKey = "monetary_desc" | "monetary_asc" | "frequency_desc" | "recency_asc" | "recency_desc" | "new_first" | "old_first";

const SORT_LABEL: Record<SortKey, string> = {
  monetary_desc: "الأعلى إنفاقاً → الأقل",
  monetary_asc:  "الأقل إنفاقاً → الأعلى",
  frequency_desc:"الأكثر طلبات → الأقل",
  recency_asc:   "الأحدث طلباً أولاً",
  recency_desc:  "الأقدم طلباً أولاً",
  new_first:     "العملاء الجدد أولاً",
  old_first:     "العملاء الأقدم أولاً",
};

const SEG_STYLE: Record<string, string> = {
  Champion: "bg-amber-100 text-amber-900 border-amber-300",
  Loyal:    "bg-green-100 text-green-900 border-green-300",
  New:      "bg-sky-100 text-sky-900 border-sky-300",
  "At-Risk":"bg-orange-100 text-orange-900 border-orange-300",
  Lost:     "bg-rose-100 text-rose-900 border-rose-300",
  Prospect: "bg-neutral-100 text-neutral-700 border-neutral-300",
};

function digitsOnly(s: string): string {
  return s.replace(/[^\d]/g, "");
}

export default function CustomersTable({
  rows,
  excelEnabled,
  pushEnabled = false,
  restaurantId = "",
}: {
  rows: Row[];
  excelEnabled: boolean;
  pushEnabled?: boolean;
  restaurantId?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("monetary_desc");
  const [segFilter, setSegFilter] = useState<string>("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const visible = useMemo(() => {
    let r = rows;
    if (segFilter) r = r.filter((x) => x.segment === segFilter);
    if (query.trim()) {
      const q = query.trim();
      const qDigits = digitsOnly(q);
      r = r.filter((x) => {
        const name = (x.name ?? "").toLowerCase();
        if (name.includes(q.toLowerCase())) return true;
        if (qDigits && digitsOnly(x.phone).includes(qDigits)) return true;
        return false;
      });
    }
    const sorted = [...r];
    sorted.sort((a, b) => {
      switch (sort) {
        case "monetary_desc":   return (b.monetary || 0) - (a.monetary || 0);
        case "monetary_asc":    return (a.monetary || 0) - (b.monetary || 0);
        case "frequency_desc":  return (b.frequency || 0) - (a.frequency || 0);
        case "recency_asc":     return (a.recency_days ?? 1e9) - (b.recency_days ?? 1e9);
        case "recency_desc":    return (b.recency_days ?? -1) - (a.recency_days ?? -1);
        case "new_first":       return new Date(b.first_order_at ?? 0).getTime() - new Date(a.first_order_at ?? 0).getTime();
        case "old_first":       return new Date(a.first_order_at ?? "9999").getTime() - new Date(b.first_order_at ?? "9999").getTime();
      }
    });
    return sorted;
  }, [rows, query, sort, segFilter]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم أو الجوال…"
          className="flex-1 min-w-[180px] h-9 px-3 rounded-lg border border-neutral-200 outline-none focus:border-brand-primary text-sm"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 px-2 rounded-lg border border-neutral-200 outline-none focus:border-brand-primary text-sm bg-white"
        >
          {Object.entries(SORT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={segFilter}
          onChange={(e) => setSegFilter(e.target.value)}
          className="h-9 px-2 rounded-lg border border-neutral-200 outline-none focus:border-brand-primary text-sm bg-white"
        >
          <option value="">كل الشرائح</option>
          {Object.keys(SEG_STYLE).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          {visible.length} من {rows.length}
        </span>
        <div className="flex-1" />
        {pushEnabled && (
          <button
            onClick={() => setBroadcastOpen(true)}
            className="px-3 h-9 inline-flex items-center rounded-lg bg-blue-600 text-white text-sm font-semibold hover:opacity-90"
          >
            🔔 إرسال إشعار {segFilter ? `(${segFilter})` : ""}
          </button>
        )}
        {excelEnabled && (
          <a
            href="/api/admin/export/customers"
            className="px-3 h-9 inline-flex items-center rounded-lg bg-[#1B4332] text-white text-sm font-semibold hover:opacity-90"
          >
            📊 تنزيل Excel
          </a>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <Th>العميل</Th>
              <Th>الجوال</Th>
              <Th>الشريحة</Th>
              <Th>طلبات</Th>
              <Th>إجمالي</Th>
              <Th>متوسط</Th>
              <Th>آخر طلب</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visible.map((r) => (
              <tr key={r.customer_id} className="hover:bg-neutral-50">
                <Td>{r.name ?? "—"}</Td>
                <Td>
                  <a
                    className="text-brand-primary hover:underline"
                    href={`https://wa.me/${r.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.phone}
                  </a>
                </Td>
                <Td>
                  {r.segment && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${SEG_STYLE[r.segment] ?? "bg-neutral-100 border-neutral-200"}`}
                    >
                      {r.segment}
                    </span>
                  )}
                </Td>
                <Td>{r.frequency}</Td>
                <Td>{Number(r.monetary).toFixed(2)} ر.س</Td>
                <Td>{r.avg_order_value != null ? `${Number(r.avg_order_value).toFixed(2)} ر.س` : "—"}</Td>
                <Td>{r.recency_days != null ? `قبل ${r.recency_days} يوم` : "—"}</Td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-neutral-500">
                  {rows.length === 0 ? "لا يوجد عملاء بعد." : "لا توجد نتائج مطابقة."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {broadcastOpen && (
        <BroadcastModal
          restaurantId={restaurantId}
          segment={segFilter || null}
          customerCount={visible.length}
          onClose={() => setBroadcastOpen(false)}
        />
      )}
    </div>
  );
}

function BroadcastModal({
  restaurantId,
  segment,
  customerCount,
  onClose,
}: {
  restaurantId: string;
  segment: string | null;
  customerCount: number;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  async function send() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    const res = await fetch("/api/admin/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        title: title.trim(),
        body: body.trim(),
        segments: segment ? [segment] : [],
      }),
    });
    const data = await res.json();
    setSending(false);
    if (data.ok) setResult({ sent: data.sent, failed: data.failed });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
          🔔 إرسال إشعار Push
        </h2>
        <p className="text-xs text-neutral-500">
          {segment ? `الشريحة: ${segment} · ` : "كل العملاء · "}
          {customerCount} عميل
        </p>

        {result ? (
          <div className="text-center space-y-3 py-4">
            <div className="text-4xl">✅</div>
            <p className="text-sm font-bold text-green-800">
              تم الإرسال: {result.sent} · فشل: {result.failed}
            </p>
            <button
              onClick={onClose}
              className="h-10 px-6 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-bold hover:bg-neutral-200"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان الإشعار"
                maxLength={60}
                className="w-full h-10 px-3 rounded-lg border border-neutral-200 outline-none focus:border-blue-400 text-sm"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="نص الرسالة…"
                maxLength={200}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 outline-none focus:border-blue-400 text-sm resize-none"
              />
            </div>
            {title.trim() && body.trim() && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                <p className="text-[11px] text-neutral-400 mb-1">معاينة</p>
                <p className="text-sm font-bold text-neutral-900">{title}</p>
                <p className="text-xs text-neutral-600 mt-0.5">{body}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={send}
                disabled={sending || !title.trim() || !body.trim()}
                className="flex-1 h-11 rounded-xl bg-blue-600 text-white font-extrabold disabled:opacity-50 active:translate-y-px"
                style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
              >
                {sending ? "جاري الإرسال..." : "إرسال"}
              </button>
              <button
                onClick={onClose}
                disabled={sending}
                className="h-11 px-4 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-bold hover:bg-neutral-200"
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-right px-3 py-2 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
