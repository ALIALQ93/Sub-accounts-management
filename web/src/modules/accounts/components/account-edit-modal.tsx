"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import type { AccountTreeNode } from "@/modules/accounts/types";
import {
  getStatementLabel,
  getStatementType,
  isRootAccount,
} from "@/modules/accounts/utils/account-tree";
import type { Account } from "@/modules/vouchers/types";

export interface AccountEditValues {
  name_ar: string;
  name_en: string;
  is_postable: boolean;
}

interface AccountEditModalProps {
  open: boolean;
  account: AccountTreeNode | null;
  accountsById: Map<string, Account>;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: AccountEditValues) => Promise<void>;
}

interface AccountEditFormProps {
  account: AccountTreeNode;
  accountsById: Map<string, Account>;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: AccountEditValues) => Promise<void>;
}

function AccountEditForm({
  account,
  accountsById,
  isSaving,
  error,
  onClose,
  onSubmit,
}: AccountEditFormProps) {
  const [values, setValues] = useState<AccountEditValues>(() => ({
    name_ar: account.name_ar,
    name_en: account.name_en ?? "",
    is_postable: account.is_postable,
  }));

  const hasChildren = account.childCount > 0;
  const rootAccount = isRootAccount(account);
  const canTogglePostable = !hasChildren && !rootAccount;
  const statementType = getStatementType(account, accountsById);
  const parent = account.parent_id
    ? accountsById.get(account.parent_id)
    : undefined;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">كود الحساب</span>
          <input
            value={account.code}
            readOnly
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-600"
          />
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

        <div className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700">الحساب الأب</span>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {parent
              ? `${parent.code} — ${parent.name_ar}`
              : "حساب رئيسي (بدون أب)"}
          </p>
        </div>

        <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={values.is_postable}
            disabled={!canTogglePostable}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                is_postable: event.target.checked,
              }))
            }
          />
          <span>
            قابل للترحيل
            {hasChildren && (
              <span className="mr-2 text-xs text-slate-500">
                (لا يمكن تغييره — الحساب لديه فروع)
              </span>
            )}
            {rootAccount && (
              <span className="mr-2 text-xs text-slate-500">
                (حساب رئيسي — ثابت كحساب أب)
              </span>
            )}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {statementType && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              statementType === "balance_sheet"
                ? "bg-blue-50 text-blue-800"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {getStatementLabel(statementType)}
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            account.is_active
              ? "bg-emerald-50 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {account.is_active ? "نشط" : "غير نشط"}
        </span>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={() => onSubmit(values)}
          disabled={isSaving}
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
        </button>
      </div>
    </div>
  );
}

export function AccountEditModal({
  open,
  account,
  accountsById,
  isSaving,
  error,
  onClose,
  onSubmit,
}: AccountEditModalProps) {
  if (!account) return null;

  return (
    <Modal
      open={open}
      title="تعديل الحساب"
      description={`${account.code} — ${account.name_ar}`}
      onClose={onClose}
    >
      <AccountEditForm
        key={account.id}
        account={account}
        accountsById={accountsById}
        isSaving={isSaving}
        error={error}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}
