// Design & Print Studio · row shapes + token types (DS-1 foundation).
// Hand-written to match lib/types.ts convention. These mirror the tables added
// in migration 0059. Nothing here is wired into a route yet (DS-2/DS-3 consume it).

// --- check-constraint enums (kept in sync with 0059) ----------------------
export type Tier = "standard" | "pro" | "premium";
export type ProfileStatus = "draft" | "published" | "archived";
export type PaperSize = "A3" | "A4" | "A5" | "square" | "custom";
export type Orientation = "portrait" | "landscape" | "square";
export type PrintOutputType =
  | "full_menu" | "category" | "item_card" | "offer" | "qr_table" | "qr_poster";
export type QrOutputType =
  | "poster" | "table_tent" | "sticker" | "offer" | "category" | "item" | "business_card";
export type QrPurpose = "menu" | "table" | "offer" | "category" | "item";
export type QrTargetType = QrPurpose;
export type ExportStatus = "queued" | "rendered" | "failed" | "outdated";
export type QrExportType = "pdf" | "png" | "svg";
export type PrintExportType = "pdf" | "png";
export type ScanSourceType =
  | "table" | "poster" | "sticker" | "offer" | "category" | "item" | "unknown";

// --- design tokens (shape of default_tokens_json / *_tokens_json) ---------
export type DesignTokenColors = {
  background: string;
  surface: string;
  surfaceSoft?: string;
  primary: string;
  primaryDark?: string;
  accent?: string;
  text: string;
  muted: string;
  line?: string;
  [key: string]: string | undefined;
};

export type DesignTokenTypography = {
  heading: string;
  body: string;
  latin: string;
};

export type DesignTokenRadius = {
  card: string;
  button: string;
};

export type DesignTokens = {
  colors: DesignTokenColors;
  typography: DesignTokenTypography;
  mood?: string;
  radius?: DesignTokenRadius;
  layout?: Record<string, string>;
  [key: string]: unknown;
};

// --- global template rows -------------------------------------------------
export type BrandIdentityTemplate = {
  id: string;
  key: string;
  name_ar: string;
  name_en: string | null;
  business_type: string;
  tier: Tier;
  preview_image_url: string | null;
  default_tokens_json: DesignTokens;
  is_active: boolean;
  created_at: string;
};

export type MenuPageTemplate = {
  id: string;
  key: string;
  name_ar: string;
  name_en: string | null;
  layout_type: string;
  supported_business_types: string[];
  default_config_json: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};

export type PrintTemplate = {
  id: string;
  key: string;
  name_ar: string;
  name_en: string | null;
  output_type: PrintOutputType;
  paper_size: PaperSize;
  orientation: Orientation;
  config_schema_json: Record<string, unknown>;
  preview_image_url: string | null;
  is_global: boolean;
  is_active: boolean;
  created_at: string;
};

export type QrDesignTemplate = {
  id: string;
  key: string;
  name_ar: string;
  name_en: string | null;
  output_type: QrOutputType;
  paper_size: PaperSize;
  orientation: Orientation;
  supported_tiers: Tier[];
  default_tokens_json: Partial<DesignTokens>;
  preview_image_url: string | null;
  is_active: boolean;
  created_at: string;
};

// --- tenant profiles ------------------------------------------------------
export type RestaurantDesignProfile = {
  id: string;
  restaurant_id: string;
  brand_template_id: string | null;
  menu_page_template_id: string | null;
  brand_tokens_json: Partial<DesignTokens>;
  menu_tokens_json: Record<string, unknown>;
  status: ProfileStatus;
  version_number: number;
  published_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type RestaurantPrintProfile = {
  id: string;
  restaurant_id: string;
  print_template_id: string;
  custom_tokens_json: Record<string, unknown>;
  is_default: boolean;
  status: ProfileStatus;
  created_at: string;
};

export type RestaurantQrProfile = {
  id: string;
  restaurant_id: string;
  qr_design_template_id: string;
  name_ar: string;
  purpose: QrPurpose;
  custom_tokens_json: Record<string, unknown>;
  is_default: boolean;
  status: ProfileStatus;
  created_at: string;
};

// --- QR links + exports ---------------------------------------------------
export type QrLink = {
  id: string;
  restaurant_id: string;
  qr_profile_id: string | null;
  code: string;
  target_type: QrTargetType;
  target_id: string | null;
  table_id: string | null;
  destination_url: string;
  is_active: boolean;
  created_at: string;
};

export type QrExport = {
  id: string;
  restaurant_id: string;
  qr_profile_id: string | null;
  qr_link_id: string | null;
  export_type: QrExportType;
  file_url: string | null;
  data_hash: string;
  status: ExportStatus;
  error_message: string | null;
  rendered_at: string | null;
  created_at: string;
};

export type PrintExport = {
  id: string;
  restaurant_id: string;
  print_template_id: string | null;
  export_type: PrintExportType;
  file_url: string | null;
  data_hash: string;
  status: ExportStatus;
  error_message: string | null;
  rendered_at: string | null;
  created_at: string;
};

export type QrScanEvent = {
  id: string;
  restaurant_id: string;
  qr_link_id: string | null;
  scanned_at: string;
  user_agent: string | null;
  referrer: string | null;
  source_type: ScanSourceType | null;
  ip_hash: string | null;
};

// --- promotions -----------------------------------------------------------
export type Promotion = {
  id: string;
  restaurant_id: string;
  title_ar: string;
  subtitle_ar: string | null;
  description_ar: string | null;
  badge_text_ar: string | null;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  priority: number;
  show_on_menu_home: boolean;
  show_in_print_exports: boolean;
  created_at: string;
};

export type PromotionItem = {
  id: string;
  promotion_id: string;
  menu_item_id: string | null;
  old_price: number | null;
  new_price: number | null;
  bundle_price: number | null;
  notes_ar: string | null;
  created_at: string;
};
