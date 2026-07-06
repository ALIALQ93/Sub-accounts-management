"use client";

import { useCallback, useEffect, useState } from "react";
import { branchApi } from "@/modules/branches/services/branch-api";
import type { BranchOption } from "@/modules/branches/services/branch-api";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { WarehouseFormModal } from "@/modules/materials/components/warehouse-form-modal";
import { warehouseApi } from "@/modules/materials/services/warehouse-api";
import type { Warehouse, WarehouseFormValues } from "@/modules/materials/types";

export default function WarehousesPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("materials.edit");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  const reload = useCallback(async () => {
    const [warehousesData, branchesData] = await Promise.all([
      warehouseApi.listWarehouses(),
      branchApi.listBranchOptions(),
    ]);
    setWarehouses(warehousesData);
    setBranches(branchesData);
    return { warehousesData, branchesData };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void reload()
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل المستودعات.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const openCreate = () => {
    setModalMode("create");
    setEditingWarehouse(null);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (warehouse: Warehouse) => {
    setModalMode("edit");
    setEditingWarehouse(warehouse);
    setFormError("");
    setIsModalOpen(true);
  };

  const onSubmit = async (values: WarehouseFormValues) => {
    if (!values.warehouse_code.trim() || !values.name_ar.trim() || !values.branch_id) {
      setFormError("الرمز والاسم والفرع مطلوبون.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (modalMode === "create") {
        await warehouseApi.createWarehouse(values);
      } else if (editingWarehouse) {
        await warehouseApi.updateWarehouse(editingWarehouse.id, values);
      }
      await reload();
      setIsModalOpen(false);
      setEditingWarehouse(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل حفظ المستودع.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (warehouse: Warehouse) => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await warehouseApi.updateWarehouse(warehouse.id, {
        is_active: !warehouse.is_active,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحديث المستودع.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">المستودعات</h1>
      <MaterialsNav />

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            كل مستودع تابع لفرع واحد — يُستخدم في الفواتير والمناقلات.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              disabled={isSaving || branches.length === 0}
              className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              مستودع جديد
            </button>
          )}
        </div>

        {branches.length === 0 && !isLoading && (
          <p className="mb-3 text-sm text-amber-800">
            أضف فرعاً أولاً من{" "}
            <a href="/settings/branches" className="underline">
              إعدادات الفروع
            </a>
            .
          </p>
        )}

        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}

        {!isLoading && !error && warehouses.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">الرمز</th>
                  <th className="border-b border-slate-200 p-2">الاسم</th>
                  <th className="border-b border-slate-200 p-2">الفرع</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  {canEdit && <th className="border-b border-slate-200 p-2">إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {warehouses.map((warehouse) => (
                  <tr key={warehouse.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {warehouse.warehouse_code}
                    </td>
                    <td className="border-b border-slate-100 p-2">{warehouse.name_ar}</td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {warehouse.branch_code
                        ? `${warehouse.branch_code} — ${warehouse.branch_name_ar}`
                        : "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {warehouse.is_active ? (
                        <span className="text-emerald-700">نشط</span>
                      ) : (
                        <span className="text-slate-500">معطّل</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="border-b border-slate-100 p-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(warehouse)}
                            disabled={isSaving}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(warehouse)}
                            disabled={isSaving}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            {warehouse.is_active ? "تعطيل" : "تفعيل"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <WarehouseFormModal
        open={isModalOpen}
        mode={modalMode}
        branches={branches}
        initialValues={editingWarehouse}
        isSaving={isSaving}
        error={formError}
        onClose={() => {
          if (isSaving) return;
          setIsModalOpen(false);
          setEditingWarehouse(null);
          setFormError("");
        }}
        onSubmit={(values) => void onSubmit(values)}
      />
    </main>
  );
}
