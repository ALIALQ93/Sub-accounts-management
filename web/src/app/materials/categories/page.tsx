"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialCategoryFormModal } from "@/modules/materials/components/material-category-form-modal";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { materialCategoryApi } from "@/modules/materials/services/material-category-api";
import type { MaterialCategory, MaterialCategoryFormValues } from "@/modules/materials/types";

export default function MaterialCategoriesPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("materials.edit");
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingCategory, setEditingCategory] = useState<MaterialCategory | null>(null);

  const reload = useCallback(async () => {
    const data = await materialCategoryApi.listCategories();
    setCategories(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void materialCategoryApi
      .listCategories()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الأصناف.");
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
    setEditingCategory(null);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (category: MaterialCategory) => {
    setModalMode("edit");
    setEditingCategory(category);
    setFormError("");
    setIsModalOpen(true);
  };

  const onSubmit = async (values: MaterialCategoryFormValues) => {
    if (!values.category_code.trim() || !values.name_ar.trim()) {
      setFormError("رمز الصنف والاسم العربي مطلوبان.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (modalMode === "create") {
        await materialCategoryApi.createCategory(values);
      } else if (editingCategory) {
        await materialCategoryApi.updateCategory(editingCategory.id, values);
      }
      await reload();
      setIsModalOpen(false);
      setEditingCategory(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل حفظ الصنف.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (category: MaterialCategory) => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await materialCategoryApi.updateCategory(category.id, {
        is_active: !category.is_active,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحديث الصنف.");
    } finally {
      setIsSaving(false);
    }
  };

  const parentName = (parentId: string | null) => {
    if (!parentId) return "—";
    return categories.find((category) => category.id === parentId)?.name_ar ?? "—";
  };

  return (
    <main className="mx-auto w-full max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">أصناف المواد</h1>
      <MaterialsNav />

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            تصنيف شجري اختياري — يُستخدم في بطاقات المواد وأنماط الفواتير.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              disabled={isSaving}
              className="btn btn-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              صنف جديد
            </button>
          )}
        </div>

        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}

        {!isLoading && !error && categories.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>الرمز</th>
                  <th>الاسم</th>
                  <th>الأب</th>
                  <th>الحالة</th>
                  {canEdit && <th>إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="font-mono">{category.category_code}</td>
                    <td>{category.name_ar}</td>
                    <td className="text-xs">{parentName(category.parent_id)}</td>
                    <td>
                      {category.is_active ? (
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
                            onClick={() => openEdit(category)}
                            disabled={isSaving}
                            className="btn btn-sm btn-outline"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(category)}
                            disabled={isSaving}
                            className="btn btn-sm btn-outline"
                          >
                            {category.is_active ? "تعطيل" : "تفعيل"}
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

      <MaterialCategoryFormModal
        open={isModalOpen}
        mode={modalMode}
        categories={categories}
        initialValues={editingCategory}
        isSaving={isSaving}
        error={formError}
        onClose={() => {
          if (isSaving) return;
          setIsModalOpen(false);
          setEditingCategory(null);
          setFormError("");
        }}
        onSubmit={(values) => void onSubmit(values)}
      />
    </main>
  );
}
