"use client";

import { useEffect, useState } from "react";
import { branchApi, type BranchOption } from "@/modules/branches/services/branch-api";
import type {
  AccountingPeriod,
  AccountingPeriodFormValues,
} from "@/modules/accounting-periods/services/accounting-period-api";

interface AccountingPeriodFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: AccountingPeriod | null;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: AccountingPeriodFormValues) => void;
}

const EMPTY: AccountingPeriodFormValues = {
  period_code: "",
  name_ar: "",
  fiscal_year: new Date().getFullYear(),
  start_date: "",
  end_date: "",
  status: "open",
  branch_id: "",
  is_active: true,
};

export function AccountingPeriodFormModal({
  open,
  mode,
  initial,
  isSaving,
  error,
  onClose,
  onSubmit,
}: AccountingPeriodFormModalProps) {
  const [values, setValues] = useState<AccountingPeriodFormValues>(EMPTY);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  useEffect(() => {
    if (!open) return;
    setValues(
      initial
        ? {
            period_code: initial.period_code,
            name_ar: initial.name_ar,
            fiscal_year: initial.fiscal_year,
            start_date: initial.start_date,
            end_date: initial.end_date,
            status: initial.status,
            branch_id: initial.branch_id ?? "",
            is_active: initial.is_active,
          }
        : {
            ...EMPTY,
            fiscal_year: new Date().getFullYear(),
          },
    );
    void branchApi.listBranchOptions().then((data) => {
      setBranches(data.filter((branch) => branch.is_active));
    });
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">
          {mode === "create" ? "فترة محاسبية جديدة" : "تعديل فترة محاسبية"}
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">رمز الفترة</span>
            <input
              value={values.period_code}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  period_code: event.target.value,
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono"
              placeholder="2026-Q1"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">الاسم</span>
            <input
              value={values.name_ar}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  name_ar: event.target.value,
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">السنة المالية</span>
            <input
              type="number"
              value={values.fiscal_year}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  fiscal_year: Number(event.target.value),
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">الحالة</span>
            <select
              value={values.status}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  status: event.target.value as AccountingPeriodFormValues["status"],
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="open">مفتوحة</option>
              <option value="closed">مقفلة</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">من تاريخ</span>
            <input
              type="date"
              value={values.start_date}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  start_date: event.target.value,
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">إلى تاريخ</span>
            <input
              type="date"
              value={values.end_date}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  end_date: event.target.value,
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">الفرع (اختياري)</span>
            <select
              value={values.branch_id}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  branch_id: event.target.value,
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">كل الشركة</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_code} — {branch.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  is_active: event.target.checked,
                }))
              }
            />
            <span>نشطة</span>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onSubmit(values)}
            className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSaving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
