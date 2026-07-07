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
import { AccountSearchField, accountLineFallbackLabel } from "@/modules/vouchers/components/account-search-field";
import { CostCenterSearchField } from "@/modules/vouchers/components/cost-center-search-field";
import { VoucherLineCategoryFields } from "@/modules/vouchers/components/voucher-line-category-fields";
import { formatVoucherAmount } from "@/modules/vouchers/utils/voucher-currency-utils";
import { computeCostCenterBalances } from "@/modules/vouchers/utils/voucher-cost-center-utils";

export interface SettlementUserLine {
  id: string;
  voucher_id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  debit_amount: number;
  credit_amount: number;
  line_description: string | null;
  cost_center_id: string | null;
  line_category_id: string | null;
  category_quantity: number | null;
}

interface SettlementVoucherLinesTableProps {
  lines: SettlementUserLine[];
  accounts: Account[];
  costCenters: CostCenter[];
  lineCategories: VoucherLineCategory[];
  currencies: Currency[];
  voucherCurrencyId: string;
  amountStep: string;
  readOnly: boolean;
  allowLineDelete?: boolean;
  onChange: (lines: SettlementUserLine[]) => void;
}

function newUserLine(): SettlementUserLine {
  return {
    id: crypto.randomUUID(),
    voucher_id: "draft",
    account_id: "",
    account_code: "",
    account_name: "",
    debit_amount: 0,
    credit_amount: 0,
    line_description: "",
    cost_center_id: null,
    line_category_id: null,
    category_quantity: null,
  };
}

function oppositeSide(side: VoucherLineSide): VoucherLineSide {
  return side === "debit" ? "credit" : "debit";
}

export function settlementLineHasAmount(line: SettlementUserLine): boolean {
  return (
    Number(line.debit_amount || 0) > 0 || Number(line.credit_amount || 0) > 0
  );
}

export function settlementLineHasBothSides(line: SettlementUserLine): boolean {
  return (
    Number(line.debit_amount || 0) > 0 && Number(line.credit_amount || 0) > 0
  );
}

export function isValidSettlementUserLine(line: SettlementUserLine): boolean {
  if (!line.account_id || !line.cost_center_id) return false;
  if (settlementLineHasBothSides(line)) return false;
  return settlementLineHasAmount(line);
}

