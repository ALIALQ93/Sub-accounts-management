"use client";

import type { VoucherLine, VoucherLineCategory } from "@/modules/vouchers/types";

interface VoucherLineCategoryFieldsProps {
  categories: VoucherLineCategory[];
  categoryId: string;
  quantity: number | null | undefined;
  disabled?: boolean;
  onCategoryChange: (categoryId: string) => void;
  onQuantityChange: (quantity: number | null) => void;
}

export function VoucherLineCategoryFields({
  categories,
  categoryId,
  quantity,
  disabled,
  onCategoryChange,
  onQuantityChange,
}: VoucherLineCategoryFieldsProps) {
  const selected = categories.find((item) => item.id === categoryId);

  if (categories.length === 0) {
    return (
      <span className="text-xs text-slate-400">لا أنواع — عرّفها من إعدادات السندات</span>
    );
  }

  return (
    <div className="grid gap-1">
      <select
        value={categoryId}
        onChange={(event) => onCategoryChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        <option value="">— نوع السطر —</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name_ar}
          </option>
        ))}
      </select>
      {selected?.requires_quantity && (
        <input
          type="number"
          min={0}
          step="0.01"
          value={quantity ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            onQuantityChange(raw === "" ? null : Number(raw));
          }}
          disabled={disabled}
          placeholder={selected.quantity_label ?? "العدد"}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm font-mono"
        />
      )}
    </div>
  );
}

export function validateLineCategory(
  line: VoucherLine,
  categories: VoucherLineCategory[],
): string | null {
  if (!line.line_category_id) return null;
  const category = categories.find((item) => item.id === line.line_category_id);
  if (!category) return "نوع السطر غير صالح.";
  if (
    category.requires_quantity &&
    (line.category_quantity === null ||
      line.category_quantity === undefined ||
      Number(line.category_quantity) <= 0)
  ) {
    return `النوع «${category.name_ar}» يتطلب ${category.quantity_label ?? "العدد"}.`;
  }
  return null;
}

export function lineCategoryPayload(line: VoucherLine): {
  line_category_id: string | null;
  category_quantity: number | null;
} {
  return {
    line_category_id: line.line_category_id || null,
    category_quantity:
      line.line_category_id && line.category_quantity != null
        ? Number(line.category_quantity)
        : null,
  };
}
