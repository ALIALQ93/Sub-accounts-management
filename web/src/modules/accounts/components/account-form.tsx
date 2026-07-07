"use client";

import { useMemo, useState } from "react";
import type { AccountFormValues } from "@/modules/accounts/types";
import { getDefaultCurrencyId } from "@/modules/accounts/utils/compute-account-balances";
import { isRootAccount, formatParentOptionLabel } from "@/modules/accounts/utils/account-tree";
import { previewAccountCode } from "@/modules/accounts/utils/generate-account-code";
import type { Currency } from "@/modules/currencies/types";
import type { Account } from "@/modules/vouchers/types";

interface AccountFormProps {
  parentAccounts: Account[];
  allAccounts: Account[];
  accountsWithMovements?: ReadonlySet<string>;
  currencies: Currency[];
  presetParentId?: string;
  isSaving: boolean;
  error: string;
  onSubmit: (values: AccountFormValues) => Promise<void>;
  onCancel: () => void;
}

const EMPTY_FORM: AccountFormValues = {
  name_ar: "",
  name_en: "",
  parent_id: "",
  currency_id: "",
  is_postable: true,
  sub_code: "",
};

export function AccountForm({
  parentAccounts,
  allAccounts,
  accountsWithMovements,
  currencies,
  presetParentId,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: AccountFormProps) {
  const [values, setValues] = useState<AccountFormValues>(() => ({
    ...EMPTY_FORM,
    parent_id: presetParentId ?? "",
    currency_id: getDefaultCurrencyId(
      currencies,
      presetParentId,
      allAccounts,
    ),
    is_postable: true,
  }));

  const activeCurrencies = currencies.filter((currency) => currency.is_active);

  const parentSelected = Boolean(values.parent_id);
  const selectedParent = parentAccounts.find(
    (account) => account.id === values.parent_id,
  );

  const suggestedCode = useMemo(
    () =>
      values.parent_id
        ? previewAccountCode(values.parent_id, allAccounts)
        : "—",
    [values.parent_id, allAccounts],
  );

  const handleSubmit = async () => {
    await onSubmit(values);
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700">كود الحساب (تلقائي — للربط في النظام)</span>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">
            {suggestedCode}
          </p>
        </div>

        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700">كود فرعي (اختياري — للمستخدم)</span>
          <input
            value={values.sub_code ?? ""}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                sub_code: event.target.value.slice(0, 30),
              }))
            }
            disabled={isSaving}
            placeholder="مرجع داخلي — لا يُستخدم في الربط"
            className="rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            dir="ltr"
          />
          <span className="text-xs text-slate-500">
            حقل مرجعي للمستخدم فقط، منفصل عن كود الحساب في النظام.
          </span>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">اسم الحساب بالعربية *</span>
          <input
            value={values.name_ar}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                name_ar: event.target.value,
              }))
            }
            placeholder="اسم الحساب بالعربية"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">اسم الحساب بالإنجليزية</span>
          <input
            value={values.name_en}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                name_en: event.target.value,
              }))
            }
            placeholder="Account name in English"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            dir="ltr"
          />
        </label>

        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700">الحساب الأب *</span>
          <select
            value={values.parent_id}
            disabled={Boolean(presetParentId)}
            onChange={(event) => {
              const parentId = event.target.value;
              const parent = allAccounts.find((account) => account.id === parentId);
              setValues((current) => ({
                ...current,
                parent_id: parentId,
                currency_id:
                  parent?.currency_id ??
                  getDefaultCurrencyId(currencies, parentId, allAccounts),
                is_postable: true,
              }));
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">اختر الحساب الأب</option>
            {parentAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {formatParentOptionLabel(account, accountsWithMovements)}
              </option>
            ))}
          </select>
          {selectedParent && accountsWithMovements?.has(selectedParent.id) && (
            <span className="text-xs text-amber-700">
              تحذير: الحساب الأب عليه حركة — لن يُقبل إضافة فرع إلا بعد إزالة
              الحركات.
            </span>
          )}
        </label>

        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700">عملة الحساب *</span>
          <select
            value={values.currency_id}
            disabled={!parentSelected}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                currency_id: event.target.value,
              }))
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">اختر العملة</option>
            {activeCurrencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.code} — {currency.name_ar}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            يمكن أن تختلف عن عملة الحساب الأب. بطاقة الأب تعرض المجموع بعد
            التحويل.
          </span>
        </label>

        <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2">
          <input
            id="accountIsPostable"
            type="checkbox"
            checked={values.is_postable}
            disabled={!parentSelected}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                is_postable: event.target.checked,
              }))
            }
          />
          <span>
            قابل للترحيل
            {!parentSelected && (
              <span className="mr-2 text-xs text-slate-500">
                (يتطلب اختيار حساب أب)
              </span>
            )}
          </span>
        </label>
      </div>

      {selectedParent && !presetParentId && (
        <p className="text-sm text-slate-600">
          سيُضاف تحت:{" "}
          <span className="font-medium">
            {selectedParent.code} — {selectedParent.name_ar}
          </span>
          {isRootAccount(selectedParent) && (
            <span className="mr-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
              حساب رئيسي
            </span>
          )}
        </p>
      )}

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving || !parentSelected || !values.currency_id}
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSaving ? "جاري الحفظ..." : "إضافة الحساب"}
        </button>
      </div>
    </div>
  );
}
