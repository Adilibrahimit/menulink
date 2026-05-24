"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { toArabicDigits } from "@/lib/arabic";
import SarSymbol from "./sar-symbol";

type SessionOrder = {
  id: string;
  status: string;
  total: number;
  notes: string | null;
  created_at: string;
  items: { item_name: string; variant: string | null; qty: number; unit_price: number; line_total: number }[];
};

type SessionData = {
  id: string;
  restaurant_id: string;
  table_label: string;
  status: "open" | "checkout_requested" | "closed";
  customer_name: string | null;
  customer_phone: string | null;
  opened_at: string;
  closed_at: string | null;
  orders: SessionOrder[];
};

export default function TableSessionBar({
  sessionId,
  restaurantName,
  whatsappPhone,
  tableLabel,
  onNewRound,
}: {
  sessionId: string;
  restaurantName: string;
  whatsappPhone: string;
  tableLabel: string;
  onNewRound: () => void;
}) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchSession = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.rpc("get_table_session", { p_session_id: sessionId });
    if (data) setSession(data as SessionData);
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (!session || session.orders.length === 0) return null;

  const grandTotal = session.orders.reduce((sum, o) => sum + Number(o.total), 0);
  const allItems = session.orders.flatMap((o) => o.items);
  const roundCount = session.orders.length;
  const isCheckoutRequested = session.status === "checkout_requested" || checkoutDone;

  async function requestCheckout() {
    setLoading(true);
    const sb = createClient();
    await sb.rpc("request_table_checkout", { p_session_id: sessionId });

    const itemList = allItems
      .map((it, i) => {
        const v = it.variant ? ` (${it.variant})` : "";
        return `${toArabicDigits(String(i + 1))}. ${it.item_name}${v}  ×${toArabicDigits(String(it.qty))}  =  ${toArabicDigits(String(it.line_total))} ر.س`;
      })
      .join("\n");

    const msg =
      `🧾 *طلب حساب · ${restaurantName}* 🧾\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🪑 *الطاولة:* ${tableLabel}\n` +
      `📋 *عدد الجولات:* ${toArabicDigits(String(roundCount))}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🛒 *جميع الطلبات:*\n${itemList}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 *المجموع الكلي: ${toArabicDigits(String(grandTotal))} ر.س*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `العميل يطلب الحساب 🙏`;

    const waNumber = String(whatsappPhone).replace(/\D/g, "");
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");

    setCheckoutDone(true);
    setLoading(false);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 safe-area-bottom" dir="rtl">
      <div className="mx-auto max-w-lg">
        <div className="bg-white border-t-2 border-amber-400 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] rounded-t-2xl overflow-hidden">
          {/* Header bar — always visible */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🪑</span>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-900">
                  طاولة {tableLabel} · {isCheckoutRequested ? "تم طلب الحساب ✓" : "جلسة مفتوحة"}
                </p>
                <p className="text-[11px] text-amber-700">
                  {toArabicDigits(String(roundCount))} {roundCount === 1 ? "طلب" : "طلبات"} · {toArabicDigits(String(allItems.length))} صنف
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-amber-900">
                {toArabicDigits(String(grandTotal))} <SarSymbol className="inline w-3.5 h-3.5" />
              </span>
              <span className="text-neutral-400 text-xs">{expanded ? "▼" : "▲"}</span>
            </div>
          </button>

          {/* Expanded: item list + actions */}
          {expanded && (
            <div className="max-h-[50vh] overflow-y-auto">
              <div className="px-4 py-2 space-y-2">
                {session.orders.map((order, ri) => (
                  <div key={order.id}>
                    <p className="text-[10px] font-bold text-neutral-400 mt-2">
                      الجولة {toArabicDigits(String(ri + 1))}
                    </p>
                    {order.items.map((it, ii) => (
                      <div key={ii} className="flex items-center justify-between py-1 text-xs border-b border-neutral-50">
                        <div className="flex-1">
                          <span className="font-medium">{it.item_name}</span>
                          {it.variant && <span className="text-neutral-500 mr-1">({it.variant})</span>}
                          <span className="text-neutral-400 mr-1">×{toArabicDigits(String(it.qty))}</span>
                        </div>
                        <span className="font-semibold">{toArabicDigits(String(it.line_total))} ر.س</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="px-4 py-3 flex items-center gap-2 border-t border-neutral-100">
                {!isCheckoutRequested ? (
                  <>
                    <button
                      onClick={onNewRound}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                    >
                      + أضف المزيد
                    </button>
                    <button
                      onClick={requestCheckout}
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ backgroundColor: "var(--brand)" }}
                    >
                      {loading ? "جاري..." : "🧾 طلب الحساب"}
                    </button>
                  </>
                ) : (
                  <div className="w-full text-center py-2">
                    <p className="text-sm font-bold text-green-700">✓ تم طلب الحساب</p>
                    <p className="text-[11px] text-neutral-500">سيتم خدمتك قريباً</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
