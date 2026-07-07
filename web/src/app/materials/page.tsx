"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { InventoryShortageAlert } from "@/modules/materials/components/inventory-shortage-alert";
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
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
        المواد والمستودعات
      </h1>
      <MaterialsNav />

      <InventoryShortageAlert />

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            بطاقات المواد — مواصفات، وحدات وأسعار، وأرصدة المخزون.
          </p>
          {canCreate && (
            <Link href="/materials/new" className="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              مادة جديدة
            </Link>
          )}
        </div>

        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        {!isLoading && !error && materials.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد مواد — شغّل <code className="text-xs">setup_all.sql</code> أو أضف
            مادة جديدة.
          </p>
        )}

        {!isLoading && !error && materials.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[880px]">
              <thead>
                <tr>
                  <th>الرمز</th>
                  <th>الاسم</th>
                  <th>الصنف</th>
                  <th>باركود</th>
                  <th>شراء</th>
                  <th>بيع</th>
                  <th>حد أدنى</th>
                  <th>الحالة</th>
                  {(canEdit || canCreate) && <th>إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id}>
                    <td className="font-mono text-slate-600">
                      {material.material_code}
                    </td>
                    <td className="font-medium text-slate-900">
                      {material.name_ar}
                      {material.name_en && (
                        <span className="block text-xs font-normal text-slate-500">
                          {material.name_en}
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-slate-600">
                      {material.category_name_ar ?? "—"}
                    </td>
                    <td className="font-mono text-xs text-slate-500">
                      {material.barcode ?? "—"}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {material.purchase_price.toFixed(4)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {material.sale_price.toFixed(4)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {material.min_stock > 0 ? material.min_stock.toFixed(4) : "—"}
                    </td>
                    <td>
                      {material.is_active ? (
                        <span className="badge badge-success">نشطة</span>
                      ) : (
                        <span className="badge badge-muted">معطّلة</span>
                      )}
                    </td>
                    {(canEdit || canCreate) && (
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          <Link
                            href={`/materials/${material.id}`}
                            className="btn btn-sm btn-outline"
                          >
                            {canEdit ? "تعديل" : "عرض"}
                          </Link>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => void toggleActive(material)}
                              disabled={isSaving}
                              className="btn btn-sm btn-outline text-[var(--warning)]"
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
