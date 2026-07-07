"use client";

import { Modal } from "@/components/modal";
import { AccountForm } from "@/modules/accounts/components/account-form";
import type { AccountFormValues } from "@/modules/accounts/types";
import type { Currency } from "@/modules/currencies/types";
import type { Account } from "@/modules/vouchers/types";

interface AccountFormModalProps {
  open: boolean;
  formKey: number;
  parentAccounts: Account[];
  allAccounts: Account[];
  accountsWithMovements?: ReadonlySet<string>;
  currencies: Currency[];
  presetParentId?: string;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<void>;
}

export function AccountFormModal({
  open,
  formKey,
  parentAccounts,
  allAccounts,
  accountsWithMovements,
  currencies,
  presetParentId,
  isSaving,
  error,
  onClose,
  onSubmit,
}: AccountFormModalProps) {
  const presetParent = presetParentId
    ? parentAccounts.find((account) => account.id === presetParentId)
    : undefined;

  return (
    <Modal
      open={open}
      title={presetParent ? "إضافة حساب فرعي" : "إضافة حساب جديد"}
      description={
        presetParent
          ? `تحت الحساب: ${presetParent.code} — ${presetParent.name_ar}`
          : "الحسابات الرئيسية السبعة ثابتة. أضف الفروع تحت الحساب الأب المناسب."
      }
      onClose={onClose}
    >
      <AccountForm
        key={formKey}
        parentAccounts={parentAccounts}
        allAccounts={allAccounts}
        accountsWithMovements={accountsWithMovements}
        currencies={currencies}
        presetParentId={presetParentId}
        isSaving={isSaving}
        error={error}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Modal>
  );
}
