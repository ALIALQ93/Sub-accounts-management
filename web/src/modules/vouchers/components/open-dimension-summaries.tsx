"use client";

import type { DimensionOpenSummary } from "@/modules/vouchers/utils/open-movement-utils";

interface OpenDimensionSummariesProps {
  title: string;
  rows: DimensionOpenSummary[];
}

export function OpenDimensionSummaries({
  title,
  rows,
}: OpenDimensionSummariesProps) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-[var(--brand-navy)]">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="data-table min-w-[520px] text-xs">
          <thead>
            <tr>
              <th>الرمز</th>
              <th>مدين</th>
              <th>دائن</th>
              <th>صافٍ</th>
              <th>أسطر</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-mono tabular-nums">
                  {row.code ?? "—"}
                  {row.name ? (
                    <span className="ms-1 text-slate-500">{row.name}</span>
                  ) : null}
                </td>
                <td className="font-mono tabular-nums">
                  {row.debit_total.toFixed(2)}
                </td>
                <td className="font-mono tabular-nums">
                  {row.credit_total.toFixed(2)}
                </td>
                <td
                  className={`font-mono tabular-nums ${
                    row.net_open >= 0 ? "text-emerald-800" : "text-[var(--danger)]"
                  }`}
                >
                  {row.net_open.toFixed(2)}
                </td>
                <td className="tabular-nums">{row.line_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
