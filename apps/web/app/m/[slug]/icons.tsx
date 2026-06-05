// Crafted inline-SVG icon set for the "delivery-modern" design (koko-test).
// Replaces emoji-as-UI: one consistent 24-grid, 1.75 stroke, round joins,
// currentColor. Keep paths simple and legible at 16–28px. No external deps.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ── Chrome ─────────────────────────────────────────────── */
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></Svg>
);
export const BagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 8h12l-1 11a2 2 0 0 1-2 1.8H9A2 2 0 0 1 7 19L6 8Z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </Svg>
);
export const UserIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" /></Svg>
);
export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.6 2.2H4.4L6 16Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 6v12M6 12h12" /></Svg>
);
export const MinusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 12h12" /></Svg>
);
export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}><path d="m14 6-6 6 6 6" /></Svg>
);
export const ChevronRight = (p: IconProps) => (
  <Svg {...p}><path d="m10 6 6 6-6 6" /></Svg>
);
export const PinIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></Svg>
);
export const StarIcon = (p: IconProps) => (
  <Svg {...p}><path d="m12 4 2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16.9 7.4 18.3l.9-5.2L4.5 9.5l5.2-.7L12 4Z" /></Svg>
);
export const FlameIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5c2.5 3 4.5 5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.4.5-2.5 1.3-3.4.3 1 .9 1.6 1.7 1.9.1-2.8 1-5 1.5-7Z" /></Svg>
);
export const LeafIcon = (p: IconProps) => (
  <Svg {...p}><path d="M19 5C9 5 5 9.5 5 16c0 1 .1 2 .4 3 0-6 4-9.5 11-10.5C13 10 9.5 12 8 16c8 1 11-3.5 11-11Z" /></Svg>
);
export const HomeIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 11.2 12 4.8l8 6.4" /><path d="M6 10v9h12v-9" /><path d="M10 19v-4.5h4V19" /></Svg>
);

// Bottom-nav glyph by tab key (opt-in SVG nav for delivery-modern).
export function NavIcon({ k, size = 22 }: { k: string; size?: number }) {
  if (k === "home") return <HomeIcon size={size} />;
  if (k === "notif") return <BellIcon size={size} />;
  if (k === "orders") return <BagIcon size={size} />;
  if (k === "rewards") return <StarIcon size={size} />;
  return <UserIcon size={size} />;
}

/* ── Category glyphs ────────────────────────────────────── */
const Drumstick = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.5 4.2a4.6 4.6 0 0 1 6.3 6.3c-1.3 1.3-3 1.4-4.6 1.1-1 1.1-2 2-3.6.9-1.4-1-1.5-2.4-.7-3.5-.4-1.7-.3-3.4 1-4.7Z" />
    <path d="m10.2 12.9-4.6 4.6M7.6 14.3l-2 .3-.4 2.4 2.4-.4.3-2M9 16.8l-2 .3" />
  </Svg>
);
const Burger = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 9.2a7.5 7.5 0 0 1 15 0Z" /><path d="M4.5 13h15M5.5 16.2h13a2 2 0 0 1-2 2.3H7.5a2 2 0 0 1-2-2.3Z" />
  </Svg>
);
const Fries = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 9.5 6.4 5.8M9.5 9V5M12 9V4.6M14.5 9V5M17 9.5l.6-3.7" />
    <path d="M5.5 9.5h13l-1 8.2a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5.5 9.5Z" />
  </Svg>
);
const Cup = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 7h11l-1 11.5a2 2 0 0 1-2 1.8H9.5a2 2 0 0 1-2-1.8L6.5 7Z" />
    <path d="M7 11h10M11 3.5c-1 .8-1 1.7 0 2.5M14 3.8c-.7.6-.7 1.2 0 1.8" />
  </Svg>
);
const IceCream = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 10a4 4 0 0 1 8 0Z" /><path d="m8.2 10.5 3.8 9 3.8-9" /><path d="M8.8 13.5h6.4" />
  </Svg>
);
const Wrap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 16 16 5a3 3 0 0 1 3 3L8 19a3 3 0 0 1-3-3Z" /><path d="m9 13 2 2M12 10l2 2" />
  </Svg>
);
const Droplet = (p: IconProps) => (
  <Svg {...p}><path d="M12 4c3 4 5 6.3 5 9a5 5 0 0 1-10 0c0-2.7 2-5 5-9Z" /></Svg>
);
const RiceBowl = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11h16a8 8 0 0 1-16 0Z" /><path d="M3 11h18M9 7.5c0-1.2 1.3-2 3-2s3 .8 3 2" />
  </Svg>
);
const Utensils = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3v8a2 2 0 0 1-4 0V3M6 11v10M16 3c-1.7 0-3 2-3 4.5S14.3 12 16 12v9" />
  </Svg>
);

