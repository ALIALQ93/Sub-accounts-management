"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { UnitFormModal } from "@/modules/materials/components/unit-form-modal";
import { unitApi } from "@/modules/materials/services/unit-api";
import type {
  UnitCatalogFormValues,
  UnitCatalogItem,
} from "@/modules/materials/types";

export default function UnitsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("materials.edit");
  const [units, setUnits] = useState<UnitCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingUnit, setEditingUnit] = useState<UnitCatalogItem | null>(null);

  const reload = useCallback(async () => {
    const data = await unitApi.listUnits();
    setUnits(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void reload()
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الوحدات.");
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
    setEditingUnit(null);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (unit: UnitCatalogItem) => {
    setModalMode("edit");
    setEditingUnit(unit);
    setFormError("");
    setIsModalOpen(true);
  };

  const onSubmit = async (values: UnitCatalogFormValues) => {
    if (!values.unit_code.trim() || !values.name_ar.trim()) {
      setFormError("رمز الوحدة والاسم العربي مطلوبان.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (modalMode === "create") {
        await unitApi.createUnit(values);
      } else if (editingUnit) {
        await unitApi.updateUnit(editingUnit.id, values);
      }
      await reload();
      setIsModalOpen(false);
      setEditingUnit(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل حفظ الوحدة.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (unit: UnitCatalogItem) => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await unitApi.updateUnit(unit.id, {
        is_active: !unit.is_active,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحديث الوحدة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
        الوحدات
      </h1>
      <MaterialsNav />

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            كتالوج الوحدات — يُستخدم في بطاقات المواد والتحويلات بين الوحدات.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              disabled={isSaving}
              className="btn btn-primary"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              وحدة جديدة
            </button>
          )}
        </div>

        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}

        {!isLoading && !error && units.length === 0 && (
          <p className="text-sm text-slate-600">لا توجد وحدات بعد.</p>
        )}

        {!isLoading && !error && units.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>الرمز</th>
                  <th>الاسم</th>
                  <th>EN</th>
                  <th>الحالة</th>
                  {canEdit && <th>إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id}>
                    <td className="font-mono">{unit.unit_code}</td>
                    <td>{unit.name_ar}</td>
                    <td className="text-xs text-slate-500">
                      {unit.name_en ?? "—"}
                    </td>
                    <td>
                      {unit.is_active ? (
                        <span className="badge badge-success">نشط</span>
                      ) : (
                        <span className="badge badge-muted">معطّل</span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(unit)}
                            disabled={isSaving}
                            className="btn btn-sm btn-outline"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(unit)}
                            disabled={isSaving}
                            className="btn btn-sm btn-outline"
                          >
                            {unit.is_active ? "تعطيل" : "تفعيل"}
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

      <UnitFormModal
        open={isModalOpen}
        mode={modalMode}
        initialValues={editingUnit}
        isSaving={isSaving}
        error={formError}
        onClose={() => {
          if (isSaving) return;
          setIsModalOpen(false);
          setEditingUnit(null);
          setFormError("");
        }}
        onSubmit={(values) => void onSubmit(values)}
      />
    </main>
  );
}
