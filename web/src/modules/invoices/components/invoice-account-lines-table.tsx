"use client";

import type { Account } from "@/modules/vouchers/types";
import type { InvoiceAccountLineInput } from "@/modules/invoices/services/invoice-api";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";

export type DraftAccountLine = InvoiceAccountLineInput & {
  clientId: string;
};

interface InvoiceAccountLinesTableProps {
  lines: DraftAccountLine[];
  accounts: Account[];
  defaultBranchId: string;
  defaultCostCenterId: string;
  readOnly: boolean;
  onChange: (lines: DraftAccountLine[]) => void;
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100";

function newLine(
  defaults: Pick<DraftAccountLine, "branch_id" | "cost_center_id">,
  lineNo: number,
): DraftAccountLine {
  return {
    clientId: crypto.randomUUID(),
    line_no: lineNo,
    branch_id: defaults.branch_id,
    cost_center_id: defaults.cost_center_id,
    account_id: "",
    side: "debit",
    amount: 0,
    description: null,
  };
}

export function InvoiceAccountLinesTable({
  lines,
  accounts,
  defaultBranchId,
  defaultCostCenterId,
  readOnly,
  onChange,
}: InvoiceAccountLinesTableProps) {
  const updateLine = (clientId: string, patch: Partial<DraftAccountLine>) => {
    onChange(
      lines.map((line) =>
        line.clientId === clientId ? { ...line, ...patch } : line,
      ),
    );
  };

  const addLine = () => {
    onChange([
      ...lines,
      newLine(
        {
          branch_id: defaultBranchId,
          cost_center_id: defaultCostCenterId || null,
        },
        lines.length + 1,
      ),
    ]);
  };

  const removeLine = (clientId: string) => {
    const next = lines
      .filter((line) => line.clientId !== clientId)
      .map((line, index) => ({ ...line, line_no: index + 1 }));
    onChange(next);
  };

  const debitTotal = lines
    .filter((l) => l.side === "debit")
    .reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const creditTotal = lines
    .filter((l) => l.side === "credit")
    .reduce((sum, l) => sum + Number(l.amount || 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-right text-slate-700">
              <th className="border border-slate-200 p-2">#</th>
              <th className="border border-slate-200 p-2">الحساب</th>
              <th className="border border-slate-200 p-2">الجانب</th>
              <th className="border border-slate-200 p-2">المبلغ</th>
              <th className="border border-slate-200 p-2">البيان</th>
              {!readOnly && <th className="border border-slate-200 p-2" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.clientId} className="odd:bg-white even:bg-slate-50/60">
                <td className="border border-slate-100 p-2">{line.line_no}</td>
                <td className="border border-slate-100 p-2 min-w-[240px]">
                  <AccountSearchField
                    hideLabel
                    accounts={accounts}
                    value={line.account_id}
                    onChange={(accountId) =>
                      updateLine(line.clientId, { account_id: accountId })
                    }
                    disabled={readOnly}
                  />
                </td>
                <td className="border border-slate-100 p-2">
                  <select
                    disabled={readOnly}
                    className={inputClass}
                    value={line.side}
                    onChange={(e) =>
                      updateLine(line.clientId, {
                        side: e.target.value as "debit" | "credit",
                      })
                    }
                  >
                    <option value="debit">مدين</option>
                    <option value="credit">دائن</option>
                  </select>
                </td>
                <td className="border border-slate-100 p-2">
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    disabled={readOnly}
                    className={inputClass}
                    value={line.amount}
                    onChange={(e) =>
                      updateLine(line.clientId, {
                        amount: Number(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td className="border border-slate-100 p-2">
                  <input
                    disabled={readOnly}
                    className={inputClass}
                    value={line.description ?? ""}
                    onChange={(e) =>
                      updateLine(line.clientId, {
                        description: e.target.value || null,
                      })
                    }
                  />
                </td>
                {!readOnly && (
                  <td className="border border-slate-100 p-2">
                    <button
                      type="button"
                      onClick={() => removeLine(line.clientId)}
                      className="text-xs text-red-600"
                    >
                      حذف
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 5 : 6}
                  className="border border-slate-100 p-4 text-center text-slate-500"
                >
                  لا توجد أسطر حسابات إضافية.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!readOnly && (
          <button
            type="button"
            onClick={addLine}
            className="rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-800"
          >
            + سطر حساب
          </button>
        )}
        <p className="text-sm text-slate-700">
          مدين: <span className="font-mono">{debitTotal.toFixed(2)}</span>
          {" · "}
          دائن: <span className="font-mono">{creditTotal.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
