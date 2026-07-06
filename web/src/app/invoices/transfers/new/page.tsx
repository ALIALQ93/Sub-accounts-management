"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionGate } from "@/components/permission-gate";
import { useNotifications } from "@/components/notifications";
import { InvoiceMaterialLinesTable, type DraftMaterialLine } from "@/modules/invoices/components/invoice-material-lines-table";
import { InvoicesNav } from "@/modules/invoices/components/invoices-nav";
import {
  invoicePatternApi,
  type BranchOption,
  type WarehouseOption,
} from "@/modules/invoices/services/invoice-pattern-api";
import { materialApi } from "@/modules/invoices/services/material-api";
import { transferApi } from "@/modules/invoices/services/transfer-api";
import type { MaterialOption, MaterialUnitOption } from "@/modules/invoices/types";

const inputClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100";

export default function NewTransferPage() {
  const router = useRouter();
  const { notifySuccess, notifyError } = useNotifications();

  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftMaterialLine[]>([]);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [unitsByMaterial, setUnitsByMaterial] = useState<
    Record<string, MaterialUnitOption[]>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      invoicePatternApi.listBranches(),
      invoicePatternApi.listWarehouses(),
      materialApi.listMaterials(),
    ])
      .then(([branchesData, warehousesData, materialsData]) => {
        if (!cancelled) {
          setBranches(branchesData);
          setWarehouses(warehousesData);
          setMaterials(materialsData);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          notifyError(err instanceof Error ? err.message : "فشل تحميل البيانات.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notifyError]);

  const loadUnits = async (materialId: string) => {
    const units = await materialApi.listMaterialUnits(materialId);
    setUnitsByMaterial((current) => ({ ...current, [materialId]: units }));
    return units;
  };

  const onSubmit = async () => {
    if (!fromBranchId || !toBranchId || !fromWarehouseId || !toWarehouseId) {
      setError("الفروع والمستودعات مطلوبة.");
      return;
    }
    if (fromBranchId === toBranchId) {
      setError("يجب أن يختلف فرع المصدر عن فرع الوجهة.");
      return;
    }
    if (lines.length === 0) {
      setError("أضف سطر مادة واحداً على الأقل.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const created = await transferApi.createTransfer({
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        notes: notes || null,
        lines: lines.map(({ clientId: _c, unit_price: _p, ...line }) => ({
          line_no: line.line_no,
          material_id: line.material_id,
          material_unit_id: line.material_unit_id,
          qty_ordered: line.quantity,
        })),
      });
      notifySuccess("تم إنشاء مستند المناقلة.");
      router.push(`/invoices/transfers/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء المناقلة.");
    } finally {
      setIsSaving(false);
    }
  };

  const warehousesFor = (branchId: string) =>
    warehouses.filter((w) => w.is_active && w.branch_id === branchId);

  return (
    <main className="flex w-full flex-col gap-4">
      <InvoicesNav />

      <section>
        <h1 className="text-xl font-bold text-slate-900">مناقلة جديدة</h1>
        <p className="text-xs text-slate-600">
          حدّد المصدر والوجهة ثم المواد المطلوب نقلها.
        </p>
      </section>

      <PermissionGate
        permission="invoices.create"
        fallback={
          <p className="text-sm text-slate-600">ليس لديك صلاحية إنشاء مناقلات.</p>
        }
      >
        <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
          {isLoading ? (
            <p className="text-sm text-slate-600">جاري التحميل...</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">فرع المصدر *</span>
                  <select
                    className={inputClass}
                    value={fromBranchId}
                    onChange={(e) => setFromBranchId(e.target.value)}
                  >
                    <option value="">—</option>
                    {branches.filter((b) => b.is_active).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branch_code} — {b.name_ar}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">فرع الوجهة *</span>
                  <select
                    className={inputClass}
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                  >
                    <option value="">—</option>
                    {branches.filter((b) => b.is_active).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branch_code} — {b.name_ar}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">مستودع المصدر *</span>
                  <select
                    className={inputClass}
                    value={fromWarehouseId}
                    onChange={(e) => setFromWarehouseId(e.target.value)}
                  >
                    <option value="">—</option>
                    {warehousesFor(fromBranchId).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_code} — {w.name_ar}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">مستودع الوجهة *</span>
                  <select
                    className={inputClass}
                    value={toWarehouseId}
                    onChange={(e) => setToWarehouseId(e.target.value)}
                  >
                    <option value="">—</option>
                    {warehousesFor(toBranchId).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_code} — {w.name_ar}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm md:col-span-2">
                  <span className="font-medium">ملاحظات</span>
                  <input
                    className={inputClass}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>

              <InvoiceMaterialLinesTable
                lines={lines}
                materials={materials}
                unitsByMaterial={unitsByMaterial}
                warehouses={warehouses}
                defaultBranchId={fromBranchId}
                defaultCostCenterId=""
                defaultWarehouseId={fromWarehouseId}
                commercialKind="transfer_out"
                readOnly={false}
                onChange={setLines}
                onMaterialSelected={loadUnits}
              />

              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void onSubmit()}
                  className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isSaving ? "جاري الحفظ..." : "إنشاء المناقلة"}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => router.push("/invoices/transfers")}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </section>
      </PermissionGate>
    </main>
  );
}
