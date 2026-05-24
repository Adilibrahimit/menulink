export type ModifierOption = {
  label: string;
  priceDelta: number;
};

export type ModifierGroup = {
  key: string;
  label: string;
  type: "single" | "multi";
  required: boolean;
  max: number;
  defaultOption?: string;
  options: ModifierOption[];
};

export type ItemModifierConfig = {
  groups: ModifierGroup[];
  notesEnabled: boolean;
  notesMaxLength: number;
  notesPlaceholder: string;
};

const RICE_AND_EXTRAS: ItemModifierConfig = {
  groups: [
    {
      key: "rice_type",
      label: "نوع الأرز",
      type: "single",
      required: false,
      max: 1,
      defaultOption: "رز شعبي",
      options: [
        { label: "رز بيشاور", priceDelta: 2 },
        { label: "رز شعبي", priceDelta: 2 },
        { label: "رز حنيذ", priceDelta: 2 },
      ],
    },
    {
      key: "extras",
      label: "الإضافات",
      type: "multi",
      required: false,
      max: 99,
      options: [
        { label: "مثلوثة", priceDelta: 3 },
        { label: "صلصة حارة", priceDelta: 1 },
        { label: "خبز إضافي", priceDelta: 2 },
      ],
    },
  ],
  notesEnabled: true,
  notesMaxLength: 200,
  notesPlaceholder: "مثال: بدون بصل، حار قليلاً...",
};

const RICE_BEARING_KEYWORDS = [
  "مشويات",
  "فحم",
  "مضغوط",
  "كبسة",
  "شواية",
  "شوايات",
  "مدفون",
  "حنيذ",
];

export function getItemModifiers(
  categoryNameAr: string,
  _itemNameAr: string,
): ItemModifierConfig | null {
  const cat = categoryNameAr.trim();
  for (const keyword of RICE_BEARING_KEYWORDS) {
    if (cat.includes(keyword)) return RICE_AND_EXTRAS;
  }
  if (cat.includes("بخاري") || cat.includes("مندي")) return RICE_AND_EXTRAS;
  return null;
}
