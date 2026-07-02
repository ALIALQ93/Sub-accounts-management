"use client";

import { useMemo } from "react";
import type {
  Account,
  CostCenter,
  VoucherLine,
  VoucherLineCategory,
  VoucherLineSide,
} from "@/modules/vouchers/types";
import type { Currency } from "@/modules/currencies/types";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { CostCenterSearchField } from "@/modules/vouchers/components/cost-center-search-field";
import { VoucherLineCategoryFields } from "@/modules/vouchers/components/voucher-line-category-fields";
import { formatVoucherAmount } from "@/modules/vouchers/utils/voucher-currency-utils";
import { computeCostCenterBalances } from "@/modules/vouchers/utils/voucher-cost-center-utils";

interface SettlementVoucherLinesTableProps {
  lines: VoucherLine[];
  accounts: Account[];
  costCenters: CostCenter[];
  lineCategories: VoucherLineCategory[];
  currencies: Currency[];
  voucherCurrencyId: string;
  amountStep: string;
  readOnly: boolean;
  onChange: (lines: VoucherLine[]) => void;
}

function newUserLine(side: VoucherLineSide = "debit"): VoucherLine {
  return {
    id: crypto.randomUUID(),
    voucher_id: "draft",
    account_id: "",
    account_code: "",
    account_name: "",
    side,
    amount: 0,
    line_description: "",
    cost_center_id: null,
    line_category_id: null,
    category_quantity: null,
  };
}

function oppositeSide(side: VoucherLineSide): VoucherLineSide {
  return side === "debit" ? "credit" : "debit";
}

