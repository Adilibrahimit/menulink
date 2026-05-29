import type { PublicMenu } from "./types";

// Velora "lounge" hero: centered monogram + serif wordmark + tagline on a dark
// (optionally cover-image) backdrop with gold accents. Rendered only when
// headerStyle is "velora-hero". Presentational; styled entirely via resolved CSS vars.
export default function VeloraHero({ menu }: { menu: PublicMenu }) {
  const r = menu.restaurant;
  const initial = r.name?.trim().charAt(0) || "V";
  return (
    <div className="relative overflow-hidden bg-[var(--header-bg)]">
      {r.cover_image_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--header-bg)] via-[var(--header-bg)]/85 to-[var(--header-bg)]/55" />
        </>
      )}
      <div className="relative flex flex-col items-center text-center px-6 pt-10 pb-8 gap-3">
        {r.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.logo_url} alt={r.name} className="w-20 h-20 rounded-full object-cover border border-[var(--accent-gold,#C8A15A)] shadow-md" />
        ) : (
          <div
            className="w-16 h-16 flex items-center justify-center rounded-md border border-[var(--accent-gold,#C8A15A)] text-[var(--accent-gold,#C8A15A)] text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {initial}
          </div>
        )}
        <h1 className="text-[var(--header-text)] text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          {r.name}
        </h1>
        <div className="flex items-center gap-3 text-[var(--accent-gold,#C8A15A)]">
          <span className="h-px w-8 bg-[var(--accent-gold,#C8A15A)] opacity-50" />
          <span className="text-[11px] tracking-[0.3em] uppercase" style={{ fontFamily: "var(--font-display)" }}>Restaurant · Lounge</span>
          <span className="h-px w-8 bg-[var(--accent-gold,#C8A15A)] opacity-50" />
        </div>
        {r.tagline_ar && (
          <p className="text-[var(--header-text)] opacity-80 text-sm max-w-md leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
            {r.tagline_ar}
          </p>
        )}
      </div>
    </div>
  );
}
