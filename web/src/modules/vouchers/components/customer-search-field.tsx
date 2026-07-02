"use client";

import { useMemo } from "react";
import type { Customer } from "@/modules/vouchers/types";
import { SearchSelectField } from "@/modules/vouchers/components/search-select-field";

interface CustomerSearchFieldProps {
  label?: string;
  customers: Customer[];
  value: string;
  onChange: (customerId: string, customer: Customer | null) => void;
  disabled?: boolean;
  required?: boolean;
}

export function CustomerSearchField({
  label = "العميل",
  customers,
  value,
  onChange,
  disabled,
  required,
}: CustomerSearchFieldProps) {
  const options = useMemo(
    () =>
      customers
        .filter((customer) => customer.is_active)
        .map((customer) => ({
          id: customer.id,
          label: `${customer.customer_code} — ${customer.name_ar}`,
          sublabel: customer.phone ?? undefined,
          searchText: `${customer.customer_code} ${customer.name_ar} ${customer.phone ?? ""}`,
        })),
    [customers],
  );

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  return (
    <SearchSelectField
      label={label}
      placeholder="ابحث عن عميل..."
      options={options}
      value={value}
      onChange={(id) => onChange(id, id ? (customerById.get(id) ?? null) : null)}
      disabled={disabled}
      required={required}
      modalTitle="اختر عميلاً"
      emptyMessage="لا يوجد عميل مطابق"
    />
  );
}