export function SettlementVoucherLinesTable({
  lines,
  accounts,
  costCenters,
  lineCategories,
  currencies,
  voucherCurrencyId,
  amountStep,
  readOnly,
  onChange,
}: SettlementVoucherLinesTableProps) {
  const selectedCurrency = useMemo(
    () => currencies.find((currency) => currency.id === voucherCurrencyId),
    [currencies, voucherCurrencyId],
  );

  const updateLine = (id: string, patch: Partial<VoucherLine>) => {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addLine = (side: VoucherLineSide = "debit") => {
    onChange([...lines, newUserLine(side)]);
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

  const costCenterBalances = useMemo(
    () => computeCostCenterBalances(lines, costCenters),
    [lines, costCenters],
  );

  const hasUnbalancedCostCenters = costCenterBalances.some(
    (row) => Math.abs(row.difference) > 0.000001,
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">أسطر السند</h2>
          <p className="text-xs text-slate-500">
            سند تصفية — كل سطر يُولّد معه سطر مقابل على الحساب الوسيط (مدين
            ↔ دائن). يجب أن يتوازن المدين والدائن لكل مركز كلفة
            {selectedCurrency ? ` (${selectedCurrency.code})` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => addLine("debit")}
            disabled={readOnly}
          >
            سطر مدين
          </button>
          <button
            type="button"
            className="rounded-md border border-blue-900 px-3 py-2 text-sm font-medium text-blue-900 disabled:opacity-60"
            onClick={() => addLine("credit")}
            disabled={readOnly}
          >
            سطر دائن
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-right text-slate-700">
              <th className="border-b border-slate-200 p-2">الطرف</th>
              <th className="border-b border-slate-200 p-2">الحساب</th>
              <th className="border-b border-slate-200 p-2">المبلغ</th>
              <th className="border-b border-slate-200 p-2">مركز الكلفة *</th>
              <th className="border-b border-slate-200 p-2">نوع السطر</th>
              <th className="border-b border-slate-200 p-2">الوصف</th>
              <th className="border-b border-slate-200 p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="align-top odd:bg-white even:bg-slate-50/60">
                <td className="border-b border-slate-100 p-2">
                  <select
                    value={line.side}
                    onChange={(event) =>
                      updateLine(line.id, {
                        side: event.target.value as VoucherLineSide,
                      })
                    }
                    disabled={readOnly}
                    className="w-full min-w-[100px] rounded-md border border-slate-300 px-2 py-1"
                  >
                    <option value="debit">مدين</option>
                    <option value="credit">دائن</option>
                  </select>
                </td>
                <td className="min-w-[240px] border-b border-slate-100 p-2">
                  <AccountSearchField
                    accounts={accounts}
                    currencies={currencies}
                    filterCurrencyId={voucherCurrencyId || undefined}
                    value={line.account_id ?? ""}
                    hideLabel
                    onChange={(accountId, account) =>
                      updateLine(line.id, {
                        account_id: accountId,
                        account_code: account?.code ?? "",
                        account_name: account?.name_ar ?? "",
                      })
                    }
                    disabled={readOnly || !voucherCurrencyId}
                  />
                </td>
                <td className="border-b border-slate-100 p-2 font-mono">
                  <input
                    type="number"
                    value={line.amount || ""}
                    onChange={(event) =>
                      updateLine(line.id, { amount: Number(event.target.value) })
                    }
                    disabled={readOnly}
                    min={0}
                    step={amountStep}
                    className="w-full min-w-[120px] rounded-md border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="min-w-[200px] border-b border-slate-100 p-2">
                  <CostCenterSearchField
                    costCenters={costCenters}
                    value={line.cost_center_id ?? ""}
                    hideLabel
                    required
                    onChange={(id) =>
                      updateLine(line.id, { cost_center_id: id || null })
                    }
                    disabled={readOnly}
                  />
                </td>
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
                    disabled={readOnly}
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
                  colSpan={7}
                  className="border-b border-slate-100 p-4 text-center text-slate-500"
                >
                  أضف سطراً مديناً أو دائنًا (حساب مقابل + مبلغ + مركز كلفة).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 rounded-md bg-blue-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p className="font-mono text-blue-900">
          إجمالي مدين الأسطر: {formatVoucherAmount(totalDebit, selectedCurrency)}
        </p>
        <p className="font-mono text-blue-900">
          إجمالي دائن الأسطر: {formatVoucherAmount(totalCredit, selectedCurrency)}
        </p>
        <p className="font-mono text-blue-900">
          مدين الحساب الوسيط (تلقائي):{" "}
          {formatVoucherAmount(totalCredit, selectedCurrency)}
        </p>
        <p className="font-mono text-blue-900">
          دائن الحساب الوسيط (تلقائي):{" "}
          {formatVoucherAmount(totalDebit, selectedCurrency)}
        </p>
      </div>

      {costCenterBalances.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="text-right text-slate-700">
                <th className="border-b border-slate-200 p-2">مركز الكلفة</th>
                <th className="border-b border-slate-200 p-2">مدين</th>
                <th className="border-b border-slate-200 p-2">دائن</th>
                <th className="border-b border-slate-200 p-2">الفرق</th>
              </tr>
            </thead>
            <tbody>
              {costCenterBalances.map((row) => {
                const balanced = Math.abs(row.difference) <= 0.000001;
                const label =
                  row.costCenterCode && row.costCenterName
                    ? `${row.costCenterCode} — ${row.costCenterName}`
                    : row.costCenterName ?? "بدون مركز";
                return (
                  <tr
                    key={row.costCenterId ?? "none"}
                    className={balanced ? "text-slate-800" : "bg-amber-50 text-amber-900"}
                  >
                    <td className="border-b border-slate-100 p-2">{label}</td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {formatVoucherAmount(row.totalDebit, selectedCurrency)}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {formatVoucherAmount(row.totalCredit, selectedCurrency)}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {balanced
                        ? "✓ متوازن"
                        : formatVoucherAmount(Math.abs(row.difference), selectedCurrency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasUnbalancedCostCenters && (
            <p className="border-t border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              يجب أن يتساوى المدين والدائن داخل كل مركز كلفة قبل الترحيل.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function detectClearingAccountId(
  dbLines: VoucherLine[],
  fallbackClearingAccountId = "",
): string {
  if (
    fallbackClearingAccountId &&
    dbLines.some((line) => line.account_id === fallbackClearingAccountId)
  ) {
    return fallbackClearingAccountId;
  }

  const counts = new Map<string, number>();
  for (const line of dbLines) {
    if (!line.account_id) continue;
    counts.set(line.account_id, (counts.get(line.account_id) ?? 0) + 1);
  }

  let bestId = fallbackClearingAccountId;
  let bestCount = 0;
  for (const [accountId, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestId = accountId;
    }
  }

  return bestId;
}

export function splitSettlementVoucherLines(
  dbLines: VoucherLine[],
  fallbackClearingAccountId = "",
): { clearingAccountId: string; userLines: VoucherLine[] } {
  const clearingAccountId = detectClearingAccountId(
    dbLines,
    fallbackClearingAccountId,
  );

  const userLines = dbLines
    .filter((line) => line.account_id !== clearingAccountId)
    .map((line) => ({
      ...line,
      side: line.side as VoucherLineSide,
    }));

  return { clearingAccountId, userLines };
}

export function buildSettlementVoucherLinesForSave(
  clearingAccountId: string,
  userLines: VoucherLine[],
): VoucherLine[] {
  const validUserLines = userLines.filter(
    (line) => line.account_id && Number(line.amount || 0) > 0,
  );

  if (!clearingAccountId) {
    return validUserLines;
  }

  const pairedLines: VoucherLine[] = [];

  for (const userLine of validUserLines) {
    const amount = Number(userLine.amount);
    const description = userLine.line_description?.trim();
    const sideLabel = userLine.side === "debit" ? "مدين" : "دائن";

    pairedLines.push({
      ...userLine,
      side: userLine.side,
    });

    pairedLines.push({
      id: crypto.randomUUID(),
      voucher_id: "draft",
      account_id: clearingAccountId,
      side: oppositeSide(userLine.side),
      amount,
      line_description: description
        ? `تصفية — ${description}`
        : `تصفية — مقابل ${sideLabel}`,
      cost_center_id: null,
      line_category_id: null,
      category_quantity: null,
    });
  }

  return pairedLines;
}
