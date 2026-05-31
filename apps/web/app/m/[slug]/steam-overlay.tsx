"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// Steam effects (rzrz-signature + delivery-modern).
//
// Three pieces, all performance-first:
//  • <SteamDefs> — the ONE shared SVG fractal-noise displacement filter that
//    gives wisps smoky, churning edges. Render it once per layout that steams.
//  • <SteamCss>  — CSS wisps (transform/opacity only). Each wisp varies in width,
//    speed, drift and opacity so it reads as real rising steam, not pulsing
//    blobs. `mode="always"` runs continuously (visible on mobile); `smoke` opts
//    into the displaced look (prominent emitters); plain wisps use a cheap blur.
//  • <SignatureSpotlight> — the ONE Remotion-rendered video (opaque MP4 with the
//    dish + steam baked in). Lazy, paused offscreen, degrades to poster + steam.

// Shared, defined once. The displacement is static (computed once) so wisps
// stay GPU-cheap while their edges look like turbulent smoke.
export function SteamDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }}>
      <filter id="ml-smoke" x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.015 0.05" numOctaves="3" seed="11" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="32" xChannelSelector="R" yChannelSelector="G" />
        <feGaussianBlur stdDeviation="3.5" />
      </filter>
    </svg>
  );
}

export function SteamCss({
  mode = "hover",
  count = 3,
  smoke = false,
  tone = "screen",
  className = "",
}: {
  mode?: "hover" | "always";
  count?: number;
  smoke?: boolean;
  tone?: "screen" | "soft";
  className?: string;
}) {
  const spread = Math.max(1, count - 1);
  return (
    <div
      aria-hidden
      className={
        "absolute inset-0 overflow-hidden pointer-events-none " +
        (mode === "always" ? "ml-steam-on " : "") +
        (smoke ? "ml-steam-smoke " : "") +
        (tone === "soft" ? "ml-steam-soft " : "") +
        className
      }
    >
      {Array.from({ length: count }).map((_, i) => {
        const left = 8 + (i * 84) / spread; // spread wisps across the dish
        const dur = 4.2 + ((i * 1.3) % 3); // varied 4.2–7.2s so it never loops in sync
        const delay = (i * 0.7) % 3;
        const w = 26 + ((i * 7) % 22); // varied width 26–48%
        const sx = i % 2 === 0 ? 1 : -1; // alternate horizontal drift
        const op = 0.52 + (i % 3) * 0.14; // varied peak opacity (0.52–0.80)
        const style: CSSProperties = {
          left: `${left}%`,
          animationDelay: `${delay}s`,
          ["--steam-dur" as string]: `${dur}s`,
          ["--w" as string]: `${w}%`,
          ["--sx" as string]: `${sx}`,
          ["--steam-op" as string]: `${op}`,
        };
        return <span key={i} className="ml-steam-wisp" style={style} />;
      })}
    </div>
  );
}

export function SignatureSpotlight({
  videoSrc,
  poster,
}: {
  videoSrc: string | null;
  poster: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [useVideo, setUseVideo] = useState(false);

  // Decide ONCE on the client whether to load the video at all. Server render
  // and reduced-motion / Save-Data users get the static poster — zero bytes.
  useEffect(() => {
    if (!videoSrc) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    if (reduce || conn?.saveData) return;
    setUseVideo(true);
  }, [videoSrc]);

  // Play only while visible; pause when scrolled away (saves battery/decode).
  useEffect(() => {
    if (!useVideo) return;
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {}); // blocked autoplay → poster frame stays
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [useVideo]);

  if (useVideo && videoSrc) {
    return (
      <video
        ref={ref}
        className="w-full h-full object-cover"
        src={videoSrc}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        autoPlay
        preload="none"
        aria-hidden
        onError={() => setUseVideo(false)}
      />
    );
  }

  // Fallback: the real dish photo, kept alive with gentle always-on CSS steam.
  return (
    <div className="relative w-full h-full">
      {poster ? (
        // Decorative background — the visible hero <h1> already names the dish.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full" style={{ background: "var(--surface-elevated)" }} />
      )}
      <SteamCss mode="always" smoke count={5} className="opacity-90" />
    </div>
  );
}
