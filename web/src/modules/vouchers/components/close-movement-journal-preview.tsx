"use client";

import type { CloseMovementJournalPreviewEntry } from "@/modules/vouchers/utils/build-close-movement-journal-preview";

interface CloseMovementJournalPreviewProps {
  entries: CloseMovementJournalPreviewEntry[];
}

export function CloseMovementJournalPreview({
  entries,
}: CloseMovementJournalPreviewProps) {
  if (entries.length === 0) return null;

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/50 p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-sky-950">معاينة القيود الناتجة</h2>
        <p className="mt-0.5 text-xs text-sky-900/80">
          تقدير قبل الترحيل — قيد النقد/الذمم + قيود تسوية CC/فرع عند وجود مقاصة
        </p>
      </div>

      <div className="space-y-4">
        {entries.map((entry, index) => {
          const debitTotal = entry.lines
            .filter((line) => line.side === "debit")
            .reduce((sum, line) => sum + line.amount, 0);
          const creditTotal = entry.lines
            .filter((line) => line.side === "credit")
            .reduce((sum, line) => sum + line.amount, 0);
          const balanced = Math.abs(debitTotal - creditTotal) <= 0.001;

          return (
            <div
              key={`${entry.kind}-${index}`}
              className="rounded-md border border-sky-100 bg-white p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">{entry.title}</h3>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    balanced
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {balanced ? "متوازن" : "غير متوازن"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-xs">
                  <thead>
                    <tr className="text-right text-slate-600">
                      <th className="border-b border-slate-200 p-1.5">جانب</th>
                      <th className="border-b border-slate-200 p-1.5">حساب</th>
                      <th className="border-b border-slate-200 p-1.5">CC</th>
                      <th className="border-b border-slate-200 p-1.5">فرع</th>
                      <th className="border-b border-slate-200 p-1.5">مبلغ</th>
                      <th className="border-b border-slate-200 p-1.5">وصف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.lines.map((line, lineIndex) => (
                      <tr key={lineIndex} className="odd:bg-white even:bg-slate-50/60">
                        <td className="border-b border-slate-100 p-1.5">
                          {line.side === "debit" ? "مدين" : "دائن"}
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          <span className="font-mono">{line.account_code}</span>
                          <span className="ms-1 text-slate-600">{line.account_name}</span>
                        </td>
                        <td className="border-b border-slate-100 p-1.5 font-mono">
                          {line.cost_center_code ?? "—"}
                        </td>
                        <td className="border-b border-slate-100 p-1.5 font-mono">
                          {line.branch_code ?? "—"}
                        </td>
                        <td className="border-b border-slate-100 p-1.5 font-mono">
                          {line.amount.toFixed(2)}
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          {line.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