export function toCostCenterBalanceLines(
  lines: SettlementUserLine[],
): Array<{
  side: VoucherLineSide;
  amount: number;
  cost_center_id: string | null;
}> {
  const expanded: Array<{
    side: VoucherLineSide;
    amount: number;
    cost_center_id: string | null;
  }> = [];

  for (const line of lines) {
    const debit = Number(line.debit_amount || 0);
    const credit = Number(line.credit_amount || 0);
    if (debit > 0) {
      expanded.push({
        side: "debit",
        amount: debit,
        cost_center_id: line.cost_center_id,
      });
    }
    if (credit > 0) {
      expanded.push({
        side: "credit",
        amount: credit,
        cost_center_id: line.cost_center_id,
      });
    }
  }

  return expanded;
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
  allowLineDelete = true,
  onChange,
}: SettlementVoucherLinesTableProps) {
  const selectedCurrency = useMemo(
    () => currencies.find((currency) => currency.id === voucherCurrencyId),
    [currencies, voucherCurrencyId],
  );

  const updateLine = (id: string, patch: Partial<SettlementUserLine>) => {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    onChange([...lines, newUserLine()]);
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((line) => line.id !== id));
  };

  const totalDebit = lines.reduce(
    (sum, line) => sum + Number(line.debit_amount || 0),
    0,
  );

  const totalCredit = lines.reduce(
    (sum, line) => sum + Number(line.credit_amount || 0),
    0,
  );

  const costCenterBalances = useMemo(
    () => computeCostCenterBalances(toCostCenterBalanceLines(lines), costCenters),
    [lines, costCenters],
  );

  const hasUnbalancedCostCenters = costCenterBalances.some(
    (row) => Math.abs(row.difference) > 0.000001,
  );

  const hasDualSideRows = lines.some((line) => settlementLineHasBothSides(line));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--brand-navy)]">أسطر السند</h2>
          <p className="text-xs text-slate-500">
            أدخل المبلغ في عمود المدين أو الدائن لكل سطر (وليس الاثنين معاً).
            يُولَّد سطر مقابل تلقائياً على الحساب الوسيط. يجب توازن مراكز الكلفة
            {selectedCurrency ? ` (${selectedCurrency.code})` : ""}.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={addLine}
          disabled={readOnly}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          إضافة سطر
        </button>
      </div>

      {hasDualSideRows && (
        <p className="mb-3 rounded-md border border-[var(--danger)]/25 bg-[var(--danger)]/8 p-2 text-xs text-[var(--danger)]">
          لا يمكن تعبئة المدين والدائن في نفس السطر. اختر أحدهما فقط.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="data-table min-w-[980px]">
          <thead>
            <tr>
              <th>الحساب</th>
              <th>مدين</th>
              <th>دائن</th>
              <th>مركز الكلفة *</th>
              <th>نوع السطر</th>
              <th>الوصف</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const dualSide = settlementLineHasBothSides(line);
              return (
                <tr
                  key={line.id}
                  className={`align-top ${dualSide ? "bg-rose-50/80" : ""}`}
                >
                  <td className="min-w-[240px]">
                    <AccountSearchField
                      accounts={accounts}
                      currencies={currencies}
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
                  <td className="font-mono">
                    <input
                      type="number"
                      value={line.debit_amount || ""}
                      onChange={(event) =>
                        updateLine(line.id, {
                          debit_amount: Number(event.target.value),
                        })
                      }
                      disabled={readOnly}
                      min={0}
                      step={amountStep}
                      className="w-full min-w-[110px] rounded-md border border-slate-300 px-2 py-1 tabular-nums"
                      placeholder="0"
                    />
                  </td>
                  <td className="font-mono">
                    <input
                      type="number"
                      value={line.credit_amount || ""}
                      onChange={(event) =>
                        updateLine(line.id, {
                          credit_amount: Number(event.target.value),
                        })
                      }
                      disabled={readOnly}
                      min={0}
                      step={amountStep}
                      className="w-full min-w-[110px] rounded-md border border-slate-300 px-2 py-1 tabular-nums"
                      placeholder="0"
                    />
                  </td>
                  <td className="min-w-[200px]">
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
                  <td className="min-w-[160px]">
                    <VoucherLineCategoryFields
                      categories={lineCategories}
                      categoryId={line.line_category_id ?? ""}
                      quantity={line.category_quantity}
                      disabled={readOnly}
                      onCategoryChange={(categoryId) =>
                        updateLine(line.id, {
                          line_category_id: categoryId || null,
                          category_quantity: categoryId
                            ? line.category_quantity
                            : null,
                        })
                      }
                      onQuantityChange={(quantity) =>
                        updateLine(line.id, { category_quantity: quantity })
                      }
                    />
                  </td>
                  <td>
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
                  <td>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      disabled={readOnly || !allowLineDelete}
                      className="btn btn-sm btn-outline text-[var(--danger)] disabled:opacity-50"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  أضف سطراً (حساب + مدين أو دائن + مركز كلفة).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 rounded-md bg-[var(--brand-navy)]/5 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p className="font-mono tabular-nums text-[var(--brand-navy)]">
          إجمالي مدين الأسطر: {formatVoucherAmount(totalDebit, selectedCurrency)}
        </p>
        <p className="font-mono tabular-nums text-[var(--brand-navy)]">
          إجمالي دائن الأسطر: {formatVoucherAmount(totalCredit, selectedCurrency)}
        </p>
        <p className="font-mono tabular-nums text-[var(--brand-navy)]">
          مدين الحساب الوسيط (تلقائي):{" "}
          {formatVoucherAmount(totalCredit, selectedCurrency)}
        </p>
        <p className="font-mono tabular-nums text-[var(--brand-navy)]">
          دائن الحساب الوسيط (تلقائي):{" "}
          {formatVoucherAmount(totalDebit, selectedCurrency)}
        </p>
      </div>

      {costCenterBalances.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="data-table min-w-[480px]">
            <thead>
              <tr>
                <th>مركز الكلفة</th>
                <th>مدين</th>
                <th>دائن</th>
                <th>الفرق</th>
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
                    <td>{label}</td>
                    <td className="font-mono tabular-nums">
                      {formatVoucherAmount(row.totalDebit, selectedCurrency)}
                    </td>
                    <td className="font-mono tabular-nums">
                      {formatVoucherAmount(row.totalCredit, selectedCurrency)}
                    </td>
                    <td className="font-mono tabular-nums">
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

function dbLineToSettlementUserLine(line: VoucherLine): SettlementUserLine {
  const amount = Number(line.amount || 0);
  return {
    id: line.id,
    voucher_id: line.voucher_id,
    account_id: line.account_id,
    account_code: line.account_code,
    account_name: line.account_name,
    debit_amount: line.side === "debit" ? amount : 0,
    credit_amount: line.side === "credit" ? amount : 0,
    line_description: line.line_description,
    cost_center_id: line.cost_center_id ?? null,
    line_category_id: line.line_category_id ?? null,
    category_quantity: line.category_quantity ?? null,
  };
}

export function splitSettlementVoucherLines(
  dbLines: VoucherLine[],
  fallbackClearingAccountId = "",
): { clearingAccountId: string; userLines: SettlementUserLine[] } {
  const clearingAccountId = detectClearingAccountId(
    dbLines,
    fallbackClearingAccountId,
  );

  const userLines = dbLines
    .filter(
      (line) => line.account_id !== clearingAccountId && !line.cc_optional,
    )
    .map(dbLineToSettlementUserLine);

  return { clearingAccountId, userLines };
}

function pushUserDbLine(
  pairedLines: VoucherLine[],
  userLine: SettlementUserLine,
  side: VoucherLineSide,
  amount: number,
): void {
  pairedLines.push({
    id: crypto.randomUUID(),
    voucher_id: userLine.voucher_id,
    account_id: userLine.account_id,
    account_code: userLine.account_code,
    account_name: userLine.account_name,
    side,
    amount,
    line_description: userLine.line_description?.trim() || null,
    cost_center_id: userLine.cost_center_id,
    line_category_id: userLine.line_category_id,
    category_quantity: userLine.category_quantity,
  });
}

function pushClearingDbLine(
  pairedLines: VoucherLine[],
  clearingAccountId: string,
  side: VoucherLineSide,
  amount: number,
  description: string | null,
): void {
  pairedLines.push({
    id: crypto.randomUUID(),
    voucher_id: "draft",
    account_id: clearingAccountId,
    side,
    amount,
    line_description: description,
    cost_center_id: null,
    line_category_id: null,
    category_quantity: null,
    cc_optional: true,
  });
}

export function buildSettlementVoucherLinesForSave(
  clearingAccountId: string,
  userLines: SettlementUserLine[],
): VoucherLine[] {
  const validUserLines = userLines.filter(isValidSettlementUserLine);

  if (!clearingAccountId) {
    return validUserLines.flatMap((line) => {
      const result: VoucherLine[] = [];
      const debit = Number(line.debit_amount || 0);
      const credit = Number(line.credit_amount || 0);
      if (debit > 0) pushUserDbLine(result, line, "debit", debit);
      if (credit > 0) pushUserDbLine(result, line, "credit", credit);
      return result;
    });
  }

  const pairedLines: VoucherLine[] = [];

  for (const userLine of validUserLines) {
    const debit = Number(userLine.debit_amount || 0);
    const credit = Number(userLine.credit_amount || 0);
    const description = userLine.line_description?.trim();

    if (debit > 0) {
      pushUserDbLine(pairedLines, userLine, "debit", debit);
      pushClearingDbLine(
        pairedLines,
        clearingAccountId,
        oppositeSide("debit"),
        debit,
        description || "سطر تصفية — مدين",
      );
    }

    if (credit > 0) {
      pushUserDbLine(pairedLines, userLine, "credit", credit);
      pushClearingDbLine(
        pairedLines,
        clearingAccountId,
        oppositeSide("credit"),
        credit,
        description || "سطر تصفية — دائن",
      );
    }
  }

  return pairedLines;
}
