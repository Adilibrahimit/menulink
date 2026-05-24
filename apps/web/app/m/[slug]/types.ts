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
  key: string;
  label: string;
  price: number;
  sort: number;
  calories_kcal: number | null;
};

export type AllergenKey =
  | "gluten" | "dairy" | "eggs" | "fish" | "shellfish"
  | "peanuts" | "tree_nuts" | "soy" | "sesame" | "celery"
  | "mustard" | "sulfites" | "lupin" | "mollusks";

export type PublicMenuItem = {
  id: string;
  slug: string;
  name_ar: string;
  description_ar: string | null;
  image_url: string | null;
  sort: number;
  is_chicken: boolean;
  badges: Array<{ type: string; label: string; emoji?: string }> | null;
  calories_kcal: number | null;
  sodium_mg: number | null;
  caffeine_mg: number | null;
  allergens: AllergenKey[] | null;
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

export type CartLineModifier = {
  groupKey: string;
  groupLabel: string;
  selected: string[];
  priceDelta: number;
};

export type CartLine = {
  lineId: string;
  itemId: string;
  itemSlug: string;
  itemName: string;
  variantKey: string;
  variantLabel: string | null;
  price: number;
  qty: number;
  imageUrl: string | null;
  modifiers?: CartLineModifier[];
  itemNote?: string;
};

export type OrderType = "delivery" | "pickup" | "dine_in" | "car";
