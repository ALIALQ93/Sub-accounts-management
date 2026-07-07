"use client";

import { useEffect, useMemo, useState } from "react";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PrintReportButton } from "@/components/print-report-button";
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
    <main className="report-print-area mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">ملخص حركات المخزون</h1>
          <p className="mt-1 text-sm text-slate-600">
            مجمّع per نوع حركة ونوع فاتورة (مبيعات، مشتريات، مناقلة، تسوية…).
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <PrintReportButton
            documentTitle="ملخص حركات المخزون"
            disabled={isLoading || rows.length === 0}
          />
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
      </div>

      <div className="no-print">
      <ReportsNav active="inventory-movements" />
      </div>

      <section className="no-print flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
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

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد حركات في الفترة — أو شغّل{" "}
            <code className="text-xs">patch_inventory_phase5.sql</code>.
          </p>
        )}
        {!isLoading && !error && rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[880px]">
              <thead>
                <tr>
                  <th>نوع الفاتورة/المصدر</th>
                  <th>نوع الحركة</th>
                  <th>مصدر السجل</th>
                  <th>عدد</th>
                  <th>وارد</th>
                  <th>صادر</th>
                  <th>قيمة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.commercial_kind}-${row.movement_kind}-${row.source_type}`}
                  >
                    <td className="text-xs">
                      {COMMERCIAL_KIND_LABELS[row.commercial_kind] ??
                        row.commercial_kind}
                    </td>
                    <td className="text-xs">
                      {MOVEMENT_KIND_LABELS[row.movement_kind] ?? row.movement_kind}
                    </td>
                    <td className="font-mono text-xs text-slate-500">
                      {row.source_type}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {row.movement_count}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {row.quantity_in_base.toFixed(4)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {row.quantity_out_base.toFixed(4)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--brand-navy)]">
        {value}
      </p>
    </div>
  );
}
