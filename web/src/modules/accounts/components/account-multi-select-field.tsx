"use client";

import { useMemo } from "react";
import {
  AccountSearchField,
  accountToSearchOption,
} from "@/modules/vouchers/components/account-search-field";
import type { Account } from "@/modules/vouchers/types";

interface AccountMultiSelectFieldProps {
  label?: string;
  accounts: Account[];
  currencies?: Array<{ id: string; code: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AccountMultiSelectField({
  label = "الحسابات",
  accounts,
  currencies,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = "ابحث لإضافة حساب...",
}: AccountMultiSelectFieldProps) {
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const availableAccounts = useMemo(
    () => accounts.filter((account) => !selectedIds.includes(account.id)),
    [accounts, selectedIds],
  );

  const addAccount = (accountId: string) => {
    if (!accountId || selectedIds.includes(accountId)) return;
    onChange([...selectedIds, accountId]);
  };

  const removeAccount = (accountId: string) => {
    onChange(selectedIds.filter((id) => id !== accountId));
  };

  return (
    <div className="grid gap-2">
      <AccountSearchField
        label={label}
        accounts={availableAccounts}
        currencies={currencies}
        value=""
        onChange={(id) => addAccount(id)}
        disabled={disabled || availableAccounts.length === 0}
        placeholder={placeholder}
      />

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const account = accountById.get(id);
            if (!account) return null;
            const currencyCode = account.currency_id
              ? currencies?.find((currency) => currency.id === account.currency_id)?.code
              : undefined;
            const option = accountToSearchOption(account, currencyCode);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm"
              >
                <span className="font-mono text-xs text-slate-600">
                  {account.code}
                </span>
                <span className="text-slate-800">{account.name_ar}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeAccount(id)}
                    className="rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                    aria-label={`إزالة ${option.label}`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">لم يُختر أي حساب بعد.</p>
      )}
    </div>
  );
}
