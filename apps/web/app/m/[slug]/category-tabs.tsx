"use client";

import { useEffect, useState, useRef } from "react";
import type { PublicCategory } from "./types";

// Sticky horizontal-scrolling category bar. Active tab tracks scroll position
// via IntersectionObserver on the category sections.
export default function CategoryTabs({ categories }: { categories: PublicCategory[] }) {
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            // Scroll the corresponding tab into view
            const tab = tabsRef.current?.querySelector(`[data-cat="${entry.target.id}"]`) as HTMLElement | null;
            if (tab) {
              tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );

    categories.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [categories]);

  function scrollTo(catId: string) {
    const el = document.getElementById(catId);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <div
      ref={tabsRef}
      className="sticky top-0 z-30 bg-[var(--bg)]/85 backdrop-blur-md border-b border-neutral-200/60"
    >
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-2 px-4 py-2.5 min-w-max">
          {categories.map((c) => (
            <button
              key={c.id}
              data-cat={c.id}
              onClick={() => scrollTo(c.id)}
              className={
                "shrink-0 px-4 h-9 rounded-full text-sm font-semibold transition-colors " +
                (active === c.id
                  ? "bg-[var(--brand)] text-white"
                  : "bg-white text-neutral-700 border border-neutral-200 hover:border-neutral-300")
              }
            >
              {c.emoji && <span className="ml-1.5">{c.emoji}</span>}
              {c.name_ar}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
