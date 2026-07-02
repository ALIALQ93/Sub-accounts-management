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
  currencies?: Array<{ id: string; code: string }>;
  filterCurrencyId?: string;
}

export function accountToSearchOption(
  account: Account,
  currencyCode?: string,
): SearchSelectOption {
  return {
    id: account.id,
    label: `${account.code} — ${account.name_ar}`,
    sublabel: [currencyCode, account.name_en].filter(Boolean).join(" · ") || undefined,
    searchText: `${account.code} ${account.name_ar} ${account.name_en ?? ""} ${currencyCode ?? ""}`,
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
  currencies,
  filterCurrencyId,
}: AccountSearchFieldProps) {
  const currencyById = useMemo(
    () => new Map((currencies ?? []).map((currency) => [currency.id, currency.code])),
    [currencies],
  );

  const visibleAccounts = useMemo(() => {
    if (!filterCurrencyId) return accounts;
    return accounts.filter((account) => account.currency_id === filterCurrencyId);
  }, [accounts, filterCurrencyId]);

  const options = useMemo(
    () =>
      visibleAccounts.map((account) =>
        accountToSearchOption(
          account,
          account.currency_id
            ? currencyById.get(account.currency_id)
            : undefined,
        ),
      ),
    [visibleAccounts, currencyById],
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
