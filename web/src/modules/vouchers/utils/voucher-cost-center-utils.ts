import type { CostCenter, VoucherLine, VoucherLineSide } from "@/modules/vouchers/types";

export interface CostCenterBalanceRow {
  costCenterId: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  totalDebit: number;
  totalCredit: number;
  difference: number;
}

function addToSide(
  totals: { debit: number; credit: number },
  side: VoucherLineSide,
  amount: number,
): void {
  if (side === "debit") {
    totals.debit += amount;
  } else {
    totals.credit += amount;
  }
}

export function computeCostCenterBalances(
  lines: Array<{
    side: VoucherLineSide;
    amount: number;
    cost_center_id?: string | null;
  }>,
  costCenters: CostCenter[] = [],
): CostCenterBalanceRow[] {
  const centerById = new Map(costCenters.map((center) => [center.id, center]));
  const buckets = new Map<string | null, { debit: number; credit: number }>();

  for (const line of lines) {
    const amount = Number(line.amount || 0);
    if (amount <= 0) continue;

    const key = line.cost_center_id ?? null;
    const totals = buckets.get(key) ?? { debit: 0, credit: 0 };
    addToSide(totals, line.side, amount);
    buckets.set(key, totals);
  }

  return [...buckets.entries()]
    .map(([costCenterId, totals]) => {
      const center = costCenterId ? centerById.get(costCenterId) : undefined;
      return {
        costCenterId,
        costCenterCode: center?.code ?? (costCenterId ? null : "—"),
        costCenterName: center?.name_ar ?? (costCenterId ? null : "بدون مركز"),
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        difference: totals.debit - totals.credit,
      };
    })
    .sort((left, right) => {
      const leftLabel = left.costCenterCode ?? left.costCenterName ?? "";
      const rightLabel = right.costCenterCode ?? right.costCenterName ?? "";
      return leftLabel.localeCompare(rightLabel, "ar");
    });
}

export function validateCostCenterBalance(params: {
  lines: Array<{
    side: VoucherLineSide;
    amount: number;
    cost_center_id?: string | null;
    line_description?: string | null;
  }>;
  costCenters?: CostCenter[];
  requireCostCenter?: boolean;
  excludeNullCostCenter?: boolean;
}): string | null {
  const {
    lines,
    costCenters = [],
    requireCostCenter = false,
    excludeNullCostCenter = true,
  } = params;

  const validLines = lines.filter(
    (line) => Number(line.amount || 0) > 0,
  );

  if (requireCostCenter) {
    const missing = validLines.find((line) => !line.cost_center_id);
    if (missing) {
      return "مركز الكلفة مطلوب لكل سطر.";
    }
  }

  const rows = computeCostCenterBalances(validLines, costCenters).filter(
    (row) => !(excludeNullCostCenter && row.costCenterId === null),
  );

  const unbalanced = rows.filter((row) => Math.abs(row.difference) > 0.000001);
  if (unbalanced.length === 0) {
    return null;
  }

  const centerById = new Map(costCenters.map((center) => [center.id, center]));
  const labels = unbalanced.map((row) => {
    const center = row.costCenterId
      ? centerById.get(row.costCenterId)
      : undefined;
    const label =
      center?.code ??
      row.costCenterCode ??
      row.costCenterName ??
      "مركز كلفة";
    const diff = Math.abs(row.difference).toFixed(2);
    return `${label} (فرق ${diff})`;
  });

  return `مراكز الكلفة غير متوازنة: ${labels.join("، ")}.`;
}

export function filterUserLinesForCostCenterBalance(
  lines: VoucherLine[],
  clearingAccountId = "",
): VoucherLine[] {
  if (!clearingAccountId) return lines;
  return lines.filter((line) => line.account_id !== clearingAccountId);
}
