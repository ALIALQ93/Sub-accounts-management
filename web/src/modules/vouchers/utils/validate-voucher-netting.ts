import type { VoucherNettingLine } from "@/modules/vouchers/types";
import {
  findDimensionNetOpen,
  summarizeOpenByBranch,
  summarizeOpenByCostCenter,
  type DimensionOpenSummary,
} from "@/modules/vouchers/utils/open-movement-utils";
import type { OpenMovement } from "@/modules/vouchers/types";

export function validateVoucherNettingLines(
  lines: VoucherNettingLine[],
  openMovements: OpenMovement[],
): string | null {
  const validLines = lines.filter((line) => Number(line.amount || 0) > 0);
  if (validLines.length === 0) return null;

  const ccSummaries = summarizeOpenByCostCenter(openMovements);
  const branchSummaries = summarizeOpenByBranch(openMovements);

  for (const line of validLines) {
    const amount = Number(line.amount || 0);

    if (line.netting_kind === "cc") {
      if (!line.from_cc_id || !line.to_cc_id) {
        return "حدد مركزي كلف للمقاصة.";
      }
      if (line.from_cc_id === line.to_cc_id) {
        return "مراكز الكلف في المقاصة يجب أن تختلف.";
      }

      const fromNet = findDimensionNetOpen(ccSummaries, line.from_cc_id);
      const toNet = findDimensionNetOpen(ccSummaries, line.to_cc_id);
      const maxNet = Math.min(fromNet, toNet);

      if (maxNet > 0 && amount > maxNet + 0.001) {
        return `مبلغ مقاصة CC (${amount.toFixed(2)}) يتجاوز الصافي المتاح (${maxNet.toFixed(2)}).`;
      }
    }

    if (line.netting_kind === "branch") {
      if (!line.from_branch_id || !line.to_branch_id) {
        return "حدد فرعين للمقاصة.";
      }
      if (line.from_branch_id === line.to_branch_id) {
        return "الفروع في المقاصة يجب أن تختلف.";
      }

      const fromNet = findDimensionNetOpen(branchSummaries, line.from_branch_id);
      const toNet = findDimensionNetOpen(branchSummaries, line.to_branch_id);
      const maxNet = Math.min(fromNet, toNet);

      if (maxNet > 0 && amount > maxNet + 0.001) {
        return `مبلغ مقاصة الفرع (${amount.toFixed(2)}) يتجاوز الصافي المتاح (${maxNet.toFixed(2)}).`;
      }
    }
  }

  return null;
}

export function buildEmptyNettingLine(
  kind: VoucherNettingLine["netting_kind"],
): VoucherNettingLine {
  return {
    id: crypto.randomUUID(),
    voucher_id: "draft",
    netting_kind: kind,
    from_cc_id: null,
    to_cc_id: null,
    from_branch_id: null,
    to_branch_id: null,
    amount: 0,
    currency_id: null,
    includes_cash: false,
    inter_account_id: null,
    note: null,
  };
}

export { type DimensionOpenSummary };