/* ── Order-type glyphs (delivery / pickup / dine-in / car) ──────────────── */
const Scooter = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="17.5" r="2.4" /><circle cx="17.5" cy="17.5" r="2.4" />
    <path d="M8.4 17.5h6.7l1.6-7.2H19" /><path d="M4.7 12h4.3l2.8 5.5" /><path d="M9 12 8.2 8.2H5.6" />
  </Svg>
);
const Storefront = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.3 5.6 5h12.8L20 9.3" />
    <path d="M4.4 9.3a1.9 1.9 0 0 0 3.8 0 1.9 1.9 0 0 0 3.8 0 1.9 1.9 0 0 0 3.8 0 1.9 1.9 0 0 0 3.8 0" />
    <path d="M5.2 11.2V19h13.6v-7.8" /><path d="M10 19v-4h4v4" />
  </Svg>
);
const Car = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 11.4 6.7 7h10.6l1.7 4.4" />
    <path d="M3.8 16.6v-3.3c0-.7.3-1.3 1-1.6l1.6-.3h11.2l1.6.3c.7.3 1 .9 1 1.6v3.3" />
    <path d="M3.8 16.6h2.6M17.6 16.6H20" /><circle cx="8" cy="16.8" r="1.5" /><circle cx="16" cy="16.8" r="1.5" />
  </Svg>
);

export function OrderTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const G = type === "delivery" ? Scooter : type === "pickup" ? Storefront : type === "car" ? Car : Utensils;
  return <G size={size} />;
}

const CATEGORY_GLYPHS = {
  chicken: Drumstick,
  burger: Burger,
  fries: Fries,
  drink: Cup,
  dessert: IceCream,
  wrap: Wrap,
  sauce: Droplet,
  rice: RiceBowl,
  default: Utensils,
} as const;

type GlyphKey = keyof typeof CATEGORY_GLYPHS;

// Map a category to a glyph by Arabic/English keyword. Robust to KO-KO's
// categories and any tenant cloned onto this design; falls back to utensils.
function glyphKeyFor(nameAr: string, nameEn?: string | null, slug?: string | null): GlyphKey {
  const hay = `${nameAr} ${nameEn ?? ""} ${slug ?? ""}`.toLowerCase();
  const has = (...t: string[]) => t.some((w) => hay.includes(w));
  if (has("دجاج", "بروست", "تندر", "وينقز", "wing", "chick", "broast", "tender", "strip")) return "chicken";
  if (has("برجر", "برغر", "ساندوتش لحم", "burger")) return "burger";
  if (has("بطاط", "مقبل", "جانب", "fries", "side", "appet", "nugget", "ناقت")) return "fries";
  if (has("مشروب", "عصير", "موهيتو", "قهوة", "شاي", "drink", "juice", "soda", "coffee", "tea", "بيبسي", "كولا")) return "drink";
  if (has("حلى", "حلو", "تحلية", "ايس", "آيس", "كيك", "dessert", "sweet", "cake", "ice")) return "dessert";
  if (has("راب", "لفائف", "تورتيلا", "wrap", "roll", "ساندوتش", "sandwich")) return "wrap";
  if (has("صوص", "صلصة", "غموس", "sauce", "dip")) return "sauce";
  if (has("رز", "أرز", "وجب", "كومبو", "rice", "meal", "combo", "box", "بوكس", "وجبة")) return "rice";
  return "default";
}

export function CategoryIcon({
  nameAr,
  nameEn,
  slug,
  size = 22,
  className,
}: {
  nameAr: string;
  nameEn?: string | null;
  slug?: string | null;
  size?: number;
  className?: string;
}) {
  const Glyph = CATEGORY_GLYPHS[glyphKeyFor(nameAr, nameEn, slug)];
  return <Glyph size={size} className={className} />;
}
