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
    <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="text-right text-slate-600">
              <th className="border-b border-slate-200 p-1.5">الرمز</th>
              <th className="border-b border-slate-200 p-1.5">مدين</th>
              <th className="border-b border-slate-200 p-1.5">دائن</th>
              <th className="border-b border-slate-200 p-1.5">صافٍ</th>
              <th className="border-b border-slate-200 p-1.5">أسطر</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="odd:bg-white even:bg-slate-50/60">
                <td className="border-b border-slate-100 p-1.5 font-mono">
                  {row.code ?? "—"}
                  {row.name ? (
                    <span className="ms-1 text-slate-500">{row.name}</span>
                  ) : null}
                </td>
                <td className="border-b border-slate-100 p-1.5 font-mono">
                  {row.debit_total.toFixed(2)}
                </td>
                <td className="border-b border-slate-100 p-1.5 font-mono">
                  {row.credit_total.toFixed(2)}
                </td>
                <td
                  className={`border-b border-slate-100 p-1.5 font-mono ${
                    row.net_open >= 0 ? "text-emerald-800" : "text-rose-800"
                  }`}
                >
                  {row.net_open.toFixed(2)}
                </td>
                <td className="border-b border-slate-100 p-1.5">{row.line_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
