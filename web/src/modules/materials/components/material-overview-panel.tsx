"use client";

import { useEffect, useState } from "react";
import { inventoryReportApi } from "@/modules/reports/services/inventory-report-api";
import type { InventoryBalanceRow } from "@/modules/reports/services/inventory-report-api";

interface MaterialOverviewPanelProps {
  materialId: string;
  minStock: number;
  maxStock: number;
}

export function MaterialOverviewPanel({
  materialId,
  minStock,
  maxStock,
}: MaterialOverviewPanelProps) {
  const [rows, setRows] = useState<InventoryBalanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    void inventoryReportApi
      .listBalanceRows({ materialId, hideZero: false })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل أرصدة المخزون.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const totals = rows.reduce(
    (acc, row) => ({
      quantity_base: acc.quantity_base + row.quantity_base,
      inventory_value: acc.inventory_value + row.inventory_value,
    }),
    { quantity_base: 0, inventory_value: 0 },
  );

  if (isLoading) {
    return <p className="text-sm text-slate-600">جاري تحميل أرصدة المخزون...</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="إجمالي الكمية (وحدة أساس)" value={totals.quantity_base.toFixed(4)} />
        <SummaryCard label="قيمة المخزون" value={totals.inventory_value.toFixed(4)} />
        <SummaryCard
          label="الحد الأدنى"
          value={minStock > 0 ? minStock.toFixed(4) : "—"}
        />
        <SummaryCard
          label="الحد الأعلى"
          value={maxStock > 0 ? maxStock.toFixed(4) : "—"}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">لا توجد أرصدة مخزون لهذه المادة.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="text-right text-slate-700">
                <th className="border-b border-slate-200 p-2">المستودع</th>
                <th className="border-b border-slate-200 p-2">الفرع</th>
                <th className="border-b border-slate-200 p-2">الكمية (أساس)</th>
                <th className="border-b border-slate-200 p-2">متوسط التكلفة</th>
                <th className="border-b border-slate-200 p-2">قيمة المخزون</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.warehouse_id}-${row.material_id}`}
                  className="odd:bg-white even:bg-slate-50/60"
                >
                  <td className="border-b border-slate-100 p-2">
                    <span className="font-mono text-xs text-slate-500">
                      {row.warehouse_code}
                    </span>
                    <span className="block font-medium">{row.warehouse_name_ar}</span>
                  </td>
                  <td className="border-b border-slate-100 p-2 font-mono text-xs">
                    {row.branch_code}
                  </td>
                  <td className="border-b border-slate-100 p-2 font-mono tabular-nums">
                    {row.quantity_base.toFixed(4)}
                  </td>
                  <td className="border-b border-slate-100 p-2 font-mono tabular-nums">
                    {row.unit_cost_avg == null ? "—" : row.unit_cost_avg.toFixed(4)}
                  </td>
                  <td className="border-b border-slate-100 p-2 font-mono tabular-nums">
                    {row.inventory_value.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
        {value}
      </p>
    </article>
  );
}
