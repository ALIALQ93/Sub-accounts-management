"use client";

import { useMemo } from "react";
import type { Account } from "@/modules/vouchers/types";
import {
  SearchSelectField,
  type SearchSelectOption,
} from "@/modules/vouchers/components/search-select-field";

interface AccountSearchFieldProps {
  label?: string;
  accounts: Account[];
  value: string;
  onChange: (accountId: string, account: Account | null) => void;
  disabled?: boolean;
  required?: boolean;
  hideLabel?: boolean;
  placeholder?: string;
}

export function accountToSearchOption(account: Account): SearchSelectOption {
  return {
    id: account.id,
    label: `${account.code} — ${account.name_ar}`,
    sublabel: account.name_en ?? undefined,
    searchText: `${account.code} ${account.name_ar} ${account.name_en ?? ""}`,
  };
}

export function AccountSearchField({
  label = "الحساب",
  accounts,
  value,
  onChange,
  disabled,
  required,
  hideLabel,
  placeholder = "ابحث بالكود أو الاسم...",
}: AccountSearchFieldProps) {
  const options = useMemo(
    () => accounts.map(accountToSearchOption),
    [accounts],
  );

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  return (
    <SearchSelectField
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={(id, option) => {
        onChange(id, id ? (accountById.get(id) ?? null) : null);
      }}
      disabled={disabled}
      required={required}
      hideLabel={hideLabel}
      modalTitle="اختر حساباً"
      emptyMessage="لا يوجد حساب مطابق"
    />
  );
}
