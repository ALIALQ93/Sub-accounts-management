"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { previewAccountCode } from "@/modules/accounts/utils/generate-account-code";
import type { PartyFormValues, PartyKind } from "@/modules/parties/types";
import {
  previewCustomerCode,
  previewVendorCode,
} from "@/modules/parties/utils/generate-party-code";
import { getPartyParentAccountOptions } from "@/modules/parties/utils/party-parent-accounts";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import type { Account, Customer, Vendor } from "@/modules/vouchers/types";

interface PartyFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  kind: PartyKind;
  party: Customer | Vendor | null;
  allAccounts: Account[];
  defaultParentAccountId?: string;
  existingCustomers: Customer[];
  existingVendors: Vendor[];
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: PartyFormValues) => Promise<void>;
}

const COPY: Record<
  PartyKind,
  {
    createTitle: string;
    editTitle: string;
    createDescription: string;
    codeLabel: string;
    nameLabel: string;
    parentLabel: string;
    linkedLabel: string;
  }
> = {
  customer: {
    createTitle: "إضافة عميل",
    editTitle: "تعديل عميل",
    createDescription:
      "يُنشأ حساب ذمم مدينة فرعي باسم العميل تحت الحساب الأب المحدد.",
    codeLabel: "كود العميل",
    nameLabel: "اسم العميل",
    parentLabel: "حساب الأب (ذمم مدينة)",
    linkedLabel: "حساب الذمم المرتبط",
  },
  vendor: {
    createTitle: "إضافة مورد",
    editTitle: "تعديل مورد",
    createDescription:
      "يُنشأ حساب ذمم دائنة فرعي باسم المورد تحت الحساب الأب المحدد.",
    codeLabel: "كود المورد",
    nameLabel: "اسم المورد",
    parentLabel: "حساب الأب (ذمم دائنة)",
    linkedLabel: "حساب الذمم المرتبط",
  },
};

function getPartyCode(party: Customer | Vendor, kind: PartyKind): string {
  return kind === "customer"
    ? (party as Customer).customer_code
    : (party as Vendor).vendor_code;
}

function getLinkedAccountId(party: Customer | Vendor, kind: PartyKind): string {
  return kind === "customer"
    ? (party as Customer).receivable_account_id
    : (party as Vendor).payable_account_id;
}

export function PartyFormModal({
  open,
  mode,
  kind,
  party,
  allAccounts,
  defaultParentAccountId = "",
  existingCustomers,
  existingVendors,
  isSaving,
  error,
  onClose,
  onSubmit,
}: PartyFormModalProps) {
  const copy = COPY[kind];
  const parentOptions = useMemo(
    () => getPartyParentAccountOptions(allAccounts),
    [allAccounts],
  );

  const [nameAr, setNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [parentAccountId, setParentAccountId] = useState(defaultParentAccountId);

  useEffect(() => {
    if (!open) return;
    setNameAr(party?.name_ar ?? "");
    setPhone(party?.phone ?? "");
    setEmail(party?.email ?? "");
    setParentAccountId(defaultParentAccountId);
  }, [open, party, defaultParentAccountId]);

  const partyCode = useMemo(() => {
    if (mode === "edit" && party) return getPartyCode(party, kind);
    return kind === "customer"
      ? previewCustomerCode(existingCustomers)
      : previewVendorCode(existingVendors);
  }, [mode, party, kind, existingCustomers, existingVendors]);

  const previewLinkedAccountCode = useMemo(() => {
    if (mode !== "create" || !parentAccountId) return "—";
    return previewAccountCode(parentAccountId, allAccounts);
  }, [mode, parentAccountId, allAccounts]);

  const linkedAccount = useMemo(() => {
    if (!party) return null;
    const accountId = getLinkedAccountId(party, kind);
    return allAccounts.find((account) => account.id === accountId) ?? null;
  }, [party, kind, allAccounts]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      name_ar: nameAr,
      phone,
      email,
      parent_account_id: parentAccountId,
    });
  };

  return (
    <Modal
      open={open}
      title={mode === "create" ? copy.createTitle : copy.editTitle}
      description={
        mode === "create"
          ? copy.createDescription
          : party
            ? `${partyCode} — ${party.name_ar}`
            : undefined
      }
      onClose={onClose}
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4">
        <div className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">{copy.codeLabel}</span>
          <p
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700"
            dir="ltr"
          >
            {partyCode}
          </p>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">{copy.nameLabel} *</span>
          <input
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
            required
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">الهاتف</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">البريد الإلكتروني</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-3 py-2"
            dir="ltr"
          />
        </label>

        {mode === "create" && (
          <>
            <AccountSearchField
              label={`${copy.parentLabel} *`}
              accounts={parentOptions}
              value={parentAccountId}
              onChange={(id) => setParentAccountId(id)}
              required
              placeholder="اختر حساب الأب — يُولَّد حساب فرعي تلقائياً"
            />
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
              <p className="font-medium">معاينة الحساب الذي سيُنشأ:</p>
              <p className="mt-1 font-mono text-xs" dir="ltr">
                {previewLinkedAccountCode} — {nameAr.trim() || "…"}
              </p>
            </div>
          </>
        )}

        {mode === "edit" && linkedAccount && (
          <div className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">{copy.linkedLabel}</span>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              <span className="font-mono">{linkedAccount.code}</span>
              {" — "}
              {linkedAccount.name_ar}
            </p>
            <Link
              href={`/reports/account-statement?accountId=${linkedAccount.id}`}
              className="text-xs font-medium text-blue-900 hover:underline"
            >
              عرض كشف الحساب ↗
            </Link>
            <p className="text-xs text-slate-500">
              يُحدَّث اسم الحساب تلقائياً عند تغيير اسم{" "}
              {kind === "customer" ? "العميل" : "المورد"}.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-[var(--danger)]/25 bg-[var(--danger)]/8 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-navy)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--brand-navy-light)] disabled:opacity-60"
          >
            {isSaving && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {isSaving ? "جاري الحفظ..." : mode === "create" ? "إضافة" : "حفظ التعديل"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
