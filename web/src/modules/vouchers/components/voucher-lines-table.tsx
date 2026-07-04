"use client";

import type {
  Account,
  CostCenter,
  VoucherLine,
  VoucherLineCategory,
  VoucherLineSide,
} from "@/modules/vouchers/types";
import { AccountSearchField, accountLineFallbackLabel } from "@/modules/vouchers/components/account-search-field";
import { CostCenterSearchField } from "@/modules/vouchers/components/cost-center-search-field";
import { VoucherLineCategoryFields } from "@/modules/vouchers/components/voucher-line-category-fields";

interface VoucherLinesTableProps {
  lines: VoucherLine[];
  accounts: Account[];
  costCenters?: CostCenter[];
  lineCategories?: VoucherLineCategory[];
  defaultCostCenterId?: string;
  readOnly: boolean;
  allowLineDelete?: boolean;
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
  line_category_id: null,
  category_quantity: null,
};

export function VoucherLinesTable({
  lines,
  accounts,
  costCenters = [],
  lineCategories = [],
  defaultCostCenterId = "",
  readOnly,
  allowLineDelete = true,
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
        cost_center_id: defaultCostCenterId || null,
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
        <h2 className="text-lg font-semibold text-slate-900">أسطر السند</h2>
        <button
          type="button"
          className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={addLine}
          disabled={readOnly}
        >
          إضافة سطر
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-right text-slate-700">
              <th className="border-b border-slate-200 p-2">الحساب</th>
              <th className="border-b border-slate-200 p-2">الطرف</th>
              <th className="border-b border-slate-200 p-2">المبلغ</th>
              {costCenters.length > 0 && (
                <th className="border-b border-slate-200 p-2">مركز الكلفة</th>
              )}
              <th className="border-b border-slate-200 p-2">نوع السطر</th>
              <th className="border-b border-slate-200 p-2">الوصف</th>
              <th className="border-b border-slate-200 p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="odd:bg-white even:bg-slate-50/60 align-top">
                <td className="border-b border-slate-100 p-2 min-w-[240px]">
                  <AccountSearchField
                    accounts={accounts}
                    value={line.account_id ?? ""}
                    fallbackLabel={accountLineFallbackLabel(line)}
                    hideLabel
                    onChange={(accountId, account) =>
                      updateLine(line.id, {
                        account_id: accountId,
                        account_code: account?.code ?? "",
                        account_name: account?.name_ar ?? "",
                      })
                    }
                    disabled={readOnly}
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
                    className="w-full rounded-md border border-slate-300 px-2 py-1"
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
                    className="w-full rounded-md border border-slate-300 px-2 py-1"
                  />
                </td>
                {costCenters.length > 0 && (
                  <td className="border-b border-slate-100 p-2 min-w-[200px]">
                    <CostCenterSearchField
                      costCenters={costCenters}
                      value={line.cost_center_id ?? defaultCostCenterId ?? ""}
                      hideLabel
                      onChange={(id) => updateLine(line.id, { cost_center_id: id || null })}
                      disabled={readOnly}
                    />
                  </td>
                )}
                <td className="min-w-[160px] border-b border-slate-100 p-2">
                  <VoucherLineCategoryFields
                    categories={lineCategories}
                    categoryId={line.line_category_id ?? ""}
                    quantity={line.category_quantity}
                    disabled={readOnly}
                    onCategoryChange={(categoryId) =>
                      updateLine(line.id, {
                        line_category_id: categoryId || null,
                        category_quantity: categoryId ? line.category_quantity : null,
                      })
                    }
                    onQuantityChange={(quantity) =>
                      updateLine(line.id, { category_quantity: quantity })
                    }
                  />
                </td>
                <td className="border-b border-slate-100 p-2">
                  <input
                    value={line.line_description ?? ""}
                    onChange={(event) =>
                      updateLine(line.id, { line_description: event.target.value })
                    }
                    disabled={readOnly}
                    className="w-full rounded-md border border-slate-300 px-2 py-1"
                    placeholder="وصف السطر"
                  />
                </td>
                <td className="border-b border-slate-100 p-2">
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    disabled={readOnly || !allowLineDelete}
                    className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:opacity-50"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={(costCenters.length > 0 ? 6 : 5) + 1}
                  className="border-b border-slate-100 p-4 text-center text-slate-500"
                >
                  لا توجد أسطر — استخدم الإدخال السريع أو «إضافة سطر».
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
