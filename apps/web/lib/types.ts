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
  name_en: string | null;
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
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  image_url: string | null;
  sort: number;
  is_active: boolean;
  is_chicken: boolean;
  badges_json: Array<{ type: string; label: string; emoji?: string }> | null;
  calories_kcal: number | null;
  sodium_mg: number | null;
  caffeine_mg: number | null;
  allergens_json: string[] | null;
  modifiers_json: ModifierConfig | null;
};

export type ModifierOption = { label: string; priceDelta: number };
export type ModifierGroup = {
  key: string;
  label: string;
  type: "single" | "multi";
  required: boolean;
  max: number;
  defaultOption?: string;
  options: ModifierOption[];
};
export type ModifierConfig = {
  groups: ModifierGroup[];
  notesEnabled: boolean;
  notesMaxLength: number;
  notesPlaceholder: string;
};

export type Variant = {
  id: string;
  menu_item_id: string;
  variant_key: string;
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

export type OrderReason = {
  id: string;
  restaurant_id: string;
  actor_type: "customer" | "restaurant" | "driver" | "system";
  reason_ar: string;
  reason_en: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  event_type: "status_change" | "cancellation" | "payment" | "note";
  old_status: string | null;
  new_status: string | null;
  actor_type: "customer" | "restaurant" | "driver" | "system";
  actor_id: string | null;
  reason_id: string | null;
  reason_text: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type Branch = {
  id: string;
  restaurant_id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
  whatsapp: string | null;
  phone: string | null;
  address_ar: string | null;
  address_en: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string;
  business_day_start: string | null;
  business_day_end: string | null;
  supports_delivery: boolean;
  supports_pickup: boolean;
  supports_dine_in: boolean;
  supports_car: boolean;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Driver = {
  id: string;
  restaurant_id: string;
  branch_id: string | null;
  name: string;
  phone: string | null;
  driver_type: "internal" | "external" | "aggregator";
  is_active: boolean;
  created_at: string;
};

export type DriverAssignment = {
  id: string;
  order_id: string;
  restaurant_id: string;
  branch_id: string | null;
  driver_id: string;
  assigned_at: string;
  handed_to_driver_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  returned_at: string | null;
  delivery_result: "delivered" | "returned" | "partial" | "failed" | null;
  failure_reason_id: string | null;
  driver_note: string | null;
  cash_expected: number;
  cash_collected: number;
  cash_settled: boolean;
  settlement_status: "pending" | "settled" | "disputed";
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
