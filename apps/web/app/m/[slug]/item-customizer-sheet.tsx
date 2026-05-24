"use client";

import { useEffect, useState, useCallback } from "react";
import { toArabicDigits } from "@/lib/arabic";
import type { ItemModifierConfig, ModifierGroup } from "@/lib/menu-modifiers";
import SarSymbol from "./sar-symbol";
import type { PublicMenuItem, PublicVariant, CartLineModifier } from "./types";

type SingleSelections = Record<string, string | null>;
type MultiSelections = Record<string, Set<string>>;

export default function ItemCustomizerSheet({
  item,
  initialVariant,
  modifierConfig,
  onAddToCart,
  onClose,
}: {
  item: PublicMenuItem;
  initialVariant: PublicVariant | null;
  modifierConfig: ItemModifierConfig | null;
  onAddToCart: (
    item: PublicMenuItem,
    variant: PublicVariant,
    qty: number,
    modifiers: CartLineModifier[],
    note: string,
  ) => void;
  onClose: () => void;
}) {
  const safeFirstVariant = item.variants[0] as PublicVariant | undefined;

  const [selectedVariant, setSelectedVariant] = useState<PublicVariant>(
    initialVariant ?? safeFirstVariant ?? { key: "", label: "", price: 0, sort: 0, calories_kcal: null },
  );
  const [singleSel, setSingleSel] = useState<SingleSelections>(() => {
    const init: SingleSelections = {};
    if (modifierConfig) {
      for (const g of modifierConfig.groups) {
        if (g.type === "single") {
          init[g.key] = g.defaultOption ?? null;
        }
      }
    }
    return init;
  });
  const [multiSel, setMultiSel] = useState<MultiSelections>(() => {
    const init: MultiSelections = {};
    if (modifierConfig) {
      for (const g of modifierConfig.groups) {
        if (g.type === "multi") init[g.key] = new Set();
      }
    }
    return init;
  });
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!safeFirstVariant) {
      onClose();
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [safeFirstVariant, onClose]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!safeFirstVariant) return null;

  const groups = modifierConfig?.groups ?? [];

  function modifierTotal(): number {
    let sum = 0;
    for (const g of groups) {
      if (g.type === "single") {
        const sel = singleSel[g.key];
        if (sel) {
          const opt = g.options.find((o) => o.label === sel);
          if (opt) sum += opt.priceDelta;
        }
      } else {
        const sel = multiSel[g.key];
        if (sel) {
          for (const label of sel) {
            const opt = g.options.find((o) => o.label === label);
            if (opt) sum += opt.priceDelta;
          }
        }
      }
    }
    return sum;
  }

  const unitPrice = Number(selectedVariant.price) + modifierTotal();
  const lineTotal = unitPrice * qty;

  function toggleSingle(groupKey: string, label: string) {
    setSingleSel((s) => ({
      ...s,
      [groupKey]: s[groupKey] === label ? null : label,
    }));
  }

  function toggleMulti(groupKey: string, label: string, max: number) {
    setMultiSel((s) => {
      const cur = new Set(s[groupKey]);
      if (cur.has(label)) {
        cur.delete(label);
      } else if (cur.size < max) {
        cur.add(label);
      }
      return { ...s, [groupKey]: cur };
    });
  }

  function buildModifiers(): CartLineModifier[] {
    const result: CartLineModifier[] = [];
    for (const g of groups) {
      if (g.type === "single") {
        const sel = singleSel[g.key];
        if (sel) {
          const opt = g.options.find((o) => o.label === sel);
          result.push({
            groupKey: g.key,
            groupLabel: g.label,
            selected: [sel],
            priceDelta: opt?.priceDelta ?? 0,
          });
        }
      } else {
        const sel = multiSel[g.key];
        if (sel && sel.size > 0) {
          const sorted = [...sel].sort();
          let delta = 0;
          for (const label of sorted) {
            const opt = g.options.find((o) => o.label === label);
            if (opt) delta += opt.priceDelta;
          }
          result.push({
            groupKey: g.key,
            groupLabel: g.label,
            selected: sorted,
            priceDelta: delta,
          });
        }
      }
    }
    return result;
  }

  function missingRequired(): ModifierGroup | null {
    for (const g of groups) {
      if (!g.required) continue;
      if (g.type === "single" && !singleSel[g.key]) return g;
      if (g.type === "multi" && (!multiSel[g.key] || multiSel[g.key].size === 0))
        return g;
    }
    return null;
  }

  const missing = missingRequired();

  function handleAdd() {
    if (missing) return;
    onAddToCart(item, selectedVariant, qty, buildModifiers(), note.trim());
    onClose();
  }

  const maxLen = modifierConfig?.notesMaxLength ?? 200;

  return (
    <div className="fixed inset-0 z-50" dir="rtl">
      {/* Scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-[var(--bg,#faf9f6)] rounded-t-[24px] shadow-2xl flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--divider,#e3e2e0)]" />
        </div>

        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-[var(--divider,#e3e2e0)]">
          <h2
            className="text-xl font-extrabold text-[var(--ink,#1a1c1a)] leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {item.name_ar}
          </h2>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1 text-[var(--price-color,#B22A2A)] font-bold text-lg"
              style={{ fontFamily: "var(--font-display)" }}
              dir="ltr"
            >
              <SarSymbol size={16} />
              <span>{toArabicDigits(String(unitPrice))}</span>
            </span>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[var(--card-bg,#ffffff)] border border-[var(--divider,#e3e2e0)] flex items-center justify-center text-[var(--text-secondary,#45464e)] hover:bg-neutral-100"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Variant selector (when more than 1 variant) */}
          {item.variants.length > 1 && (
            <div className="px-5 pt-4 pb-3 border-b border-[var(--divider,#e3e2e0)]">
              <div className="flex items-baseline justify-between mb-3">
                <h3
                  className="text-base font-bold text-[var(--ink,#1a1c1a)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  الحجم
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.variants.map((v) => {
                  const active = v.key === selectedVariant.key;
                  return (
                    <button
                      key={v.key}
                      onClick={() => setSelectedVariant(v)}
                      className={
                        "h-10 px-4 rounded-xl text-sm font-bold border-2 transition-colors " +
                        (active
                          ? "border-[var(--accent-gold,var(--brand))] bg-[var(--accent-gold,var(--brand))]/10 text-[var(--ink,#1a1c1a)]"
                          : "border-[var(--divider,#e3e2e0)] bg-[var(--card-bg,#fff)] text-[var(--text-secondary,#45464e)]")
                      }
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {v.label || v.key}
                      <span
                        className="mr-2 text-[var(--price-color,#B22A2A)]"
                        dir="ltr"
                      >
                        {toArabicDigits(String(v.price))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modifier groups */}
          {groups.map((g) => (
            <div
              key={g.key}
              className="px-5 pt-4 pb-3 border-b border-[var(--divider,#e3e2e0)]"
            >
              <div className="flex items-baseline justify-between mb-3">
                <h3
                  className="text-base font-bold text-[var(--ink,#1a1c1a)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {g.label}
                </h3>
                <span className="text-xs text-[var(--text-secondary,#45464e)]">
                  {g.required
                    ? "(مطلوب)"
                    : g.type === "multi"
                      ? "(اختياري)"
                      : g.max > 1
                        ? `(اختر حتى ${toArabicDigits(String(g.max))})`
                        : "(اختياري)"}
                </span>
              </div>

              <div className="space-y-1">
                {g.options.map((opt) => {
                  const isSelected =
                    g.type === "single"
                      ? singleSel[g.key] === opt.label
                      : multiSel[g.key]?.has(opt.label) ?? false;
                  return (
                    <button
                      key={opt.label}
                      onClick={() =>
                        g.type === "single"
                          ? toggleSingle(g.key, opt.label)
                          : toggleMulti(g.key, opt.label, g.max)
                      }
                      className={
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors " +
                        (isSelected
                          ? "bg-[var(--accent-gold,var(--brand))]/10 border-2 border-[var(--accent-gold,var(--brand))]"
                          : "bg-transparent border-2 border-transparent")
                      }
                    >
                      {/* Checkbox / radio indicator */}
                      <span
                        className={
                          "w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center text-xs " +
                          (g.type === "single" ? "rounded-full " : "") +
                          (isSelected
                            ? "bg-[var(--accent-gold,var(--brand))] border-[var(--accent-gold,var(--brand))] text-[var(--cta-text,#00143d)]"
                            : "border-[var(--divider,#e3e2e0)] bg-[var(--card-bg,#fff)]")
                        }
                      >
                        {isSelected && "✓"}
                      </span>
                      <span
                        className={
                          "flex-1 text-right text-sm " +
                          (isSelected ? "font-bold text-[var(--ink,#1a1c1a)]" : "text-[var(--ink,#1a1c1a)]")
                        }
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {opt.label}
                      </span>
                      {opt.priceDelta > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-xs text-[var(--text-secondary,#45464e)]"
                          dir="ltr"
                        >
                          <SarSymbol size={10} />
                          <span>{toArabicDigits(String(opt.priceDelta))}</span>
                          <span>+</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          {(modifierConfig?.notesEnabled ?? true) && (
            <div className="px-5 pt-4 pb-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3
                  className="text-base font-bold text-[var(--ink,#1a1c1a)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ملاحظات للمطبخ
                </h3>
                <span className="text-xs text-[var(--text-secondary,#45464e)]">
                  اختياري · {toArabicDigits(String(maxLen))} حرف
                </span>
              </div>
              <div className="relative">
                <textarea
                  value={note}
                  onChange={(e) => {
                    if (e.target.value.length <= maxLen) setNote(e.target.value);
                  }}
                  placeholder={
                    modifierConfig?.notesPlaceholder ??
                    "مثال: بدون بصل، حار قليلاً..."
                  }
                  rows={2}
                  className="w-full rounded-xl border border-[var(--divider,#e3e2e0)] bg-[var(--card-bg,#fff)] px-4 py-3 text-sm outline-none focus:border-[var(--accent-gold,var(--brand))] resize-none"
                  style={{ fontFamily: "var(--font-body)" }}
                  dir="rtl"
                />
                <span className="absolute bottom-2 left-3 text-[10px] text-[var(--text-secondary,#45464e)]">
                  {toArabicDigits(String(note.length))} / {toArabicDigits(String(maxLen))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sticky bottom CTA */}
        <div
          className="border-t border-[var(--divider,#e3e2e0)] bg-[var(--bg,#faf9f6)] px-5 pt-3 flex items-center gap-3"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          {/* Quantity stepper */}
          <div className="flex items-center gap-1 border-2 border-[var(--divider,#e3e2e0)] rounded-xl h-12 px-1 bg-[var(--card-bg,#fff)]">
            <button
              onClick={() => setQty((q) => Math.max(1, q + 1))}
              className="w-9 h-9 flex items-center justify-center text-lg font-bold text-[var(--ink,#1a1c1a)]"
              aria-label="زيادة"
            >
              +
            </button>
            <span
              className="w-7 text-center font-extrabold text-base text-[var(--ink,#1a1c1a)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {toArabicDigits(String(qty))}
            </span>
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-9 h-9 flex items-center justify-center text-lg font-bold text-[var(--text-secondary,#45464e)]"
              aria-label="إنقاص"
            >
              −
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={!!missing}
            className={
              "flex-1 h-12 rounded-xl font-extrabold text-base flex items-center justify-center gap-3 active:translate-y-px shadow-md " +
              (missing
                ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                : "bg-[var(--cta-bg,var(--brand))] text-[var(--cta-text,#fff)] hover:opacity-90")
            }
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span>أضف للسلة</span>
            <span
              className="inline-flex items-center gap-1 bg-white/20 rounded-lg px-2.5 py-1 text-sm font-bold"
              dir="ltr"
            >
              <SarSymbol size={13} />
              <span>{toArabicDigits(String(lineTotal))}</span>
            </span>
          </button>
        </div>

        {/* Validation hint */}
        {missing && (
          <p className="text-center text-xs text-red-600 pb-2" style={{ fontFamily: "var(--font-body)" }}>
            يرجى اختيار {missing.label}
          </p>
        )}
      </div>
    </div>
  );
}
