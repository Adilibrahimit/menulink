import React from "react";
import { AbsoluteFill, useCurrentFrame, random } from "remotion";

// Deterministic rising-steam particles, baked into the spotlight MP4. Each wisp
// rises on its own looping period (modulo the frame) and fades in/out via a sine,
// so the loop is seamless. `random(seed)` keeps it identical every render.
export const SteamLayer: React.FC<{ count?: number }> = ({ count = 9 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const seed = `wisp-${i}`;
        const x = 14 + random(seed) * 70; // horizontal position (%)
        const period = 84 + random(seed + "-p") * 70; // frames per rise
        const phase = random(seed + "-ph") * period;
        const t = ((frame + phase) % period) / period; // 0..1 progress
        const y = 82 - t * 80; // rises from ~82% up to ~2%
        const opacity = Math.sin(t * Math.PI) * 0.5; // fade in then out
        const scale = 0.65 + t * 1.0; // grows as it rises
        const size = 110 + random(seed + "-s") * 130;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size * 1.45,
              transform: `translate(-50%, -50%) scale(${scale})`,
              borderRadius: "50%",
              background:
                "radial-gradient(closest-side, rgba(255,248,236,0.82), transparent 70%)",
              filter: "blur(20px)",
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
