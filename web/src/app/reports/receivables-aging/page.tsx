"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReportsNav } from "@/modules/reports/components/reports-nav";
import {
  BUCKET_LABELS,
  openItemsReportApi,
  type AgingBucketKey,
  type AgingOpenItemRow,
} from "@/modules/reports/services/open-items-report-api";

type PartyFilter = "customer" | "vendor" | "all";
type ViewMode = "detail" | "by-party";

const BUCKET_ORDER: AgingBucketKey[] = [
  "current",
  "days_1_30",
  "days_31_60",
  "days_61_90",
  "days_90_plus",
  "no_due_date",
];

export default function ReceivablesAgingPage() {
  const [partyFilter, setPartyFilter] = useState<PartyFilter>("customer");
  const [viewMode, setViewMode] = useState<ViewMode>("by-party");
  const [rows, setRows] = useState<AgingOpenItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    void openItemsReportApi
      .listAgingRows({
        partyType: partyFilter === "all" ? undefined : partyFilter,
      })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "فشل تحميل تقرير أعمار الذمم.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [partyFilter]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.entry_no.toLowerCase().includes(q) ||
        (row.party_name_ar ?? "").toLowerCase().includes(q) ||
        (row.account_code ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const bucketTotals = useMemo(
    () => openItemsReportApi.summarizeByBucket(filteredRows),
    [filteredRows],
  );

  const partySummaries = useMemo(() => {
    const summaries = openItemsReportApi.summarizeByParty(filteredRows);
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((row) =>
      (row.party_name_ar ?? "").toLowerCase().includes(q),
    );
  }, [filteredRows, query]);

  const grandTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.open_amount, 0),
    [filteredRows],
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          أعمار الذمم
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          حركات مفتوحة من <code className="text-xs">open_items_view</code> —
          حسب تاريخ الاستحقاق. مرتبط بفواتير آجل وإغلاق الحركات.
        </p>
      </div>

      <ReportsNav active="receivables-aging" />

      <section className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">نوع الطرف</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value as PartyFilter)}
          >
            <option value="customer">عملاء (ذمم مدينة)</option>
            <option value="vendor">موردون (ذمم دائنة)</option>
            <option value="all">الكل</option>
          </select>
        </label>
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">بحث</span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="رقم قيد، طرف، حساب..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">العرض</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
          >
            <option value="by-party">مجمّع حسب الطرف</option>
            <option value="detail">تفصيلي (كل حركة)</option>
          </select>
        </label>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BUCKET_ORDER.map((bucket) => (
          <div
            key={bucket}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <p className="text-xs text-slate-600">{BUCKET_LABELS[bucket]}</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
              {bucketTotals[bucket].toFixed(2)}
            </p>
          </div>
        ))}
        <div className="rounded-xl border border-[var(--brand-navy)]/20 bg-[var(--brand-navy)]/5 p-3 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-xs text-[var(--brand-navy)]">الإجمالي</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--brand-navy)]">
            {grandTotal.toFixed(2)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        {!isLoading && !error && filteredRows.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد حركات مفتوحة — تأكد من تشغيل{" "}
            <code className="text-xs">patch_settlement_foundation.sql</code>.
          </p>
        )}
        {!isLoading && !error && filteredRows.length > 0 && viewMode === "by-party" && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[960px]">
              <thead>
                <tr>
                  <th>الطرف</th>
                  <th>النوع</th>
                  {BUCKET_ORDER.map((bucket) => (
                    <th key={bucket}>{BUCKET_LABELS[bucket]}</th>
                  ))}
                  <th>الإجمالي</th>
                  <th>حركات</th>
                </tr>
              </thead>
              <tbody>
                {partySummaries.map((row) => (
                  <tr
                    key={row.party_id ?? row.party_name_ar ?? "unknown"}
                    className="odd:bg-white even:bg-slate-50/60"
                  >
                    <td className="border-b border-slate-100 p-2">
                      {row.party_name_ar ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {row.party_type === "customer"
                        ? "عميل"
                        : row.party_type === "vendor"
                          ? "مورد"
                          : "—"}
                    </td>
                    {BUCKET_ORDER.map((bucket) => (
                      <td
                        key={bucket}
                        className="border-b border-slate-100 p-2 font-mono text-xs"
                      >
                        {row.totals[bucket] > 0
                          ? row.totals[bucket].toFixed(2)
                          : "—"}
                      </td>
                    ))}
                    <td className="border-b border-slate-100 p-2 font-mono font-semibold">
                      {row.grand_total.toFixed(2)}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-center text-xs">
                      {row.line_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && filteredRows.length > 0 && viewMode === "detail" && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[960px]">
              <thead>
                <tr>
                  <th>القيد</th>
                  <th>الطرف</th>
                  <th>الحساب</th>
                  <th>CC</th>
                  <th>الاستحقاق</th>
                  <th>الفئة</th>
                  <th>المفتوح</th>
                  <th>فاتورة</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.journal_line_id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono text-xs">
                      {row.entry_no}
                      <span className="block text-slate-500">{row.entry_date}</span>
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {row.party_name_ar ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {row.account_code ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {row.cost_center_code ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {row.due_date ?? "—"}
                      {row.days_overdue != null && row.days_overdue > 0 && (
                        <span className="block text-rose-700">
                          +{row.days_overdue} يوم
                        </span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {row.bucket_label}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {row.open_amount.toFixed(2)}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {row.source_invoice_id ? (
                        <Link
                          href={`/invoices/${row.source_invoice_id}`}
                          className="text-blue-800 hover:underline"
                        >
                          عرض
                        </Link>
                      ) : (
                        "—"
                      )}
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
