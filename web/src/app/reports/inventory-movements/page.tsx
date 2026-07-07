"use client";

import { useEffect, useMemo, useState } from "react";
import { ExportCsvButton } from "@/components/export-csv-button";
import { branchApi, type BranchOption } from "@/modules/branches/services/branch-api";
import { materialApi } from "@/modules/materials/services/material-api";
import { warehouseApi } from "@/modules/materials/services/warehouse-api";
import { ReportsNav } from "@/modules/reports/components/reports-nav";
import {
  COMMERCIAL_KIND_LABELS,
  inventoryReportApi,
  MOVEMENT_KIND_LABELS,
  type InventoryMovementSummaryRow,
} from "@/modules/reports/services/inventory-report-api";

export default function InventoryMovementsReportPage() {
  const [rows, setRows] = useState<InventoryMovementSummaryRow[]>([]);
  const [materials, setMaterials] = useState<
    Awaited<ReturnType<typeof materialApi.listMaterials>>
  >([]);
  const [warehouses, setWarehouses] = useState<
    Awaited<ReturnType<typeof warehouseApi.listWarehouses>>
  >([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      materialApi.listMaterials(),
      warehouseApi.listWarehouses(),
      branchApi.listBranchOptions(),
    ])
      .then(([materialsData, warehousesData, branchesData]) => {
        if (!cancelled) {
          setMaterials(materialsData);
          setWarehouses(warehousesData);
          setBranches(branchesData);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    void inventoryReportApi
      .listMovementSummary({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        materialId: materialId || undefined,
        warehouseId: warehouseId || undefined,
        branchId: branchId || undefined,
      })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "فشل تحميل ملخص الحركات.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate, materialId, warehouseId, branchId]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          movement_count: acc.movement_count + row.movement_count,
          quantity_in_base: acc.quantity_in_base + row.quantity_in_base,
          quantity_out_base: acc.quantity_out_base + row.quantity_out_base,
          total_value: acc.total_value + row.total_value,
        }),
        {
          movement_count: 0,
          quantity_in_base: 0,
          quantity_out_base: 0,
          total_value: 0,
        },
      ),
    [rows],
  );

  const csvRows = useMemo(
    () =>
      rows.map((row) => [
        COMMERCIAL_KIND_LABELS[row.commercial_kind] ?? row.commercial_kind,
        MOVEMENT_KIND_LABELS[row.movement_kind] ?? row.movement_kind,
        row.source_type,
        row.movement_count,
        row.quantity_in_base.toFixed(4),
        row.quantity_out_base.toFixed(4),
        row.total_value.toFixed(2),
      ]),
    [rows],
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ملخص حركات المخزون</h1>
          <p className="mt-1 text-sm text-slate-600">
            مجمّع per نوع حركة ونوع فاتورة (مبيعات، مشتريات، مناقلة، تسوية…).
          </p>
        </div>
        <ExportCsvButton
          filename="inventory-movements-summary"
          headers={[
            "نوع الفاتورة/المصدر",
            "نوع الحركة",
            "مصدر السجل",
            "عدد الحركات",
            "كمية وارد",
            "كمية صادر",
            "قيمة",
          ]}
          rows={csvRows}
          disabled={isLoading || rows.length === 0}
        />
      </div>

      <ReportsNav active="inventory-movements" />

      <section className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">من</span>
          <input
            type="date"
            className="rounded-md border border-slate-300 px-3 py-2"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">إلى</span>
          <input
            type="date"
            className="rounded-md border border-slate-300 px-3 py-2"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">المادة</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
          >
            <option value="">الكل</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.material_code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">المستودع</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">الكل</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.warehouse_code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[160px] flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">الفرع</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">الكل</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branch_code}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!isLoading && rows.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-4">
          <SummaryCard label="عدد الحركات" value={String(totals.movement_count)} />
          <SummaryCard
            label="إجمالي وارد (أساس)"
            value={totals.quantity_in_base.toFixed(4)}
          />
          <SummaryCard
            label="إجمالي صادر (أساس)"
            value={totals.quantity_out_base.toFixed(4)}
          />
          <SummaryCard label="إجمالي قيمة" value={totals.total_value.toFixed(2)} />
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}
        {!isLoading && !error && rows.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد حركات في الفترة — أو شغّل{" "}
            <code className="text-xs">patch_inventory_phase5.sql</code>.
          </p>
        )}
        {!isLoading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">نوع الفاتورة/المصدر</th>
                  <th className="border-b border-slate-200 p-2">نوع الحركة</th>
                  <th className="border-b border-slate-200 p-2">مصدر السجل</th>
                  <th className="border-b border-slate-200 p-2">عدد</th>
                  <th className="border-b border-slate-200 p-2">وارد</th>
                  <th className="border-b border-slate-200 p-2">صادر</th>
                  <th className="border-b border-slate-200 p-2">قيمة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.commercial_kind}-${row.movement_kind}-${row.source_type}`}
                    className="odd:bg-white even:bg-slate-50/60"
                  >
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {COMMERCIAL_KIND_LABELS[row.commercial_kind] ??
                        row.commercial_kind}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {MOVEMENT_KIND_LABELS[row.movement_kind] ?? row.movement_kind}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.source_type}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.movement_count}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.quantity_in_base.toFixed(4)}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.quantity_out_base.toFixed(4)}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.total_value.toFixed(2)}
                    </td>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
