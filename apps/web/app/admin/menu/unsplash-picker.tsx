"use client";

import { useState } from "react";

type Result = {
  id: string;
  thumb: string;
  full: string;
  alt: string;
  photographer: string;
  profileUrl: string;
};

export default function UnsplashPicker({
  onPick,
  onClose,
}: {
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch(`/api/admin/unsplash/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  async function pick(r: Result) {
    setDownloading(r.id);
    onPick(r.full);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" dir="rtl">
      <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h3 className="font-extrabold text-base" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
            بحث صور من الإنترنت
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600">
            ✕
          </button>
        </header>

        <div className="p-4 space-y-3">
          <form
            onSubmit={(e) => { e.preventDefault(); search(); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث... مثال: كبسة، دجاج مشوي، برجر"
              className="flex-1 h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-blue-400 text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="h-10 px-4 rounded-lg bg-blue-600 text-white font-bold text-sm disabled:opacity-50"
            >
              {loading ? "..." : "بحث"}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {results.length === 0 && !loading && (
            <div className="text-center py-8 text-neutral-400 text-sm">
              اكتب اسم الصنف وابحث
            </div>
          )}
          {loading && (
            <div className="text-center py-8 text-neutral-400 text-sm">جاري البحث...</div>
          )}
          {results.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pick(r)}
                  disabled={downloading === r.id}
                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumb} alt={r.alt} className="w-full h-full object-cover" />
                  {downloading === r.id && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm font-bold text-blue-600">
                      جاري التحميل...
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-white/80 block truncate">
                      📷 {r.photographer}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {results.length > 0 && (
            <p className="text-[10px] text-neutral-400 text-center mt-3">
              صور من Unsplash — مجانية للاستخدام التجاري
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
