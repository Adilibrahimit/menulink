import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont as loadAmiri } from "@remotion/google-fonts/Amiri";
import { loadFont as loadTajawal } from "@remotion/google-fonts/Tajawal";
import { SteamLayer } from "../components/SteamLayer";

const amiri = loadAmiri();
const tajawal = loadTajawal();

// Ember & Charcoal tokens (kept in sync with apps/web/lib/design-library.ts).
const BG = "#18110D";
const EMBER = "#D17A2E";
const BRASS = "#C9A24B";
const INK = "#F4E9D8";

export type ItemSpotlightProps = {
  photoUrl: string;
  nameAr: string;
  price: number;
  restaurantName: string;
  badgeText: string;
};

export const itemSpotlightDefaults: ItemSpotlightProps = {
  photoUrl:
    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=1080&q=80",
  nameAr: "شواية بخاري",
  price: 40,
  restaurantName: "رزرز بخاري",
  badgeText: "طبق التوقيع",
};

function toArabicDigits(input: string | number): string {
  const map = "٠١٢٣٤٥٦٧٨٩";
  return String(input).replace(/[0-9]/g, (d) => map[Number(d)]);
}

export const ItemSpotlight: React.FC<ItemSpotlightProps> = ({
  photoUrl,
  nameAr,
  price,
  restaurantName,
  badgeText,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Slow Ken-Burns push on the dish photo.
  const scale = interpolate(frame, [0, durationInFrames], [1.06, 1.2]);
  const panY = interpolate(frame, [0, durationInFrames], [-12, 12]);

  // Staggered editorial text reveals.
  const badgeIn = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const nameIn = spring({ frame: frame - 18, fps, config: { damping: 200 } });
  const priceIn = spring({ frame: frame - 34, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: BG, direction: "rtl", fontFamily: tajawal.fontFamily }}>
      {/* dish photo — ken burns */}
      <AbsoluteFill style={{ transform: `scale(${scale}) translateY(${panY}px)` }}>
        <Img
          src={photoUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.74) saturate(1.06)",
          }}
        />
      </AbsoluteFill>

      {/* warm charcoal gradient for legibility */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, #18110D 6%, rgba(24,17,13,0.5) 42%, rgba(24,17,13,0.04) 78%)",
        }}
      />

      {/* steam rising off the dish */}
      <SteamLayer count={9} />

      {/* content */}
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: 72 }}>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              display: "inline-block",
              background: BRASS,
              color: BG,
              fontFamily: amiri.fontFamily,
              fontWeight: 700,
              fontSize: 30,
              padding: "8px 24px",
              borderRadius: 999,
              marginBottom: 26,
              opacity: badgeIn,
              transform: `translateY(${(1 - badgeIn) * 18}px)`,
            }}
          >
            {badgeText}
          </div>
          <div
            style={{
              fontFamily: amiri.fontFamily,
              fontWeight: 700,
              color: BRASS,
              fontSize: 100,
              lineHeight: 1.04,
              textShadow: "0 0 26px rgba(214,138,74,0.38)",
              opacity: nameIn,
              transform: `translateY(${(1 - nameIn) * 40}px)`,
            }}
          >
            {nameAr}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 32,
              opacity: priceIn,
              transform: `translateY(${(1 - priceIn) * 24}px)`,
            }}
          >
            <span
              style={{
                background: EMBER,
                color: BG,
                fontFamily: amiri.fontFamily,
                fontWeight: 700,
                fontSize: 54,
                padding: "10px 32px",
                borderRadius: 999,
              }}
            >
              {toArabicDigits(price)} ﷼
            </span>
            <span style={{ color: INK, opacity: 0.86, fontSize: 38 }}>{restaurantName}</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
