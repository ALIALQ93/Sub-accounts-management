"use client";

import { useMemo } from "react";
import type { Account, CostCenter, VoucherLine, VoucherLineCategory } from "@/modules/vouchers/types";
import type { Currency } from "@/modules/currencies/types";
import { AccountSearchField, accountLineFallbackLabel } from "@/modules/vouchers/components/account-search-field";
import { CostCenterSearchField } from "@/modules/vouchers/components/cost-center-search-field";
import { VoucherLineCategoryFields } from "@/modules/vouchers/components/voucher-line-category-fields";
import { formatVoucherAmount } from "@/modules/vouchers/utils/voucher-currency-utils";

interface ReceiptVoucherLinesTableProps {
  lines: VoucherLine[];
  accounts: Account[];
  costCenters: CostCenter[];
  lineCategories: VoucherLineCategory[];
  currencies: Currency[];
  voucherCurrencyId: string;
  amountStep: string;
  readOnly: boolean;
  allowLineDelete?: boolean;
  onChange: (lines: VoucherLine[]) => void;
}

function newCreditLine(): VoucherLine {
  return {
    id: crypto.randomUUID(),
    voucher_id: "draft",
    account_id: "",
    account_code: "",
    account_name: "",
    side: "credit",
    amount: 0,
    line_description: "",
    cost_center_id: null,
    line_category_id: null,
    category_quantity: null,
  };
}

export function ReceiptVoucherLinesTable({
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
}: ReceiptVoucherLinesTableProps) {
  const selectedCurrency = useMemo(
    () => currencies.find((currency) => currency.id === voucherCurrencyId),
    [currencies, voucherCurrencyId],
  );

  const updateLine = (id: string, patch: Partial<VoucherLine>) => {
    onChange(
      lines.map((line) =>
        line.id === id ? { ...line, ...patch, side: "credit" as const } : line,
      ),
    );
  };

  const addLine = () => {
    onChange([...lines, newCreditLine()]);
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((line) => line.id !== id));
  };

  const totalCredit = lines.reduce(
    (sum, line) => sum + Number(line.amount || 0),
    0,
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--brand-navy)]">أسطر الدائن</h2>
          <p className="text-xs text-slate-500">
            سند قبض — كل سطر دائن يُولّد معه سطر مدين على حساب القبض بنفس
            المبلغ ومركز الكلفة
            {selectedCurrency ? ` (${selectedCurrency.code})` : ""}.
          </p>
        </div>
        <button
          type="button"
          className="btn bg-emerald-700 text-white shadow-sm hover:bg-emerald-600"
          onClick={addLine}
          disabled={readOnly}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          إضافة سطر
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="data-table min-w-[820px]">
          <thead>
            <tr>
              <th>الحساب (دائن)</th>
              <th>المبلغ</th>
              <th>مركز الكلفة</th>
              <th>نوع السطر</th>
              <th>الوصف</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="align-top">
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
                    value={line.amount || ""}
                    onChange={(event) =>
                      updateLine(line.id, { amount: Number(event.target.value) })
                    }
                    disabled={readOnly}
                    min={0}
                    step={amountStep}
                    className="w-full min-w-[120px] rounded-md border border-slate-300 px-2 py-1 tabular-nums"
                  />
                </td>
                <td className="min-w-[200px]">
                  <CostCenterSearchField
                    costCenters={costCenters}
                    value={line.cost_center_id ?? ""}
                    hideLabel
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
                        category_quantity: categoryId ? line.category_quantity : null,
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
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  أضف سطراً دائنًا (حساب مقابل + مبلغ + مركز كلفة).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 rounded-md bg-emerald-50 p-3 text-sm sm:grid-cols-2">
        <p className="font-mono tabular-nums text-emerald-900">
          إجمالي الدائن: {formatVoucherAmount(totalCredit, selectedCurrency)}
        </p>
        <p className="font-mono tabular-nums text-emerald-900">
          مدين حساب القبض (تلقائي):{" "}
          {formatVoucherAmount(totalCredit, selectedCurrency)}
        </p>
      </div>
    </section>
  );
}

export function splitReceiptVoucherLines(
  dbLines: VoucherLine[],
  fallbackReceiptAccountId = "",
): { receiptAccountId: string; creditLines: VoucherLine[] } {
  const debitLines = dbLines.filter((line) => line.side === "debit");
  const creditLines = dbLines
    .filter((line) => line.side === "credit")
    .map((line) => ({ ...line, side: "credit" as const }));

  const receiptAccountId =
    debitLines[0]?.account_id ?? fallbackReceiptAccountId;

  return { receiptAccountId, creditLines };
}

export function buildReceiptVoucherLinesForSave(
  receiptAccountId: string,
  creditLines: VoucherLine[],
): VoucherLine[] {
  const validCredits = creditLines.filter(
    (line) => line.account_id && Number(line.amount || 0) > 0,
  );

  if (!receiptAccountId) {
    return validCredits.map((line) => ({ ...line, side: "credit" as const }));
  }

  const pairedLines: VoucherLine[] = [];

  for (const credit of validCredits) {
    const amount = Number(credit.amount);
    const description = credit.line_description?.trim();

    pairedLines.push({
      id: crypto.randomUUID(),
      voucher_id: "draft",
      account_id: receiptAccountId,
      side: "debit",
      amount,
      line_description: description ? `قبض — ${description}` : "قبض — حساب القبض",
      cost_center_id: credit.cost_center_id ?? null,
      line_category_id: null,
      category_quantity: null,
    });

    pairedLines.push({
      ...credit,
      side: "credit",
    });
  }

  return pairedLines;
}
