"use client";

import { useMemo } from "react";
import { SearchSelectField } from "@/modules/vouchers/components/search-select-field";
import type { MaterialListItem } from "@/modules/materials/types";
import { compositeModeLabel } from "@/modules/materials/utils/composite-mode";

interface MaterialSearchFieldProps {
  label?: string;
  materials: MaterialListItem[];
  value: string;
  onChange: (materialId: string, material: MaterialListItem | null) => void;
  disabled?: boolean;
  required?: boolean;
  hideLabel?: boolean;
  placeholder?: string;
}

export function MaterialSearchField({
  label = "المادة",
  materials,
  value,
  onChange,
  disabled,
  required,
  hideLabel,
  placeholder = "ابحث عن مادة...",
}: MaterialSearchFieldProps) {
  const options = useMemo(
    () =>
      materials.map((material) => {
        const kindLabel = compositeModeLabel(
          material.material_kind,
          material.composite_mode,
        );
        return {
          id: material.id,
          label: `${material.material_code} — ${material.name_ar} (${kindLabel})`,
          sublabel: material.category_name_ar ?? undefined,
          searchText: `${material.material_code} ${material.name_ar} ${material.name_en ?? ""} ${material.category_code ?? ""} ${material.category_name_ar ?? ""} ${kindLabel}`,
        };
      }),
    [materials],
  );

  const byId = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials],
  );

  return (
    <SearchSelectField
      label={label}
      hideLabel={hideLabel}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={(id) => onChange(id, id ? (byId.get(id) ?? null) : null)}
      disabled={disabled}
      required={required}
      modalTitle="اختر مادة"
      emptyMessage="لا توجد مادة مطابقة"
    />
  );
}
