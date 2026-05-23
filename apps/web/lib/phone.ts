// Shared phone normalization. ALL ingestion paths must call this so the
// customer's (restaurant_id, phone) row is keyed identically regardless of
// what format the customer typed. Loyalty + the account-linking phone form
// in particular depend on this matching the existing cart-drawer behavior.
//
// Saudi customers type phones in ≥ 4 formats: 0501234567, 966501234567,
// +966501234567, ٠٥٠١٢٣٤٥٦٧ (Arabic-Indic digits). Normalized form: +9665XXXXXXXX.

const ARABIC_TO_ASCII: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export function normalizePhone(raw: string): string {
  let s = String(raw || "")
    .replace(/[٠-٩]/g, (d) => ARABIC_TO_ASCII[d] ?? d)
    .replace(/\D/g, "");
  if (s.startsWith("00966")) s = s.slice(5);
  else if (s.startsWith("966")) s = s.slice(3);
  if (s.startsWith("0")) s = s.slice(1);
  return s ? "+966" + s : "";
}
