// SFDA-mandated 14 allergens. These keys are stored in menu_items.allergens_json
// and rendered on the customer PWA. Arabic labels follow SFDA naming.

import type { AllergenKey } from "@/app/m/[slug]/types";

export type AllergenInfo = {
  key: AllergenKey;
  label_ar: string;
  icon: string;
};

export const ALLERGENS: AllergenInfo[] = [
  { key: "gluten",    label_ar: "جلوتين (قمح)", icon: "🌾" },
  { key: "dairy",     label_ar: "حليب ومشتقاته", icon: "🥛" },
  { key: "eggs",      label_ar: "بيض",           icon: "🥚" },
  { key: "fish",      label_ar: "أسماك",         icon: "🐟" },
  { key: "shellfish", label_ar: "قشريات",        icon: "🦐" },
  { key: "peanuts",   label_ar: "فول سوداني",    icon: "🥜" },
  { key: "tree_nuts", label_ar: "مكسرات",        icon: "🌰" },
  { key: "soy",       label_ar: "صويا",          icon: "🫘" },
  { key: "sesame",    label_ar: "سمسم",          icon: "⚫" },
  { key: "celery",    label_ar: "كرفس",          icon: "🥬" },
  { key: "mustard",   label_ar: "خردل",          icon: "🟡" },
  { key: "sulfites",  label_ar: "كبريتات",       icon: "🧪" },
  { key: "lupin",     label_ar: "ترمس",          icon: "🌱" },
  { key: "mollusks",  label_ar: "رخويات",        icon: "🦑" },
];

export const ALLERGEN_MAP = new Map(ALLERGENS.map((a) => [a.key, a]));
