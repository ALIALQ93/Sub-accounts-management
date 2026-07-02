"use client";

import { useMemo } from "react";
import type { CostCenter } from "@/modules/vouchers/types";
import { SearchSelectField } from "@/modules/vouchers/components/search-select-field";

interface CostCenterSearchFieldProps {
  label?: string;
  costCenters: CostCenter[];
  value: string;
  onChange: (costCenterId: string, costCenter: CostCenter | null) => void;
  disabled?: boolean;
  required?: boolean;
  hideLabel?: boolean;
}

export function CostCenterSearchField({
  label = "مركز الكلفة",
  costCenters,
  value,
  onChange,
  disabled,
  required,
  hideLabel,
}: CostCenterSearchFieldProps) {
  const options = useMemo(
    () =>
      costCenters
        .filter((center) => center.is_active)
        .map((center) => ({
          id: center.id,
          label: `${center.code} — ${center.name_ar}`,
          sublabel: center.name_en ?? undefined,
          searchText: `${center.code} ${center.name_ar} ${center.name_en ?? ""}`,
        })),
    [costCenters],
  );

  const centerById = useMemo(
    () => new Map(costCenters.map((center) => [center.id, center])),
    [costCenters],
  );

  return (
    <SearchSelectField
      label={label}
      placeholder="ابحث عن مركز كلفة..."
      options={options}
      value={value}
      onChange={(id) => onChange(id, id ? (centerById.get(id) ?? null) : null)}
      disabled={disabled}
      required={required}
      hideLabel={hideLabel}
      modalTitle="اختر مركز كلفة"
      emptyMessage="لا يوجد مركز كلفة مطابق"
    />
  );
}
