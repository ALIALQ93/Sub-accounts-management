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
      <h1 className="mb-4 text-2xl font-bold text-slate-900">أصناف المواد</h1>
      <MaterialsNav />

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            تصنيف شجري اختياري — يُستخدم في بطاقات المواد وأنماط الفواتير.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              disabled={isSaving}
              className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              صنف جديد
            </button>
          )}
        </div>

        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}

        {!isLoading && !error && categories.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">الرمز</th>
                  <th className="border-b border-slate-200 p-2">الاسم</th>
                  <th className="border-b border-slate-200 p-2">الأب</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  {canEdit && <th className="border-b border-slate-200 p-2">إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {category.category_code}
                    </td>
                    <td className="border-b border-slate-100 p-2">{category.name_ar}</td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {parentName(category.parent_id)}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {category.is_active ? (
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
                            onClick={() => openEdit(category)}
                            disabled={isSaving}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(category)}
                            disabled={isSaving}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
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
