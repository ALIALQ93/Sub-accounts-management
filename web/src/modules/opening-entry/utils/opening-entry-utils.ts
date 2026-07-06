import type { VoucherLine } from "@/modules/vouchers/types";
import {
  buildSettlementVoucherLinesForSave,
  settlementLineHasAmount,
  settlementLineHasBothSides,
  type SettlementUserLine,
} from "@/modules/vouchers/components/settlement-voucher-lines-table";

export type OpeningEntryLine = SettlementUserLine;

export function isValidOpeningEntryLine(line: OpeningEntryLine): boolean {
  if (!line.account_id) return false;
  if (settlementLineHasBothSides(line)) return false;
  return settlementLineHasAmount(line);
}

export function computeOpeningEntryTotals(lines: OpeningEntryLine[]): {
  totalDebit: number;
  totalCredit: number;
  difference: number;
} {
  const totalDebit = lines.reduce(
    (sum, line) => sum + Number(line.debit_amount || 0),
    0,
  );
  const totalCredit = lines.reduce(
    (sum, line) => sum + Number(line.credit_amount || 0),
    0,
  );
  return {
    totalDebit,
    totalCredit,
    difference: totalDebit - totalCredit,
  };
}

export function buildOpeningEntryLinesForSave(
  userLines: OpeningEntryLine[],
): VoucherLine[] {
  const validLines = userLines.filter(isValidOpeningEntryLine);
  return buildSettlementVoucherLinesForSave("", validLines);
}

export function splitOpeningEntryLines(dbLines: VoucherLine[]): OpeningEntryLine[] {
  return dbLines.map((line) => {
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
  });
}

export function validateOpeningEntryBalance(lines: OpeningEntryLine[]): string | null {
  const validLines = lines.filter(isValidOpeningEntryLine);
  if (validLines.length === 0) {
    return "أضف سطراً واحداً على الأقل بمبلغ في المدين أو الدائن.";
  }

  if (validLines.some(settlementLineHasBothSides)) {
    return "لا يمكن تعبئة المدين والدائن في نفس السطر.";
  }

  const { totalDebit, totalCredit } = computeOpeningEntryTotals(validLines);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return `القيد غير متوازن — مدين ${totalDebit.toFixed(2)} ≠ دائن ${totalCredit.toFixed(2)}.`;
  }

  return null;
}
