"use client";

import type { VoucherLine, VoucherLineSide } from "@/modules/vouchers/types";

interface VoucherLinesTableProps {
  lines: VoucherLine[];
  readOnly: boolean;
  onChange: (lines: VoucherLine[]) => void;
}

const DEFAULT_LINE: VoucherLine = {
  id: crypto.randomUUID(),
  voucher_id: "draft",
  account_id: "",
  account_code: "",
  account_name: "",
  side: "debit",
  amount: 0,
  line_description: "",
};

export function VoucherLinesTable({
  lines,
  readOnly,
  onChange,
}: VoucherLinesTableProps) {
  const updateLine = (id: string, patch: Partial<VoucherLine>) => {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    onChange([
      ...lines,
      {
        ...DEFAULT_LINE,
        id: crypto.randomUUID(),
      },
    ]);
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((line) => line.id !== id));
  };

  const totalDebit = lines
    .filter((line) => line.side === "debit")
    .reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const totalCredit = lines
    .filter((line) => line.side === "credit")
    .reduce((sum, line) => sum + Number(line.amount || 0), 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">اسطر السند</h2>
        <button
          type="button"
          className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={addLine}
          disabled={readOnly}
        >
          اضافة سطر
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-right text-slate-700">
              <th className="border-b border-slate-200 p-2">الحساب</th>
              <th className="border-b border-slate-200 p-2">الطرف</th>
              <th className="border-b border-slate-200 p-2">المبلغ</th>
              <th className="border-b border-slate-200 p-2">الوصف</th>
              <th className="border-b border-slate-200 p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="odd:bg-white even:bg-slate-50/60">
                <td className="border-b border-slate-100 p-2">
                  <input
                    value={line.account_code ?? ""}
                    onChange={(event) =>
                      updateLine(line.id, { account_code: event.target.value })
                    }
                    disabled={readOnly}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-blue-900"
                    placeholder="كود الحساب"
                  />
                </td>
                <td className="border-b border-slate-100 p-2">
                  <select
                    value={line.side}
                    onChange={(event) =>
                      updateLine(line.id, {
                        side: event.target.value as VoucherLineSide,
                      })
                    }
                    disabled={readOnly}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-blue-900"
                  >
                    <option value="debit">مدين</option>
                    <option value="credit">دائن</option>
                  </select>
                </td>
                <td className="border-b border-slate-100 p-2 font-mono">
                  <input
                    type="number"
                    value={line.amount}
                    onChange={(event) =>
                      updateLine(line.id, { amount: Number(event.target.value) })
                    }
                    disabled={readOnly}
                    min={0}
                    step="0.01"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-blue-900"
                  />
                </td>
                <td className="border-b border-slate-100 p-2">
                  <input
                    value={line.line_description ?? ""}
                    onChange={(event) =>
                      updateLine(line.id, { line_description: event.target.value })
                    }
                    disabled={readOnly}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-blue-900"
                    placeholder="وصف السطر"
                  />
                </td>
                <td className="border-b border-slate-100 p-2">
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    disabled={readOnly}
                    className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 disabled:opacity-50"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="border-b border-slate-100 p-4 text-center text-slate-500"
                >
                  لا توجد اسطر بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <p className="font-mono">إجمالي المدين: {totalDebit.toFixed(2)}</p>
        <p className="font-mono">إجمالي الدائن: {totalCredit.toFixed(2)}</p>
        <p className="font-mono text-blue-900">
          الفرق: {(totalDebit - totalCredit).toFixed(2)}
        </p>
      </div>
    </section>
  );
}
