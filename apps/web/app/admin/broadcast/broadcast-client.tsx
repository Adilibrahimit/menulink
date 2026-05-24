"use client";

import { useState } from "react";

type Broadcast = {
  id: string;
  title: string;
  body: string;
  segment_filter: string[];
  recipient_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
};

const SEGMENTS = ["Champion", "Loyal", "New", "At-Risk", "Lost"];

const SEG_STYLE: Record<string, string> = {
  Champion: "bg-amber-100 text-amber-900 border-amber-300",
  Loyal: "bg-green-100 text-green-900 border-green-300",
  New: "bg-sky-100 text-sky-900 border-sky-300",
  "At-Risk": "bg-orange-100 text-orange-900 border-orange-300",
  Lost: "bg-rose-100 text-rose-900 border-rose-300",
};

export default function BroadcastClient({
  restaurantId,
  history: initialHistory,
  subscriberCount,
}: {
  restaurantId: string;
  history: Broadcast[];
  subscriberCount: number;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedSegs, setSelectedSegs] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [history, setHistory] = useState(initialHistory);

  function toggleSeg(s: string) {
    setSelectedSegs((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function send() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    const res = await fetch("/api/admin/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        title: title.trim(),
        body: body.trim(),
        segments: Array.from(selectedSegs),
      }),
    });
    const data = await res.json();
    setSending(false);
    if (data.ok) {
      setResult({ sent: data.sent, failed: data.failed });
      setHistory((h) => [
        {
          id: crypto.randomUUID(),
          title: title.trim(),
          body: body.trim(),
          segment_filter: Array.from(selectedSegs),
          recipient_count: data.sent + data.failed,
          delivered_count: data.sent,
          failed_count: data.failed,
          created_at: new Date().toISOString(),
        },
        ...h,
      ]);
      setTitle("");
      setBody("");
      setSelectedSegs(new Set());
    }
  }

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-bold text-neutral-700">إرسال إشعار جديد</h2>

        <div className="flex flex-wrap gap-2">
          {SEGMENTS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSeg(s)}
              className={`text-xs px-3 py-1.5 rounded-full border-2 font-bold transition-all ${
                selectedSegs.has(s)
                  ? SEG_STYLE[s]
                  : "bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="text-[11px] text-neutral-400 self-center">
            {selectedSegs.size === 0 ? "كل العملاء" : `${selectedSegs.size} شرائح محددة`}
          </span>
        </div>

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

        {title.trim() && body.trim() && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
            <p className="text-[11px] text-neutral-400 mb-1">معاينة</p>
            <p className="text-sm font-bold text-neutral-900">{title}</p>
            <p className="text-xs text-neutral-600 mt-0.5">{body}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800 font-bold">
            ✅ تم الإرسال: {result.sent} · فشل: {result.failed}
          </div>
        )}

        <button
          onClick={send}
          disabled={sending || !title.trim() || !body.trim()}
          className="h-11 px-6 rounded-xl bg-blue-600 text-white font-extrabold disabled:opacity-50 active:translate-y-px"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          {sending ? "جاري الإرسال..." : "🔔 إرسال"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="مشتركين" value={String(subscriberCount)} />
        <StatCard label="إشعارات مرسلة" value={String(history.length)} />
        <StatCard
          label="آخر إرسال"
          value={
            history.length > 0
              ? new Date(history[0].created_at).toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh" })
              : "—"
          }
        />
      </div>

      {/* History */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-neutral-700">سجل الإرسال</h2>
        {history.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-sm text-neutral-500">لم ترسل أي إشعارات بعد.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((b) => (
              <li key={b.id} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-lg shrink-0">
                  🔔
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-neutral-900">{b.title}</div>
                  <div className="text-xs text-neutral-600 mt-0.5">{b.body}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {b.segment_filter.length > 0 ? (
                      b.segment_filter.map((s) => (
                        <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${SEG_STYLE[s] ?? "bg-neutral-100"}`}>
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-neutral-100 border-neutral-200">الكل</span>
                    )}
                  </div>
                </div>
                <div className="text-left shrink-0 text-[11px] text-neutral-500 space-y-0.5">
                  <div>✅ {b.delivered_count}</div>
                  {b.failed_count > 0 && <div className="text-rose-500">❌ {b.failed_count}</div>}
                  <div>{new Date(b.created_at).toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh" })}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-extrabold text-neutral-900 mt-1">{value}</div>
    </div>
  );
}
