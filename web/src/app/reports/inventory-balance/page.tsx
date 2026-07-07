"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExportCsvButton } from "@/components/export-csv-button";
import { branchApi, type BranchOption } from "@/modules/branches/services/branch-api";
import { materialApi } from "@/modules/materials/services/material-api";
import { warehouseMaterialLimitsApi } from "@/modules/materials/services/warehouse-material-limits-api";
import { warehouseApi } from "@/modules/materials/services/warehouse-api";
import type { MaterialCategory } from "@/modules/materials/types";
import { ReportsNav } from "@/modules/reports/components/reports-nav";
import {
  ANALYSIS_KIND_LABELS,
  inventoryReportApi,
  MOVEMENT_KIND_LABELS,
  type InventoryAnalysisRow,
  type InventoryBalanceRow,
  type InventoryMovementLedgerRow,
} from "@/modules/reports/services/inventory-report-api";

type ViewMode = "balance" | "ledger" | "analysis";

export default function InventoryBalanceReportPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("balance");
  const [balanceRows, setBalanceRows] = useState<InventoryBalanceRow[]>([]);
  const [ledgerRows, setLedgerRows] = useState<InventoryMovementLedgerRow[]>([]);
  const [analysisRows, setAnalysisRows] = useState<InventoryAnalysisRow[]>([]);
  const [materials, setMaterials] = useState<
    Awaited<ReturnType<typeof materialApi.listMaterials>>
  >([]);
  const [warehouses, setWarehouses] = useState<
    Awaited<ReturnType<typeof warehouseApi.listWarehouses>>
  >([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [warehouseLimits, setWarehouseLimits] = useState<
    Awaited<ReturnType<typeof warehouseMaterialLimitsApi.listAll>>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [asOfDate, setAsOfDate] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [hideZero, setHideZero] = useState(true);
  const [shortageMaxQty, setShortageMaxQty] = useState("0");
  const [stagnantDays, setStagnantDays] = useState("90");
  const [preferMaterialMinStock, setPreferMaterialMinStock] = useState(true);
  const [analysisKind, setAnalysisKind] = useState<"all" | "shortage" | "stagnant">("all");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      materialApi.listMaterials(),
      warehouseApi.listWarehouses(),
      branchApi.listBranchOptions(),
      materialApi.listMaterialCategories(),
      warehouseMaterialLimitsApi.listAll(),
    ])
      .then(([materialsData, warehousesData, branchesData, categoriesData, limitsData]) => {
        if (!cancelled) {
          setMaterials(materialsData);
          setWarehouses(warehousesData);
          setBranches(branchesData);
          setCategories(categoriesData);
          setWarehouseLimits(limitsData);
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

    const load =
      viewMode === "balance"
        ? inventoryReportApi.listBalanceRows({
            asOfDate: asOfDate || undefined,
            materialId: materialId || undefined,
            warehouseId: warehouseId || undefined,
            branchId: branchId || undefined,
            categoryId: categoryId || undefined,
            hideZero,
          })
        : viewMode === "ledger"
          ? inventoryReportApi.listMovementLedger({
              fromDate: fromDate || undefined,
              toDate: toDate || undefined,
              materialId: materialId || undefined,
              warehouseId: warehouseId || undefined,
              branchId: branchId || undefined,
            })
          : Promise.all([
              inventoryReportApi.listAnalysisRows({
                asOfDate: asOfDate || undefined,
                shortageMaxQty: Number(shortageMaxQty),
                stagnantDays: Number(stagnantDays),
                warehouseId: warehouseId || undefined,
                branchId: branchId || undefined,
              }),
              preferMaterialMinStock
                ? inventoryReportApi.listBalanceRows({
                    asOfDate: asOfDate || undefined,
                    materialId: materialId || undefined,
                    warehouseId: warehouseId || undefined,
                    branchId: branchId || undefined,
                    hideZero: false,
                  })
                : Promise.resolve([] as InventoryBalanceRow[]),
            ]);

    void load
      .then((data) => {
        if (cancelled) return;
        if (viewMode === "balance") {
          setBalanceRows(data as InventoryBalanceRow[]);
        } else if (viewMode === "ledger") {
          setLedgerRows(data as InventoryMovementLedgerRow[]);
        } else {
          const [analysisData, balanceData] = data as [
            InventoryAnalysisRow[],
            InventoryBalanceRow[],
          ];
          if (preferMaterialMinStock && balanceData.length > 0) {
            const minShortage = inventoryReportApi.listBelowMinStockRows(
              balanceData,
              materials,
              warehouseLimits,
            );
            const stagnant = analysisData.filter(
              (row) => row.analysis_kind === "stagnant",
            );
            const globalShortage = analysisData.filter(
              (row) =>
                row.analysis_kind === "shortage" &&
                (row.min_stock == null || row.min_stock <= 0),
            );
            const merged = new Map<string, InventoryAnalysisRow>();
            for (const row of [...minShortage, ...globalShortage, ...stagnant]) {
              merged.set(
                `${row.analysis_kind}-${row.material_id}-${row.warehouse_id}`,
                row,
              );
            }
            setAnalysisRows([...merged.values()]);
          } else {
            setAnalysisRows(analysisData);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "فشل تحميل تقرير المخزون.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    viewMode,
    asOfDate,
    fromDate,
    toDate,
    materialId,
    warehouseId,
    branchId,
    categoryId,
    hideZero,
    shortageMaxQty,
    stagnantDays,
    preferMaterialMinStock,
    materials,
    warehouseLimits,
  ]);

  const filteredBalance = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return balanceRows;
    return balanceRows.filter(
      (row) =>
        row.material_code.toLowerCase().includes(q) ||
        row.material_name_ar.toLowerCase().includes(q) ||
        row.warehouse_code.toLowerCase().includes(q) ||
        (row.category_name_ar ?? "").toLowerCase().includes(q),
    );
  }, [balanceRows, query]);

  const filteredLedger = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ledgerRows;
    return ledgerRows.filter(
      (row) =>
        row.material_code.toLowerCase().includes(q) ||
        row.material_name_ar.toLowerCase().includes(q) ||
        row.warehouse_code.toLowerCase().includes(q) ||
        (MOVEMENT_KIND_LABELS[row.movement_kind] ?? row.movement_kind)
          .toLowerCase()
          .includes(q),
    );
  }, [ledgerRows, query]);

  const filteredAnalysis = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = analysisRows;
    if (analysisKind !== "all") {
      rows = rows.filter((row) => row.analysis_kind === analysisKind);
    }
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.material_code.toLowerCase().includes(q) ||
        row.material_name_ar.toLowerCase().includes(q) ||
        row.warehouse_code.toLowerCase().includes(q),
    );
  }, [analysisRows, query, analysisKind]);

  const totals = useMemo(
    () => inventoryReportApi.summarizeTotals(filteredBalance),
    [filteredBalance],
  );

  const exportConfig = useMemo(() => {
    if (viewMode === "balance") {
      return {
        filename: "inventory-balance",
        headers: [
          "المادة",
          "المستودع",
          "الفرع",
          "كمية أساس",
          "متوسط تكلفة",
          "قيمة",
        ],
        rows: filteredBalance.map((row) => [
          row.material_code,
          row.warehouse_code,
          row.branch_code,
          row.quantity_base.toFixed(4),
          row.unit_cost_avg?.toFixed(4) ?? "",
          row.inventory_value.toFixed(2),
        ]),
      };
    }
    if (viewMode === "ledger") {
      return {
        filename: "inventory-ledger",
        headers: ["التاريخ", "النوع", "المادة", "كمية", "رصيد", "قيمة"],
        rows: filteredLedger.map((row) => [
          row.movement_date,
          MOVEMENT_KIND_LABELS[row.movement_kind] ?? row.movement_kind,
          row.material_code,
          row.quantity_base_delta.toFixed(4),
          row.running_balance_base.toFixed(4),
          row.line_value.toFixed(2),
        ]),
      };
    }
    return {
      filename: "inventory-analysis",
      headers: ["النوع", "المادة", "مستودع", "كمية", "حد أدنى", "قيمة"],
      rows: filteredAnalysis.map((row) => [
        ANALYSIS_KIND_LABELS[row.analysis_kind] ?? row.analysis_kind,
        row.material_code,
        row.warehouse_code,
        row.quantity_base.toFixed(4),
        row.min_stock != null && row.min_stock > 0
          ? row.min_stock.toFixed(4)
          : "",
        row.inventory_value.toFixed(2),
      ]),
    };
  }, [viewMode, filteredBalance, filteredLedger, filteredAnalysis]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="text-2xl font-bold text-slate-900">رصيد المخزون</h1>
        <p className="mt-1 text-sm text-slate-600">
          كميات وقيم تقديرية من <code className="text-xs">inventory_movements</code>{" "}
          — per مادة ومستودع.         للتسوية الجردية استخدم{" "}
        <Link href="/materials/stock-adjustment/batch" className="text-blue-800 underline">
          تسوية مجمّعة
        </Link>
        {" "}أو{" "}
        <Link href="/materials/stock-adjustment/new" className="text-blue-800 underline">
          سطر واحد
        </Link>
          .
        </p>
        </div>
        <ExportCsvButton
          filename={exportConfig.filename}
          headers={exportConfig.headers}
          rows={exportConfig.rows}
          disabled={isLoading}
        />
      </div>

      <ReportsNav active="inventory-balance" />

      <section className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">العرض</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
          >
            <option value="balance">رصيد مجمّع</option>
            <option value="ledger">دفتر حركة</option>
            <option value="analysis">نواقص / راكد</option>
          </select>
        </label>

        {(viewMode === "balance" || viewMode === "analysis") ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">حتى تاريخ</span>
            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </label>
        ) : (
          <>
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
          </>
        )}

        {viewMode === "analysis" && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">حد النقص (≤)</span>
              <input
                type="number"
                step="0.0001"
                className="rounded-md border border-slate-300 px-3 py-2 font-mono"
                value={shortageMaxQty}
                onChange={(e) => setShortageMaxQty(e.target.value)}
                disabled={preferMaterialMinStock}
              />
              <span className="text-xs text-slate-500">
                للمواد بدون حد أدنى في البطاقة
              </span>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={preferMaterialMinStock}
                onChange={(e) => setPreferMaterialMinStock(e.target.checked)}
              />
              <span>أولوية لحدّ المستودع/البطاقة (min_stock)</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">راكد (أيام بدون حركة)</span>
              <input
                type="number"
                min={1}
                className="rounded-md border border-slate-300 px-3 py-2 font-mono"
                value={stagnantDays}
                onChange={(e) => setStagnantDays(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">نوع التحليل</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={analysisKind}
                onChange={(e) =>
                  setAnalysisKind(e.target.value as typeof analysisKind)
                }
              >
                <option value="all">الكل</option>
                <option value="shortage">نقص فقط</option>
                <option value="stagnant">راكد فقط</option>
              </select>
            </label>
          </>
        )}

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
                {material.material_code} — {material.name_ar}
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
                {warehouse.warehouse_code} — {warehouse.name_ar}
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

        {viewMode === "balance" && (
          <label className="flex min-w-[160px] flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">الصنف</span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">الكل</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category_code}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">بحث</span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="رمز مادة، مستودع..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {viewMode === "balance" && (
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
            />
            <span>إخفاء الأرصدة الصفرية</span>
          </label>
        )}
      </section>

      {viewMode === "balance" && !isLoading && filteredBalance.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="عدد الأصناف/مستودعات" value={String(totals.line_count)} />
          <SummaryCard
            label="إجمالي الكمية (أساس)"
            value={totals.quantity_base.toFixed(4)}
          />
          <SummaryCard
            label="قيمة تقديرية"
            value={totals.inventory_value.toFixed(2)}
          />
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}

        {!isLoading && !error && viewMode === "balance" && (
          <BalanceTable rows={filteredBalance} />
        )}
        {!isLoading && !error && viewMode === "ledger" && (
          <LedgerTable rows={filteredLedger} />
        )}
        {!isLoading && !error && viewMode === "analysis" && (
          <AnalysisTable rows={filteredAnalysis} />
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

function BalanceTable({ rows }: { rows: InventoryBalanceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        لا توجد حركات مخزنية مطابقة — أو شغّل{" "}
        <code className="text-xs">patch_inventory_reports.sql</code>.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr className="text-right text-slate-700">
            <th className="border-b border-slate-200 p-2">المادة</th>
            <th className="border-b border-slate-200 p-2">المستودع</th>
            <th className="border-b border-slate-200 p-2">الفرع</th>
            <th className="border-b border-slate-200 p-2">الصنف</th>
            <th className="border-b border-slate-200 p-2">كمية أساس</th>
            <th className="border-b border-slate-200 p-2">متوسط تكلفة</th>
            <th className="border-b border-slate-200 p-2">قيمة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.material_id}-${row.warehouse_id}`}
              className="odd:bg-white even:bg-slate-50/60"
            >
              <td className="border-b border-slate-100 p-2">
                <span className="font-mono text-xs">{row.material_code}</span>
                <span className="block">{row.material_name_ar}</span>
              </td>
              <td className="border-b border-slate-100 p-2">
                {row.warehouse_code} — {row.warehouse_name_ar}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.branch_code}
              </td>
              <td className="border-b border-slate-100 p-2 text-xs">
                {row.category_name_ar ?? "—"}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono">
                {row.quantity_base.toFixed(4)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.unit_cost_avg != null ? row.unit_cost_avg.toFixed(4) : "—"}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono">
                {row.inventory_value.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalysisTable({ rows }: { rows: InventoryAnalysisRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">لا توجد مواد مطابقة لمعايير النقص/الركود.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr className="text-right text-slate-700">
            <th className="border-b border-slate-200 p-2">النوع</th>
            <th className="border-b border-slate-200 p-2">المادة</th>
            <th className="border-b border-slate-200 p-2">المستودع</th>
            <th className="border-b border-slate-200 p-2">كمية</th>
            <th className="border-b border-slate-200 p-2">حد أدنى</th>
            <th className="border-b border-slate-200 p-2">قيمة</th>
            <th className="border-b border-slate-200 p-2">آخر حركة</th>
            <th className="border-b border-slate-200 p-2">أيام خاملة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.analysis_kind}-${row.material_id}-${row.warehouse_id}`}
              className="odd:bg-white even:bg-slate-50/60"
            >
              <td className="border-b border-slate-100 p-2 text-xs">
                {ANALYSIS_KIND_LABELS[row.analysis_kind] ?? row.analysis_kind}
              </td>
              <td className="border-b border-slate-100 p-2">
                <span className="font-mono text-xs">{row.material_code}</span>
                <span className="block">{row.material_name_ar}</span>
              </td>
              <td className="border-b border-slate-100 p-2 text-xs">
                {row.warehouse_code}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono">
                {row.quantity_base.toFixed(4)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.min_stock != null && row.min_stock > 0
                  ? row.min_stock.toFixed(4)
                  : "—"}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.inventory_value.toFixed(2)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.last_movement_date ?? "—"}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.days_idle ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LedgerTable({ rows }: { rows: InventoryMovementLedgerRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">لا توجد حركات في الفترة المحددة.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr className="text-right text-slate-700">
            <th className="border-b border-slate-200 p-2">التاريخ</th>
            <th className="border-b border-slate-200 p-2">النوع</th>
            <th className="border-b border-slate-200 p-2">المادة</th>
            <th className="border-b border-slate-200 p-2">المستودع</th>
            <th className="border-b border-slate-200 p-2">كمية</th>
            <th className="border-b border-slate-200 p-2">رصيد</th>
            <th className="border-b border-slate-200 p-2">قيمة</th>
            <th className="border-b border-slate-200 p-2">قيد</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.movement_id} className="odd:bg-white even:bg-slate-50/60">
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.movement_date}
              </td>
              <td className="border-b border-slate-100 p-2 text-xs">
                {MOVEMENT_KIND_LABELS[row.movement_kind] ?? row.movement_kind}
              </td>
              <td className="border-b border-slate-100 p-2">
                <span className="font-mono text-xs">{row.material_code}</span>
              </td>
              <td className="border-b border-slate-100 p-2 text-xs">
                {row.warehouse_code}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono">
                {row.quantity_base_delta.toFixed(4)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono">
                {row.running_balance_base.toFixed(4)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.line_value.toFixed(2)}
              </td>
              <td className="border-b border-slate-100 p-2">
                {row.source_type === "stock_adjustment" ? (
                  <Link
                    href={`/journals/${row.source_id}`}
                    className="text-xs text-blue-800 underline"
                  >
                    القيد
                  </Link>
                ) : row.source_type === "invoice" ? (
                  <Link
                    href={`/invoices/${row.source_id}`}
                    className="text-xs text-blue-800 underline"
                  >
                    الفاتورة
                  </Link>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
