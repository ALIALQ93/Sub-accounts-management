"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { materialApi } from "@/modules/materials/services/material-api";
import type { MaterialListItem } from "@/modules/materials/types";

export default function MaterialsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("materials.create");
  const canEdit = hasPermission("materials.edit");
  const [materials, setMaterials] = useState<MaterialListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const reload = useCallback(async () => {
    const data = await materialApi.listMaterials();
    setMaterials(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void materialApi
      .listMaterials()
      .then((data) => {
        if (!cancelled) setMaterials(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل المواد.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleActive = async (material: MaterialListItem) => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await materialApi.updateMaterial(material.id, {
        is_active: !material.is_active,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحديث المادة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">المواد والمستودعات</h1>
      <MaterialsNav />

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            بطاقات المواد — وحدات القياس والأسعار per الوحدة الأساسية.
          </p>
          {canCreate && (
            <Link
              href="/materials/new"
              className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white"
            >
              مادة جديدة
            </Link>
          )}
        </div>

        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}
        {!isLoading && !error && materials.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد مواد — شغّل <code className="text-xs">setup_all.sql</code> أو أضف
            مادة جديدة.
          </p>
        )}

        {!isLoading && !error && materials.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">الرمز</th>
                  <th className="border-b border-slate-200 p-2">الاسم</th>
                  <th className="border-b border-slate-200 p-2">الصنف</th>
                  <th className="border-b border-slate-200 p-2">شراء</th>
                  <th className="border-b border-slate-200 p-2">بيع</th>
                  <th className="border-b border-slate-200 p-2">حد أدنى</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  {(canEdit || canCreate) && (
                    <th className="border-b border-slate-200 p-2">إجراء</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {material.material_code}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {material.name_ar}
                      {material.name_en && (
                        <span className="block text-xs text-slate-500">
                          {material.name_en}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {material.category_name_ar ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {material.purchase_price.toFixed(4)}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {material.sale_price.toFixed(4)}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {material.min_stock > 0 ? material.min_stock.toFixed(4) : "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {material.is_active ? (
                        <span className="text-emerald-700">نشطة</span>
                      ) : (
                        <span className="text-slate-500">معطّلة</span>
                      )}
                    </td>
                    {(canEdit || canCreate) && (
                      <td className="border-b border-slate-100 p-2">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/materials/${material.id}`}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            {canEdit ? "تعديل" : "عرض"}
                          </Link>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => void toggleActive(material)}
                              disabled={isSaving}
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              {material.is_active ? "تعطيل" : "تفعيل"}
                            </button>
                          )}
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
    </main>
  );
}
