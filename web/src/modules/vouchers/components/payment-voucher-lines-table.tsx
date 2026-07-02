"use client";

import { useMemo } from "react";
import type { Account, CostCenter, VoucherLine, VoucherLineCategory } from "@/modules/vouchers/types";
import type { Currency } from "@/modules/currencies/types";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { CostCenterSearchField } from "@/modules/vouchers/components/cost-center-search-field";
import { VoucherLineCategoryFields } from "@/modules/vouchers/components/voucher-line-category-fields";
import { formatVoucherAmount } from "@/modules/vouchers/utils/voucher-currency-utils";

interface PaymentVoucherLinesTableProps {
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

function newDebitLine(): VoucherLine {
  return {
    id: crypto.randomUUID(),
    voucher_id: "draft",
    account_id: "",
    account_code: "",
    account_name: "",
    side: "debit",
    amount: 0,
    line_description: "",
    cost_center_id: null,
    line_category_id: null,
    category_quantity: null,
  };
}

export function PaymentVoucherLinesTable({
  lines,
  accounts,
  costCenters,
  lineCategories,
  currencies,
  voucherCurrencyId,
  amountStep,
  readOnly,
  onChange,
}: PaymentVoucherLinesTableProps) {
  const selectedCurrency = useMemo(
    () => currencies.find((currency) => currency.id === voucherCurrencyId),
    [currencies, voucherCurrencyId],
  );

  const updateLine = (id: string, patch: Partial<VoucherLine>) => {
    onChange(
      lines.map((line) =>
        line.id === id ? { ...line, ...patch, side: "debit" as const } : line,
      ),
    );
  };

  const addLine = () => {
    onChange([...lines, newDebitLine()]);
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((line) => line.id !== id));
  };

  const totalDebit = lines.reduce(
    (sum, line) => sum + Number(line.amount || 0),
    0,
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">أسطر المدين</h2>
          <p className="text-xs text-slate-500">
            سند دفع — كل سطر مدين يُولّد معه سطر دائن على حساب الدفع بنفس
            المبلغ ومركز الكلفة
            {selectedCurrency ? ` (${selectedCurrency.code})` : ""}.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-rose-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={addLine}
          disabled={readOnly}
        >
          إضافة سطر
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-right text-slate-700">
              <th className="border-b border-slate-200 p-2">الحساب (مدين)</th>
              <th className="border-b border-slate-200 p-2">المبلغ</th>
              <th className="border-b border-slate-200 p-2">مركز الكلفة</th>
              <th className="border-b border-slate-200 p-2">نوع السطر</th>
              <th className="border-b border-slate-200 p-2">الوصف</th>
              <th className="border-b border-slate-200 p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="align-top odd:bg-white even:bg-slate-50/60">
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
                  colSpan={6}
                  className="border-b border-slate-100 p-4 text-center text-slate-500"
                >
                  أضف سطراً مديناً (حساب مقابل + مبلغ + مركز كلفة).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 rounded-md bg-rose-50 p-3 text-sm sm:grid-cols-2">
        <p className="font-mono text-rose-900">
          إجمالي المدين: {formatVoucherAmount(totalDebit, selectedCurrency)}
        </p>
        <p className="font-mono text-rose-900">
          دائن حساب الدفع (تلقائي):{" "}
          {formatVoucherAmount(totalDebit, selectedCurrency)}
        </p>
      </div>
    </section>
  );
}

export function splitPaymentVoucherLines(
  dbLines: VoucherLine[],
  fallbackPaymentAccountId = "",
): { paymentAccountId: string; debitLines: VoucherLine[] } {
  const creditLines = dbLines.filter((line) => line.side === "credit");
  const debitLines = dbLines
    .filter((line) => line.side === "debit")
    .map((line) => ({ ...line, side: "debit" as const }));

  const paymentAccountId =
    creditLines[0]?.account_id ?? fallbackPaymentAccountId;

  return { paymentAccountId, debitLines };
}

export function buildPaymentVoucherLinesForSave(
  paymentAccountId: string,
  debitLines: VoucherLine[],
): VoucherLine[] {
  const validDebits = debitLines.filter(
    (line) => line.account_id && Number(line.amount || 0) > 0,
  );

  if (!paymentAccountId) {
    return validDebits.map((line) => ({ ...line, side: "debit" as const }));
  }

  const pairedLines: VoucherLine[] = [];

  for (const debit of validDebits) {
    const amount = Number(debit.amount);
    const description = debit.line_description?.trim();

    pairedLines.push({
      ...debit,
      side: "debit",
    });

    pairedLines.push({
      id: crypto.randomUUID(),
      voucher_id: "draft",
      account_id: paymentAccountId,
      side: "credit",
      amount,
      line_description: description ? `دفع — ${description}` : "دفع — حساب الدفع",
      cost_center_id: debit.cost_center_id ?? null,
      line_category_id: null,
      category_quantity: null,
    });
  }

  return pairedLines;
}
