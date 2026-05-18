// Shown by Next.js streaming during the initial RSC render of /m/[slug] —
// covers the brief window when Supabase is fetching get_public_menu().
// Skeleton mirrors the real layout so the swap-in is unnoticeable.
export default function Loading() {
  return (
    <main dir="rtl" className="min-h-[100dvh] bg-brand-bg animate-pulse">
      {/* Hero skeleton */}
      <header className="px-4 pt-8 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-neutral-200/70" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-2/3 bg-neutral-200/70 rounded" />
            <div className="h-3 w-1/2 bg-neutral-200/50 rounded" />
            <div className="h-3 w-1/3 bg-neutral-200/40 rounded mt-2" />
          </div>
        </div>
      </header>

      {/* Tabs skeleton */}
      <div className="px-4 py-2.5 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-20 h-9 rounded-full bg-neutral-200/60" />
        ))}
      </div>

      {/* Item card skeletons */}
      <div className="px-4 mt-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-200/70 p-3 flex gap-3">
            <div className="w-24 h-24 rounded-xl bg-neutral-200/70 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-1/2 bg-neutral-200/60 rounded" />
              <div className="h-3 w-2/3 bg-neutral-200/40 rounded" />
              <div className="flex gap-1.5 mt-3">
                <div className="h-9 w-20 rounded-full bg-neutral-200/60" />
                <div className="h-9 w-20 rounded-full bg-neutral-200/60" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
