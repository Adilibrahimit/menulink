// Shape of get_public_menu(slug) — generated server-side, consumed by the
// customer PWA at /m/[slug]. Mirrors the RPC's jsonb output exactly.

export type PublicRestaurant = {
  id: string;
  slug: string;
  name: string;
  whatsapp_phone: string;
  currency: string;
  timezone: string;
  address_ar: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  contact_email: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  hours_json: Record<string, string> | null;
  logo_url: string | null;
  cover_image_url: string | null;
  tagline_ar: string | null;
  primary_color: string;
  background_color: string;
};

export type PublicVariant = {
  key: "piece" | "meal" | "single";
  label: string;
  price: number;
  sort: number;
};

export type PublicMenuItem = {
  id: string;
  slug: string;
  name_ar: string;
  description_ar: string | null;
  image_url: string | null;
  sort: number;
  is_chicken: boolean;
  badges: Array<{ type: string; label: string; emoji?: string }> | null;
  variants: PublicVariant[];
};

export type PublicCategory = {
  id: string;
  slug: string;
  name_ar: string;
  emoji: string | null;
  info_ar: string | null;
  sort: number;
  items: PublicMenuItem[];
};

export type PublicMenu = {
  restaurant: PublicRestaurant;
  categories: PublicCategory[];
};

export type CartLine = {
  lineId: string;
  itemSlug: string;
  itemName: string;
  variantKey: string;
  variantLabel: string | null;
  price: number;
  qty: number;
  imageUrl: string | null;
};

export type OrderType = "delivery" | "pickup" | "dine_in" | "car";
