"use client";

import { useEffect } from "react";
import { toArabicDigits } from "@/lib/arabic";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  url: string | null;
  created_at: string;
};

function lastSeenKey(slug: string) {
  return `menulink:notif-seen:${slug}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${toArabicDigits(String(mins))} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${toArabicDigits(String(hours))} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${toArabicDigits(String(days))} يوم`;
}

export default function NotificationsClient({
  slug,
  restaurantName,
  logoUrl,
  notifications,
}: {
  slug: string;
  restaurantName: string;
  logoUrl: string | null;
  notifications: Notification[];
}) {
  useEffect(() => {
    localStorage.setItem(lastSeenKey(slug), new Date().toISOString());
  }, [slug]);

  if (notifications.length === 0) {
    return (
      <div className="p-4">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl">🔔</div>
          <p className="text-sm text-neutral-500" style={{ fontFamily: "var(--font-display)" }}>
            لا توجد إشعارات حالياً
          </p>
          <p className="text-xs text-neutral-400">
            ستظهر هنا العروض والتنبيهات من {restaurantName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="bg-white border border-neutral-200 rounded-2xl p-4 flex gap-3"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="w-10 h-10 rounded-xl object-cover border border-neutral-100 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center text-lg font-bold shrink-0">
              🔔
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3
                className="font-extrabold text-sm text-neutral-900 leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {n.title}
              </h3>
              <span className="text-[10px] text-neutral-400 shrink-0 mt-0.5">
                {timeAgo(n.created_at)}
              </span>
            </div>
            {n.body && (
              <p className="text-xs text-neutral-600 mt-1 leading-snug">
                {n.body}
              </p>
            )}
            {n.url && (
              <a
                href={n.url}
                className="inline-block mt-2 text-[11px] font-bold text-[var(--brand)] hover:underline"
              >
                عرض التفاصيل ←
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function getUnreadCount(slug: string, notifications: { created_at: string }[]): number {
  if (typeof window === "undefined") return 0;
  const lastSeen = localStorage.getItem(lastSeenKey(slug));
  if (!lastSeen) return notifications.length;
  const ts = new Date(lastSeen).getTime();
  return notifications.filter((n) => new Date(n.created_at).getTime() > ts).length;
}
