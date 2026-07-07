"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { materialApi } from "@/modules/materials/services/material-api";
import { warehouseApi } from "@/modules/materials/services/warehouse-api";
import { warehouseMaterialLimitsApi } from "@/modules/materials/services/warehouse-material-limits-api";
import type { Warehouse } from "@/modules/materials/types";

interface LimitDraft {
  materialId: string;
  materialCode: string;
  materialName: string;
  limitId: string | null;
  minStock: string;
}

export default function WarehouseLimitsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("materials.edit");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [drafts, setDrafts] = useState<LimitDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tableMissing, setTableMissing] = useState(false);

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.is_active),
    [warehouses],
  );

  const loadWarehouseLimits = useCallback(async (selectedWarehouseId: string) => {
    const [materials, limits] = await Promise.all([
      materialApi.listMaterials(),
      warehouseMaterialLimitsApi.listByWarehouse(selectedWarehouseId),
    ]);

    const limitByMaterial = new Map(limits.map((row) => [row.material_id, row]));

    return materials
      .filter((material) => material.is_active)
      .map((material) => {
        const limit = limitByMaterial.get(material.id);
        return {
          materialId: material.id,
          materialCode: material.material_code,
          materialName: material.name_ar,
          limitId: limit?.id ?? null,
          minStock:
            limit && limit.min_stock > 0
              ? String(limit.min_stock)
              : material.min_stock > 0
                ? String(material.min_stock)
                : "",
        };
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void warehouseApi
      .listWarehouses()
      .then((data) => {
        if (!cancelled) {
          setWarehouses(data);
          const first = data.find((warehouse) => warehouse.is_active);
          if (first) setWarehouseId(first.id);
        }
      })
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
  }, []);

  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    setError("");
    setSuccess("");

    void loadWarehouseLimits(warehouseId)
      .then((rows) => {
        if (!cancelled) setDrafts(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "فشل تحميل الحدود.";
          setError(message);
          setTableMissing(message.includes("warehouse_material_limits"));
          setDrafts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [warehouseId, loadWarehouseLimits]);

  const updateDraft = (materialId: string, minStock: string) => {
    setDrafts((current) =>
      current.map((row) =>
        row.materialId === materialId ? { ...row, minStock } : row,
      ),
    );
  };

  const onSave = async () => {
    if (!canEdit || !warehouseId) return;
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      let saved = 0;
      for (const row of drafts) {
        const value = Number(row.minStock);
        if (!Number.isFinite(value) || value < 0) continue;
        if (value === 0) {
          if (row.limitId) {
            await warehouseMaterialLimitsApi.deleteLimit(row.limitId);
          }
          continue;
        }
        await warehouseMaterialLimitsApi.upsertLimit(
          warehouseId,
          row.materialId,
          value,
        );
        saved += 1;
      }
      const refreshed = await loadWarehouseLimits(warehouseId);
      setDrafts(refreshed);
      setSuccess(`تم حفظ ${saved} حد/حدود للمستودع.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الحدود.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedWarehouse = activeWarehouses.find((w) => w.id === warehouseId);

  return (
    <main className="mx-auto w-full max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">حدود المخزون per مستودع</h1>
      <p className="mb-4 text-sm text-slate-600">
        يتفوّق على حدّ بطاقة المادة في تقرير النواقص — اترك الحقل فارغاً أو صفراً
        للاعتماد على بطاقة المادة فقط.
      </p>
      <MaterialsNav />

      {isLoading && (
        <p className="mt-4 text-sm text-slate-600">جاري التحميل...</p>
      )}

      {!isLoading && (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-4 grid max-w-md gap-1 text-sm">
            <span className="font-medium">المستودع</span>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {activeWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.warehouse_code} — {warehouse.name_ar}
                  {warehouse.branch_code ? ` (${warehouse.branch_code})` : ""}
                </option>
              ))}
            </select>
          </label>

          {tableMissing && (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              جدول الحدود غير موجود بعد — شغّل{" "}
              <code>patch_inventory_phase5.sql</code> على Supabase.
            </p>
          )}

          {selectedWarehouse && drafts.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>المادة</th>
                    <th>حد أدنى (وحدة أساس)</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((row) => (
                    <tr key={row.materialId}>
                      <td>
                        <span className="font-mono text-xs">{row.materialCode}</span>
                        <span className="block text-xs">{row.materialName}</span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.0001"
                          value={row.minStock}
                          onChange={(e) =>
                            updateDraft(row.materialId, e.target.value)
                          }
                          disabled={!canEdit || isSaving || tableMissing}
                          className="w-full max-w-[160px] rounded border border-slate-300 px-2 py-1 font-mono tabular-nums"
                          placeholder="بطاقة المادة"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
          )}
          {success && (
            <p className="mt-3 text-sm text-[var(--success)]">{success}</p>
          )}

          {canEdit && !tableMissing && drafts.length > 0 && (
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={isSaving}
              className="btn btn-primary mt-4"
            >
              {isSaving ? "جاري الحفظ..." : "حفظ حدود المستودع"}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
