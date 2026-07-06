"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountingPeriodFormModal } from "@/modules/accounting-periods/components/accounting-period-form-modal";
import {
  accountingPeriodApi,
  type AccountingPeriod,
  type AccountingPeriodFormValues,
} from "@/modules/accounting-periods/services/accounting-period-api";
import { useAuth } from "@/modules/auth/auth-context";
import { SettingsNav } from "@/modules/settings/components/settings-nav";

export default function AccountingPeriodsSettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("settings.company.edit");
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingPeriod, setEditingPeriod] = useState<AccountingPeriod | null>(null);

  const reload = useCallback(async () => {
    const data = await accountingPeriodApi.listPeriods();
    setPeriods(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void accountingPeriodApi
      .listPeriods()
      .then((data) => {
        if (!cancelled) setPeriods(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الفترات.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setModalMode("create");
    setEditingPeriod(null);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (period: AccountingPeriod) => {
    setModalMode("edit");
    setEditingPeriod(period);
    setFormError("");
    setIsModalOpen(true);
  };

  const onSubmit = async (values: AccountingPeriodFormValues) => {
    if (!values.period_code.trim() || !values.name_ar.trim()) {
      setFormError("رمز الفترة والاسم مطلوبان.");
      return;
    }
    if (!values.start_date || !values.end_date) {
      setFormError("حدد تاريخ البداية والنهاية.");
      return;
    }
    if (values.end_date < values.start_date) {
      setFormError("تاريخ النهاية يجب أن يكون بعد البداية.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (modalMode === "create") {
        await accountingPeriodApi.createPeriod(values);
      } else if (editingPeriod) {
        await accountingPeriodApi.updatePeriod(editingPeriod.id, values);
      }
      await reload();
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل حفظ الفترة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الفترات المحاسبية</h1>
          <p className="mt-1 text-sm text-slate-600">
            تعريف فترات السنة المالية — يتطلب{" "}
            <code className="text-xs">patch_accounting_periods.sql</code>
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white"
          >
            فترة جديدة
          </button>
        )}
      </div>

      <SettingsNav />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}
        {!isLoading && !error && periods.length === 0 && (
          <p className="text-sm text-slate-600">لا توجد فترات بعد.</p>
        )}
        {!isLoading && !error && periods.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">الرمز</th>
                  <th className="border-b border-slate-200 p-2">الاسم</th>
                  <th className="border-b border-slate-200 p-2">السنة</th>
                  <th className="border-b border-slate-200 p-2">من</th>
                  <th className="border-b border-slate-200 p-2">إلى</th>
                  <th className="border-b border-slate-200 p-2">الفرع</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  <th className="border-b border-slate-200 p-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {period.period_code}
                    </td>
                    <td className="border-b border-slate-100 p-2">{period.name_ar}</td>
                    <td className="border-b border-slate-100 p-2">{period.fiscal_year}</td>
                    <td className="border-b border-slate-100 p-2">{period.start_date}</td>
                    <td className="border-b border-slate-100 p-2">{period.end_date}</td>
                    <td className="border-b border-slate-100 p-2">
                      {period.branch_code ?? "الكل"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          period.status === "open"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {period.status === "open" ? "مفتوحة" : "مقفلة"}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => openEdit(period)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          تعديل
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AccountingPeriodFormModal
        open={isModalOpen}
        mode={modalMode}
        initial={editingPeriod}
        isSaving={isSaving}
        error={formError}
        onClose={() => setIsModalOpen(false)}
        onSubmit={onSubmit}
      />
    </main>
  );
}
