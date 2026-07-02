"use client";

import { useState } from "react";
import type { Account } from "@/modules/vouchers/types";
import type { AccountFormValues } from "@/modules/accounts/types";
import { isRootAccount } from "@/modules/accounts/utils/account-tree";

interface AccountFormProps {
  parentAccounts: Account[];
  presetParentId?: string;
  isSaving: boolean;
  error: string;
  onSubmit: (values: AccountFormValues) => Promise<void>;
  onCancel?: () => void;
}

const EMPTY_FORM: AccountFormValues = {
  code: "",
  name_ar: "",
  parent_id: "",
  is_postable: true,
};

export function AccountForm({
  parentAccounts,
  presetParentId,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: AccountFormProps) {
  const [values, setValues] = useState<AccountFormValues>(() => ({
    ...EMPTY_FORM,
    parent_id: presetParentId ?? "",
    is_postable: true,
  }));

  const parentSelected = Boolean(values.parent_id);
  const selectedParent = parentAccounts.find(
    (account) => account.id === values.parent_id,
  );

  const handleSubmit = async () => {
    await onSubmit(values);
    if (!presetParentId) {
      setValues(EMPTY_FORM);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {presetParentId ? "إضافة حساب فرعي" : "إضافة حساب فرعي جديد"}
          </h2>
          <p className="text-sm text-slate-600">
            الحسابات الرئيسية السبعة ثابتة. أضف الفروع تحت الحساب الأب المناسب.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            إلغاء
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">كود الحساب *</span>
          <input
            value={values.code}
            onChange={(event) =>
              setValues((current) => ({ ...current, code: event.target.value }))
            }
            placeholder="مثال: 1-01-001"
            className="rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">اسم الحساب *</span>
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
          <span className="text-slate-700">الحساب الأب *</span>
          <select
            value={values.parent_id}
            disabled={Boolean(presetParentId)}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                parent_id: event.target.value,
                is_postable: true,
              }))
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">اختر الحساب الأب</option>
            {parentAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {"\u00A0".repeat(((account.level ?? 1) - 1) * 2)}
                {account.code} — {account.name_ar}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-end gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
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
              <span className="block text-xs text-slate-500">
                يتطلب اختيار حساب أب
              </span>
            )}
          </span>
        </label>
      </div>

      {selectedParent && (
        <p className="mt-3 text-sm text-slate-600">
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

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSaving}
        className="mt-4 rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSaving ? "جاري الحفظ..." : "إضافة الحساب"}
      </button>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </section>
  );
}
