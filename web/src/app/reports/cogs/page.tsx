"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PrintReportButton } from "@/components/print-report-button";
import { branchApi, type BranchOption } from "@/modules/branches/services/branch-api";
import { materialApi } from "@/modules/materials/services/material-api";
import { warehouseApi } from "@/modules/materials/services/warehouse-api";
import { ReportsNav } from "@/modules/reports/components/reports-nav";
import {
  cogsReportApi,
  type CogsGroupBy,
  type CogsReportRow,
} from "@/modules/reports/services/cogs-report-api";

export default function CogsReportPage() {
  const [rows, setRows] = useState<CogsReportRow[]>([]);
  const [materials, setMaterials] = useState<
    Awaited<ReturnType<typeof materialApi.listMaterials>>
  >([]);
  const [warehouses, setWarehouses] = useState<
    Awaited<ReturnType<typeof warehouseApi.listWarehouses>>
  >([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [groupBy, setGroupBy] = useState<CogsGroupBy>("material");

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

    void cogsReportApi
      .listRows({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        materialId: materialId || undefined,
        warehouseId: warehouseId || undefined,
        branchId: branchId || undefined,
        groupBy,
      })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل تقرير COGS.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate, materialId, warehouseId, branchId, groupBy]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.group_key.toLowerCase().includes(q) ||
        (row.material_code ?? "").toLowerCase().includes(q) ||
        (row.material_name_ar ?? "").toLowerCase().includes(q) ||
        (row.invoice_no ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totals = useMemo(() => cogsReportApi.summarize(filtered), [filtered]);

  const csvRows = useMemo(
    () =>
      filtered.map((row) => [
        row.group_key,
        row.material_name_ar ?? "",
        row.invoice_date ?? "",
        row.sale_quantity_base.toFixed(4),
        row.return_quantity_base.toFixed(4),
        row.sales_amount.toFixed(2),
        row.cogs_amount.toFixed(2),
        row.return_cogs_amount.toFixed(2),
        row.net_cogs.toFixed(2),
      ]),
    [filtered],
  );

  return (
    <main className="report-print-area mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">تكلفة المبيعات (COGS)</h1>
        <p className="mt-1 text-sm text-slate-600">
          من حركات <code className="text-xs">sale</code> و{" "}
          <code className="text-xs">return_sale</code> عند ترحيل فواتير المبيعات —
          للجرد المستمر.
        </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <PrintReportButton
            documentTitle="تكلفة المبيعات"
            disabled={isLoading || filtered.length === 0}
          />
        <ExportCsvButton
          filename="cogs-report"
          headers={[
            "المفتاح",
            "الاسم",
            "التاريخ",
            "كمية مبيعات",
            "كمية مرتجع",
            "إيراد",
            "COGS",
            "مرتجع COGS",
            "صافي",
          ]}
          rows={csvRows}
          disabled={isLoading || filtered.length === 0}
        />
        </div>
      </div>

      <div className="no-print">
      <ReportsNav active="cogs" />
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">التجميع</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as CogsGroupBy)}
          >
            <option value="material">per مادة</option>
            <option value="invoice">per فاتورة</option>
          </select>
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
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">بحث</span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="مادة، فاتورة..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </section>

      {!isLoading && filtered.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-4">
          <SummaryCard label="مبيعات (إيراد)" value={totals.sales_amount.toFixed(2)} />
          <SummaryCard label="تكلفة مبيعات" value={totals.cogs_amount.toFixed(2)} />
          <SummaryCard label="مرتجع تكلفة" value={totals.return_cogs_amount.toFixed(2)} />
          <SummaryCard label="صافي COGS" value={totals.net_cogs.toFixed(2)} />
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد حركات مبيعات/مرتجع في الفترة — أو شغّل{" "}
            <code className="text-xs">patch_inventory_phase4.sql</code>.
          </p>
        )}
        {!isLoading && !error && filtered.length > 0 && (
          <CogsTable rows={filtered} groupBy={groupBy} />
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

function CogsTable({
  rows,
  groupBy,
}: {
  rows: CogsReportRow[];
  groupBy: CogsGroupBy;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[960px]">
        <thead>
          <tr>
            <th>{groupBy === "invoice" ? "فاتورة" : "مادة"}</th>
            {groupBy === "material" && <th>الاسم</th>}
            {groupBy === "invoice" && <th>التاريخ</th>}
            <th>كمية مبيعات</th>
            <th>كمية مرتجع</th>
            <th>إيراد</th>
            <th>COGS</th>
            <th>مرتجع COGS</th>
            <th>صافي</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.group_key}-${row.material_id ?? row.invoice_id ?? ""}`}
              className="odd:bg-white even:bg-slate-50/60"
            >
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {groupBy === "invoice" && row.invoice_id ? (
                  <Link
                    href={`/invoices/${row.invoice_id}`}
                    className="text-blue-800 underline"
                  >
                    {row.group_key}
                  </Link>
                ) : (
                  row.group_key
                )}
              </td>
              {groupBy === "material" && (
                <td className="border-b border-slate-100 p-2 text-xs">
                  {row.material_name_ar ?? "—"}
                </td>
              )}
              {groupBy === "invoice" && (
                <td className="border-b border-slate-100 p-2 font-mono text-xs">
                  {row.invoice_date ?? "—"}
                </td>
              )}
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.sale_quantity_base.toFixed(4)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.return_quantity_base.toFixed(4)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.sales_amount.toFixed(2)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.cogs_amount.toFixed(2)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs">
                {row.return_cogs_amount.toFixed(2)}
              </td>
              <td className="border-b border-slate-100 p-2 font-mono text-xs font-semibold">
                {row.net_cogs.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
