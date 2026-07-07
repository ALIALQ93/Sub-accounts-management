"use client";

import { useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { CostCenterBulkImportModal } from "@/modules/cost-centers/components/cost-center-bulk-import-modal";
import { CostCenterFormModal } from "@/modules/cost-centers/components/cost-center-form-modal";
import {
  costCenterApi,
  type CostCenterFormValues,
} from "@/modules/cost-centers/services/cost-center-api";
import type { CostCenter } from "@/modules/vouchers/types";

export default function CostCentersPage() {
  const { hasPermission } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const canEdit = hasPermission("cost_centers.edit");
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [formError, setFormError] = useState("");

  const reload = useCallback(async () => {
    const data = await costCenterApi.listCostCenters();
    setCenters(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await costCenterApi.listCostCenters();
        if (!cancelled) setCenters(data);
      } catch (err) {
        if (!cancelled) {
          notifyError(
            err instanceof Error ? err.message : "فشل تحميل مراكز الكلفة.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingCenter(null);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (center: CostCenter) => {
    setModalMode("edit");
    setEditingCenter(center);
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingCenter(null);
    setFormError("");
  };

  const onSubmit = async (values: CostCenterFormValues) => {
    if (!values.name_ar.trim()) {
      setFormError("الاسم العربي مطلوب.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (modalMode === "create") {
        await costCenterApi.createCostCenter({
          ...values,
          is_active: true,
        });
        notifySuccess("تم إضافة مركز الكلفة.");
      } else if (editingCenter) {
        await costCenterApi.updateCostCenter(editingCenter.id, values);
        notifySuccess("تم تحديث مركز الكلفة.");
      }
      await reload();
      setIsModalOpen(false);
      setEditingCenter(null);
      setFormError("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل حفظ مركز الكلفة.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (center: CostCenter) => {
    setIsSaving(true);
    try {
      await costCenterApi.updateCostCenter(center.id, {
        is_active: !center.is_active,
      });
      await reload();
      notifySuccess(
        center.is_active ? "تم تعطيل مركز الكلفة." : "تم تفعيل مركز الكلفة.",
      );
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "فشل تحديث الحالة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--brand-navy)]">
            مراكز الكلفة
          </h1>
          <p className="text-xs text-slate-600">
            تعريف مراكز الكلفة لاستخدامها في السندات والتقارير.
          </p>
        </div>
        <PermissionGate permission="cost_centers.create">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openCreateModal} className="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              إضافة مركز كلفة
            </button>
            <button
              type="button"
              onClick={() => setIsBulkImportOpen(true)}
              className="btn btn-outline text-[var(--brand-navy)]"
            >
              إضافة دفعة
            </button>
          </div>
        </PermissionGate>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <p className="p-4 text-sm text-slate-600">جاري تحميل مراكز الكلفة...</p>
        )}

        {!isLoading && (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>كود فرعي</th>
                  <th>الاسم</th>
                  <th>الاسم (EN)</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((center) => (
                  <tr key={center.id}>
                    <td className="font-mono text-slate-600">{center.code}</td>
                    <td className="font-mono text-slate-500">
                      {center.sub_code ?? "—"}
                    </td>
                    <td className="font-medium text-slate-900">
                      {center.name_ar}
                    </td>
                    <td className="text-slate-600" dir="ltr">
                      {center.name_en ?? "—"}
                    </td>
                    <td>
                      {center.is_active ? (
                        <span className="badge badge-success">نشط</span>
                      ) : (
                        <span className="badge badge-muted">معطّل</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(center)}
                              disabled={isSaving}
                              className="btn btn-sm btn-outline"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleActive(center)}
                              disabled={isSaving}
                              className="btn btn-sm btn-outline text-[var(--warning)]"
                            >
                              {center.is_active ? "تعطيل" : "تفعيل"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {centers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      لا توجد مراكز كلفة. اضغط «إضافة مركز كلفة» أو «إضافة دفعة» للبدء.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CostCenterFormModal
        open={isModalOpen}
        mode={modalMode}
        center={editingCenter}
        allCenters={centers}
        isSaving={isSaving}
        error={formError}
        onClose={closeModal}
        onSubmit={onSubmit}
      />

      <CostCenterBulkImportModal
        open={isBulkImportOpen}
        centers={centers}
        isSaving={isSaving}
        onClose={() => setIsBulkImportOpen(false)}
        onImported={async () => {
          await reload();
        }}
      />
    </main>
  );
}
