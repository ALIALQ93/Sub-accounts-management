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
          <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">الفترات المحاسبية</h1>
          <p className="mt-1 text-sm text-slate-600">
            تعريف فترات السنة المالية — يتطلب{" "}
            <code className="text-xs">patch_accounting_periods.sql</code>
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={openCreate} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            فترة جديدة
          </button>
        )}
      </div>

      <SettingsNav />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        {!isLoading && !error && periods.length === 0 && (
          <p className="text-sm text-slate-600">لا توجد فترات بعد.</p>
        )}
        {!isLoading && !error && periods.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[860px]">
              <thead>
                <tr>
                  <th>الرمز</th>
                  <th>الاسم</th>
                  <th>السنة</th>
                  <th>من</th>
                  <th>إلى</th>
                  <th>الفرع</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td className="font-mono">{period.period_code}</td>
                    <td>{period.name_ar}</td>
                    <td className="tabular-nums">{period.fiscal_year}</td>
                    <td className="tabular-nums">{period.start_date}</td>
                    <td className="tabular-nums">{period.end_date}</td>
                    <td>{period.branch_code ?? "الكل"}</td>
                    <td>
                      {period.status === "open" ? (
                        <span className="badge badge-success">مفتوحة</span>
                      ) : (
                        <span className="badge badge-muted">مقفلة</span>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => openEdit(period)}
                          className="btn btn-sm btn-outline"
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
