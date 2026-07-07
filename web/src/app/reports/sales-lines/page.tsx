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
  SALES_COMMERCIAL_KIND_LABELS,
  salesLinesReportApi,
  type SalesLineReportRow,
} from "@/modules/reports/services/sales-lines-report-api";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Customer } from "@/modules/vouchers/types";

export default function SalesLinesReportPage() {
  const [rows, setRows] = useState<SalesLineReportRow[]>([]);
  const [materials, setMaterials] = useState<
    Awaited<ReturnType<typeof materialApi.listMaterials>>
  >([]);
  const [warehouses, setWarehouses] = useState<
    Awaited<ReturnType<typeof warehouseApi.listWarehouses>>
  >([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [includeReturns, setIncludeReturns] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      materialApi.listMaterials(),
      warehouseApi.listWarehouses(),
      branchApi.listBranchOptions(),
      voucherApi.listCustomers(),
    ])
      .then(([materialsData, warehousesData, branchesData, customersData]) => {
        if (!cancelled) {
          setMaterials(materialsData);
          setWarehouses(warehousesData);
          setBranches(branchesData);
          setCustomers(customersData);
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

    void salesLinesReportApi
      .listRows({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        customerId: customerId || undefined,
        materialId: materialId || undefined,
        warehouseId: warehouseId || undefined,
        branchId: branchId || undefined,
        includeReturns,
      })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل تقرير المبيعات.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    fromDate,
    toDate,
    customerId,
    materialId,
    warehouseId,
    branchId,
    includeReturns,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.invoice_no.toLowerCase().includes(q) ||
        row.material_code.toLowerCase().includes(q) ||
        row.material_name_ar.toLowerCase().includes(q) ||
        row.customer_name_ar.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totals = useMemo(
    () => salesLinesReportApi.summarize(filtered),
    [filtered],
  );

  const csvRows = useMemo(
    () =>
      filtered.map((row) => [
        row.invoice_no,
        row.invoice_date,
        SALES_COMMERCIAL_KIND_LABELS[row.commercial_kind] ?? row.commercial_kind,
        row.customer_name_ar,
        row.material_code,
        row.warehouse_code,
        row.quantity_base.toFixed(4),
        row.unit_price.toFixed(4),
        row.discount_amount.toFixed(2),
        row.line_amount.toFixed(2),
      ]),
    [filtered],
  );

  return (
    <main className="report-print-area mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">تقرير المبيعات التفصيلي</h1>
          <p className="mt-1 text-sm text-slate-600">
            أسطر فواتير مبيعات ومرتجع مبيعات — مرحّلة فقط. يكمّل تقرير{" "}
            <Link href="/reports/cogs" className="text-blue-800 underline">
              COGS
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintReportButton
            documentTitle="تقرير المبيعات"
            disabled={isLoading || filtered.length === 0}
          />
          <ExportCsvButton
            filename="sales-lines"
            headers={[
              "فاتورة",
              "تاريخ",
              "النوع",
              "عميل",
              "مادة",
              "مستودع",
              "كمية",
              "سعر",
              "خصم",
              "مبلغ",
            ]}
            rows={csvRows}
            disabled={isLoading || filtered.length === 0}
          />
        </div>
      </div>

      <div className="no-print">
        <ReportsNav active="sales-lines" />
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
          <span className="font-medium text-slate-700">العميل</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">الكل</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name_ar}
              </option>
            ))}
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
            placeholder="فاتورة، مادة، عميل..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={includeReturns}
            onChange={(e) => setIncludeReturns(e.target.checked)}
          />
          <span>تضمين مرتجع المبيعات</span>
        </label>
      </section>

      {!isLoading && filtered.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-4">
          <SummaryCard label="عدد الأسطر" value={String(totals.line_count)} />
          <SummaryCard
            label="إجمالي كمية"
            value={totals.quantity_base.toFixed(4)}
          />
          <SummaryCard label="إجمالي خصم" value={totals.discount_amount.toFixed(2)} />
          <SummaryCard label="إجمالي مبلغ" value={totals.line_amount.toFixed(2)} />
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 hidden text-lg font-bold print:block">
          تقرير المبيعات التفصيلي
        </h2>
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد أسطر مطابقة — أو شغّل{" "}
            <code className="text-xs">patch_inventory_phase7.sql</code>.
          </p>
        )}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[1080px]">
              <thead>
                <tr>
                  <th>فاتورة</th>
                  <th>تاريخ</th>
                  <th>النوع</th>
                  <th>عميل</th>
                  <th>مادة</th>
                  <th>مستودع</th>
                  <th>كمية</th>
                  <th>سعر</th>
                  <th>خصم</th>
                  <th>مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={`${row.invoice_id}-${row.material_id}-${row.warehouse_code}-${row.quantity_base}`}
                    className="odd:bg-white even:bg-slate-50/60"
                  >
                    <td className="border-b border-slate-100 p-2">
                      <Link
                        href={`/invoices/${row.invoice_id}`}
                        className="font-mono text-xs text-blue-800 underline print:text-black print:no-underline"
                      >
                        {row.invoice_no}
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.invoice_date}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {SALES_COMMERCIAL_KIND_LABELS[row.commercial_kind] ??
                        row.commercial_kind}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {row.customer_name_ar}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      <span className="font-mono text-xs">{row.material_code}</span>
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.warehouse_code}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.quantity_base.toFixed(4)}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.unit_price.toFixed(4)}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.discount_amount.toFixed(2)}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.line_amount.toFixed(2)}
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
