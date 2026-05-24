"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

export default function PushToggle({
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
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!enabled || !vapidKey) { setStatus("unsupported"); return; }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setStatus("denied"); return; }
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => {
          setStatus(sub ? "on" : "off");
        })
      );
    } else {
      setStatus("off");
    }
  }, [enabled, vapidKey]);

  async function toggle() {
    if (status === "on") {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        setStatus("off");
      }
      return;
    }

    if (status === "off") {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "denied") { setStatus("denied"); return; }
        if (permission !== "granted") return;

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
            subscription: { endpoint: json.endpoint, keys: json.keys },
          }),
        });
        setStatus("on");
      } catch (err) {
        console.error("[push-toggle] subscribe failed:", err);
      }
    }
  }

  if (status === "loading" || status === "unsupported") return null;

  return (
    <button
      onClick={toggle}
      className={
        "w-9 h-9 rounded-full flex items-center justify-center transition-colors " +
        (status === "on"
          ? "bg-[var(--brand)] text-white shadow-sm"
          : status === "denied"
            ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            : "bg-white/80 text-neutral-600 border border-neutral-200 hover:bg-white")
      }
      disabled={status === "denied"}
      title={
        status === "on" ? "الإشعارات مفعّلة — اضغط لإيقافها"
          : status === "denied" ? "الإشعارات محظورة من إعدادات المتصفح"
            : "فعّل الإشعارات"
      }
    >
      {status === "on" ? "🔔" : "🔕"}
    </button>
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
