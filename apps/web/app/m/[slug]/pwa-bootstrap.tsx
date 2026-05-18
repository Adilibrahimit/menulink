"use client";

import { useEffect, useState } from "react";

// Browser-only helpers. Registers the service worker, listens for the
// beforeinstallprompt event, shows a soft "Add to Home Screen" banner
// after 20 seconds of engagement, and remembers a dismissal for 7 days.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "menulink:install-dismissed-at";
const DISMISS_DAYS = 7;
const SHOW_AFTER_MS = 20_000;

export default function PwaBootstrap() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker. Browsers ignore on http:// and unsupported envs.
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const onLoad = () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .catch((err) => console.warn("[MenuLink] SW registration failed:", err));
      };
      if (document.readyState === "complete") onLoad();
      else window.addEventListener("load", onLoad, { once: true });
    }

    // Capture the install prompt so we can fire it on our own schedule
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;

      // Respect a recent dismissal
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      const daysSinceDismiss = (Date.now() - dismissedAt) / 86_400_000;
      if (dismissedAt && daysSinceDismiss < DISMISS_DAYS) return;

      setInstallEvent(ev);
      // Show after some engagement
      const t = setTimeout(() => setShowBanner(true), SHOW_AFTER_MS);
      return () => clearTimeout(t);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function onInstall() {
    if (!installEvent) return;
    setShowBanner(false);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "dismissed") {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    } catch (err) {
      console.warn("[MenuLink] install prompt failed:", err);
    } finally {
      setInstallEvent(null);
    }
  }

  function onDismiss() {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-24 inset-x-4 z-50 bg-[var(--brand)] text-white rounded-2xl shadow-xl p-4 flex items-center justify-between gap-3"
      dir="rtl"
    >
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">ثبّت القائمة على جوالك</div>
        <div className="text-xs opacity-85 mt-0.5">
          اطلب في أي وقت دون فتح المتصفح.
        </div>
      </div>
      <button
        onClick={onInstall}
        className="bg-white text-[var(--brand)] font-bold text-sm px-4 h-9 rounded-lg whitespace-nowrap active:translate-y-px"
      >
        تثبيت
      </button>
      <button
        onClick={onDismiss}
        className="text-white/70 hover:text-white text-sm px-2"
        aria-label="إغلاق"
      >
        ✕
      </button>
    </div>
  );
}
