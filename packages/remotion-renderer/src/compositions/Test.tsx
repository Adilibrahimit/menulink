import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

// Toolchain smoke-check: a frame counter on the Ember & Charcoal canvas.
// Renders in ~2s and proves bundle + headless Chromium + encode all work.
export const Test: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{ background: "#18110D", justifyContent: "center", alignItems: "center" }}
    >
      <div style={{ color: "#D17A2E", fontSize: 220, fontWeight: 700, opacity }}>{frame}</div>
    </AbsoluteFill>
  );
};
