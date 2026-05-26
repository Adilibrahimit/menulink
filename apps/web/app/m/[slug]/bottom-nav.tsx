"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function BottomNav({ slug, navItems = 3 }: { slug: string; navItems?: 3 | 5 }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const key = `menulink:notif-seen:${slug}`;
    const lastSeen = localStorage.getItem(key);
    fetch(`/m/${slug}/notifications/count${lastSeen ? `?since=${encodeURIComponent(lastSeen)}` : ""}`)
      .then((r) => r.json())
      .then((d) => { if (typeof d.count === "number") setUnread(d.count); })
      .catch(() => {});
  }, [slug, pathname]);

  const baseTabs = [
    { href: `/m/${slug}`, label: "الرئيسية", icon: "🍽️", badge: 0, match: (p: string) => p === `/m/${slug}` },
    { href: `/m/${slug}/notifications`, label: "الإشعارات", icon: "🔔", badge: unread, match: (p: string) => p.startsWith(`/m/${slug}/notifications`) },
    { href: `/m/${slug}/orders`, label: "طلباتي", icon: "🛒", badge: 0, match: (p: string) => p.startsWith(`/m/${slug}/orders`) },
    { href: `/m/${slug}/account`, label: "الحساب", icon: "👤", badge: 0, match: (p: string) => p.startsWith(`/m/${slug}/account`) },
  ];

  const extendedTabs = [
    { href: `/m/${slug}`, label: "الرئيسية", icon: "🍽️", badge: 0, match: (p: string) => p === `/m/${slug}` },
    { href: `/m/${slug}/notifications`, label: "الإشعارات", icon: "🔔", badge: unread, match: (p: string) => p.startsWith(`/m/${slug}/notifications`) },
    { href: `/m/${slug}/orders`, label: "طلباتي", icon: "🛒", badge: 0, match: (p: string) => p.startsWith(`/m/${slug}/orders`) },
    { href: `/m/${slug}/rewards`, label: "المكافآت", icon: "🏆", badge: 0, match: (p: string) => p.startsWith(`/m/${slug}/rewards`) },
    { href: `/m/${slug}/account`, label: "الحساب", icon: "👤", badge: 0, match: (p: string) => p.startsWith(`/m/${slug}/account`) },
  ];

  const tabs = navItems === 5 ? extendedTabs : baseTabs;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-neutral-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
      dir="rtl"
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-0.5 min-w-[64px] py-1 ${
                active ? "text-[var(--brand)]" : "text-neutral-400"
              }`}
            >
              <span className="text-lg relative">
                {tab.icon}
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-bold ${active ? "" : "font-medium"}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {tab.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
