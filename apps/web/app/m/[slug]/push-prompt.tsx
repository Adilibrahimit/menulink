"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "menulink_push_dismiss";
const COOLDOWN_DAYS = 14;

export default function PushPrompt({
  restaurantId,
  customerId,
  vapidKey,
  enabled,
}: {
  restaurantId: string;
  customerId: string | null;
  vapidKey: string;
  enabled: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!enabled || !vapidKey) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted" || Notification.permission === "denied") return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const diff = Date.now() - Number(dismissed);
      if (diff < COOLDOWN_DAYS * 86400000) return;
    }

    const timer = setTimeout(() => setShow(true), 15000);
    return () => clearTimeout(timer);
  }, [enabled, vapidKey]);

  async function accept() {
    setShow(false);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          customer_id: customerId,
          subscription: {
            endpoint: json.endpoint,
            keys: json.keys,
          },
        }),
      });
    } catch (err) {
      console.error("[push] subscribe failed:", err);
    }
  }

  function dismiss() {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 inset-x-0 z-40 flex justify-center px-4" dir="rtl">
      <div className="bg-white border-2 border-neutral-200 rounded-2xl shadow-xl p-4 max-w-sm w-full flex items-start gap-3">
        <span className="text-2xl mt-0.5">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
            فعّل الإشعارات
          </p>
          <p className="text-xs text-neutral-600 mt-0.5 leading-snug">
            نرسلك عروض حصرية وتنبيه لما طلبك يجهز
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={accept}
              className="h-8 px-4 rounded-xl bg-[var(--brand)] text-white text-xs font-extrabold hover:opacity-90 active:translate-y-px"
              style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
            >
              فعّل
            </button>
            <button
              onClick={dismiss}
              className="h-8 px-3 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold hover:bg-neutral-200"
            >
              لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
