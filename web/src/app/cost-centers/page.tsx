"use client";

import { useCallback, useEffect, useState } from "react";
import { CostCenterFormModal } from "@/modules/cost-centers/components/cost-center-form-modal";
import {
  costCenterApi,
  type CostCenterFormValues,
} from "@/modules/cost-centers/services/cost-center-api";
import type { CostCenter } from "@/modules/vouchers/types";

export default function CostCentersPage() {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);

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
          setLoadError(
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
    setSuccess("");
    try {
      if (modalMode === "create") {
        await costCenterApi.createCostCenter({
          ...values,
          is_active: true,
        });
        setSuccess("تم إضافة مركز الكلفة.");
      } else if (editingCenter) {
        await costCenterApi.updateCostCenter(editingCenter.id, values);
        setSuccess("تم تحديث مركز الكلفة.");
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
    setSuccess("");
    setLoadError("");
    try {
      await costCenterApi.updateCostCenter(center.id, {
        is_active: !center.is_active,
      });
      await reload();
      setSuccess(
        center.is_active ? "تم تعطيل مركز الكلفة." : "تم تفعيل مركز الكلفة.",
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "فشل تحديث الحالة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">مراكز الكلفة</h1>
          <p className="text-xs text-slate-600">
            تعريف مراكز الكلفة لاستخدامها في السندات والتقارير.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
        >
          + إضافة مركز كلفة
        </button>
      </section>

      {loadError && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
        {isLoading && (
          <p className="text-sm text-slate-600">جاري تحميل مراكز الكلفة...</p>
        )}

        {!isLoading && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border border-slate-200 p-2">الكود</th>
                  <th className="border border-slate-200 p-2">كود فرعي</th>
                  <th className="border border-slate-200 p-2">الاسم</th>
                  <th className="border border-slate-200 p-2">الاسم (EN)</th>
                  <th className="border border-slate-200 p-2">الحالة</th>
                  <th className="border border-slate-200 p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((center) => (
                  <tr key={center.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border border-slate-100 p-2 font-mono">
                      {center.code}
                    </td>
                    <td className="border border-slate-100 p-2 font-mono text-slate-600">
                      {center.sub_code ?? "—"}
                    </td>
                    <td className="border border-slate-100 p-2 font-medium">
                      {center.name_ar}
                    </td>
                    <td className="border border-slate-100 p-2 text-slate-600" dir="ltr">
                      {center.name_en ?? "—"}
                    </td>
                    <td className="border border-slate-100 p-2">
                      {center.is_active ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                          نشط
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          معطّل
                        </span>
                      )}
                    </td>
                    <td className="border border-slate-100 p-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(center)}
                          disabled={isSaving}
                          className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-50"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(center)}
                          disabled={isSaving}
                          className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50"
                        >
                          {center.is_active ? "تعطيل" : "تفعيل"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {centers.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="border border-slate-100 p-6 text-center text-slate-500"
                    >
                      لا توجد مراكز كلفة. اضغط «إضافة مركز كلفة» للبدء.
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
    </main>
  );
}
