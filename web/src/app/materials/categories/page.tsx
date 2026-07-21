"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialCategoryFormModal } from "@/modules/materials/components/material-category-form-modal";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { materialApi } from "@/modules/materials/services/material-api";
import { materialCategoryApi } from "@/modules/materials/services/material-category-api";
import type {
  MaterialCategory,
  MaterialCategoryFormValues,
  MaterialListItem,
} from "@/modules/materials/types";
import {
  buildCategoryMaterialTree,
  collectExpandableCategoryIds,
  flattenCategoryMaterialTree,
  toggleExpandedId,
  type CategoryMaterialTreeNode,
} from "@/modules/materials/utils/category-material-tree";

export default function MaterialCategoriesPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("materials.edit");
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [materials, setMaterials] = useState<MaterialListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingCategory, setEditingCategory] = useState<MaterialCategory | null>(
    null,
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const [categoriesData, materialsData] = await Promise.all([
      materialCategoryApi.listCategories(),
      materialApi.listMaterials(),
    ]);
    setCategories(categoriesData);
    setMaterials(materialsData);
    const tree = buildCategoryMaterialTree(categoriesData, materialsData);
    setExpandedIds(new Set(collectExpandableCategoryIds(tree)));
    return { categoriesData, materialsData };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void reload()
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
  }, [reload]);

  const tree = useMemo(
    () => buildCategoryMaterialTree(categories, materials),
    [categories, materials],
  );
  const rows = useMemo(
    () => flattenCategoryMaterialTree(tree, expandedIds),
    [tree, expandedIds],
  );

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

  const onRowContextMenu = (
    event: ReactMouseEvent,
    node: CategoryMaterialTreeNode,
  ) => {
    if (node.kind === "category" && node.category && canEdit) {
      event.preventDefault();
      openEdit(node.category);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
        أصناف المواد
      </h1>
      <MaterialsNav />

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            شجرة الأصناف مع المواد التابعة — انقر يميناً على صنف لتعديله.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setExpandedIds(new Set(collectExpandableCategoryIds(tree)))
              }
              className="btn btn-outline"
            >
              توسيع الكل
            </button>
            <button
              type="button"
              onClick={() => setExpandedIds(new Set())}
              className="btn btn-outline"
            >
              طي الكل
            </button>
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
                صنف جديد
              </button>
            )}
          </div>
        </div>

        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <p className="text-sm text-slate-600">لا توجد أصناف أو مواد بعد.</p>
        )}

        {!isLoading && !error && rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>الرمز / الاسم</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ node, depth }) => {
                  const hasChildren = node.children.length > 0;
                  const isExpanded = expandedIds.has(node.id);
                  return (
                    <tr
                      key={`${node.kind}-${node.id}`}
                      onContextMenu={(event) => onRowContextMenu(event, node)}
                    >
                      <td>
                        <div
                          className="flex items-center gap-1.5"
                          style={{ paddingInlineStart: `${depth * 1.25}rem` }}
                        >
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedIds((current) =>
                                  toggleExpandedId(current, node.id),
                                )
                              }
                              className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                              aria-label={isExpanded ? "طي" : "توسيع"}
                            >
                              {isExpanded ? "−" : "+"}
                            </button>
                          ) : (
                            <span className="inline-block h-6 w-6" />
                          )}
                          <div>
                            {node.code ? (
                              <span className="me-2 font-mono text-xs text-slate-500">
                                {node.code}
                              </span>
                            ) : null}
                            <span
                              className={
                                node.kind === "material"
                                  ? "font-medium text-slate-900"
                                  : "font-semibold text-slate-800"
                              }
                            >
                              {node.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-slate-600">
                        {node.kind === "material"
                          ? "مادة"
                          : node.kind === "uncategorized"
                            ? "مجموعة"
                            : "صنف"}
                      </td>
                      <td>
                        {node.is_active ? (
                          <span className="badge badge-success">نشط</span>
                        ) : (
                          <span className="badge badge-muted">معطّل</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {node.kind === "category" && node.category && canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(node.category!)}
                                disabled={isSaving}
                                className="btn btn-sm btn-outline"
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleActive(node.category!)}
                                disabled={isSaving}
                                className="btn btn-sm btn-outline"
                              >
                                {node.category.is_active ? "تعطيل" : "تفعيل"}
                              </button>
                            </>
                          )}
                          {node.kind === "material" && (
                            <Link
                              href={`/materials/${node.id}`}
                              className="btn btn-sm btn-outline"
                            >
                              فتح المادة
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
