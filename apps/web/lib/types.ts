// Database row shapes used across server components and forms.
// Kept hand-written for now; can be replaced with `supabase gen types typescript` output later.

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  whatsapp_phone: string;
  currency: string;
  timezone: string;
  is_active: boolean;
  is_published: boolean;
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

export type Category = {
  id: string;
  restaurant_id: string;
  slug: string;
  name_ar: string;
  emoji: string | null;
  info_ar: string | null;
  sort: number;
  is_active: boolean;
};

export type MenuItem = {
  id: string;
  restaurant_id: string;
  category_id: string;
  slug: string;
  name_ar: string;
  description_ar: string | null;
  image_url: string | null;
  sort: number;
  is_active: boolean;
  is_chicken: boolean;
  badges_json: Array<{ type: string; label: string; emoji?: string }> | null;
};

export type Variant = {
  id: string;
  menu_item_id: string;
  variant_key: "piece" | "meal" | "single";
  variant_label_ar: string | null;
  price: number;
  sort: number;
  is_active: boolean;
};

export type OrderRow = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  order_type: "delivery" | "pickup" | "dine_in";
  channel: "whatsapp" | "app" | "pos";
  status: "submitted" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
  subtotal: string;
  delivery_fee: string;
  total: string;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type RfmRow = {
  customer_id: string;
  restaurant_id: string;
  name: string | null;
  phone: string;
  frequency: number;
  monetary: string;
  last_order_at: string | null;
  recency_days: number | null;
  segment: "Champion" | "Loyal" | "At-Risk" | "Lost" | "New" | "Prospect";
};
