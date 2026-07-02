"use client";

import { useMemo } from "react";
import type { Vendor } from "@/modules/vouchers/types";
import { SearchSelectField } from "@/modules/vouchers/components/search-select-field";

interface VendorSearchFieldProps {
  label?: string;
  vendors: Vendor[];
  value: string;
  onChange: (vendorId: string, vendor: Vendor | null) => void;
  disabled?: boolean;
  required?: boolean;
}

export function VendorSearchField({
  label = "المورد",
  vendors,
  value,
  onChange,
  disabled,
  required,
}: VendorSearchFieldProps) {
  const options = useMemo(
    () =>
      vendors
        .filter((vendor) => vendor.is_active)
        .map((vendor) => ({
          id: vendor.id,
          label: `${vendor.vendor_code} — ${vendor.name_ar}`,
          sublabel: vendor.phone ?? undefined,
          searchText: `${vendor.vendor_code} ${vendor.name_ar} ${vendor.phone ?? ""}`,
        })),
    [vendors],
  );

  const vendorById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors],
  );

  return (
    <SearchSelectField
      label={label}
      placeholder="ابحث عن مورد..."
      options={options}
      value={value}
      onChange={(id) => onChange(id, id ? (vendorById.get(id) ?? null) : null)}
      disabled={disabled}
      required={required}
      modalTitle="اختر مورداً"
      emptyMessage="لا يوجد مورد مطابق"
    />
  );
}
