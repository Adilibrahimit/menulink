"use client";

import { usePathname } from "next/navigation";

export default function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/m/${slug}`, label: "الرئيسية", icon: "🍽️", match: (p: string) => p === `/m/${slug}` },
    { href: `/m/${slug}/orders`, label: "طلباتي", icon: "🛒", match: (p: string) => p.startsWith(`/m/${slug}/orders`) },
    { href: `/m/${slug}/account`, label: "الحساب", icon: "👤", match: (p: string) => p.startsWith(`/m/${slug}/account`) },
  ];

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
              className={`flex flex-col items-center gap-0.5 min-w-[64px] py-1 ${
                active ? "text-[var(--brand)]" : "text-neutral-400"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span
                className={`text-[10px] font-bold ${active ? "" : "font-medium"}`}
                style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
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
