import type { Account, VoucherAllocation, VoucherLine } from "@/modules/vouchers/types";

export function sumVoucherAllocationTotal(
  allocations: VoucherAllocation[],
): number {
  return allocations.reduce(
    (sum, allocation) => sum + Number(allocation.applied_amount || 0),
    0,
  );
}

function accountLabels(accountId: string, accounts: Account[]) {
  const account = accounts.find((item) => item.id === accountId);
  return {
    account_code: account?.code ?? "",
    account_name: account?.name_ar ?? "",
  };
}

function newSideLine(side: "credit" | "debit"): VoucherLine {
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

export function syncCloseMovementLinesWithAllocations(options: {
  lines: VoucherLine[];
  allocations: VoucherAllocation[];
  side: "credit" | "debit";
  counterAccountId?: string;
  accounts?: Account[];
  lineDescription?: string;
}): VoucherLine[] {
  const total = sumVoucherAllocationTotal(options.allocations);
  if (total <= 0) {
    return options.lines;
  }

  const { side, counterAccountId = "", accounts = [] } = options;
  const existing = options.lines.filter(
    (line) => !line.side || line.side === side,
  );

  const primary =
    existing.find((line) => line.account_id) ??
    existing[0] ??
    newSideLine(side);

  const accountId = primary.account_id || counterAccountId;
  const labels = accountLabels(accountId, accounts);

  return [
    {
      ...primary,
      side,
      account_id: accountId,
      ...labels,
      amount: total,
      line_description:
        options.lineDescription?.trim() ||
        primary.line_description ||
        (side === "credit" ? "إغلاق ذمم مدينة" : "إغلاق ذمم دائنة"),
    },
  ];
}

export function closeMovementLinesMatchAllocations(
  lines: VoucherLine[],
  allocations: VoucherAllocation[],
): boolean {
  const allocationTotal = sumVoucherAllocationTotal(allocations);
  if (allocationTotal <= 0) {
    return true;
  }

  const lineTotal = lines.reduce(
    (sum, line) => sum + Number(line.amount || 0),
    0,
  );

  return Math.abs(lineTotal - allocationTotal) < 0.001;
}
