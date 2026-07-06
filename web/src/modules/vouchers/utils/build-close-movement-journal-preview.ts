import type { BranchOption } from "@/modules/branches/services/branch-api";
import type {
  Account,
  CostCenter,
  VoucherAllocation,
  VoucherLine,
  VoucherNettingLine,
} from "@/modules/vouchers/types";
import { sumVoucherAllocationTotal } from "@/modules/vouchers/utils/sync-close-movement-lines";

export interface CloseMovementJournalPreviewLine {
  side: "debit" | "credit";
  account_code: string;
  account_name: string;
  amount: number;
  cost_center_code?: string;
  branch_code?: string;
  description: string;
}

export interface CloseMovementJournalPreviewEntry {
  kind: "cash" | "netting_cc" | "netting_branch";
  title: string;
  lines: CloseMovementJournalPreviewLine[];
}

function accountLabel(accountId: string | null | undefined, accounts: Account[]) {
  const account = accounts.find((item) => item.id === accountId);
  return {
    code: account?.code ?? "—",
    name: account?.name_ar ?? "حساب غير محدد",
  };
}

function ccLabel(ccId: string | null | undefined, costCenters: CostCenter[]) {
  return costCenters.find((item) => item.id === ccId)?.code ?? "—";
}

function branchLabel(branchId: string | null | undefined, branches: BranchOption[]) {
  return branches.find((item) => item.id === branchId)?.branch_code ?? "—";
}

export function buildCloseMovementJournalPreview(options: {
  voucherType: "receipt" | "payment";
  counterAccountId: string;
  voucherLines: VoucherLine[];
  allocations: VoucherAllocation[];
  nettingLines: VoucherNettingLine[];
  accounts: Account[];
  costCenters: CostCenter[];
  branches: BranchOption[];
}): CloseMovementJournalPreviewEntry[] {
  const entries: CloseMovementJournalPreviewEntry[] = [];
  const allocationTotal = sumVoucherAllocationTotal(options.allocations);

  const cashLines = options.voucherLines
    .filter((line) => line.account_id && Number(line.amount || 0) > 0)
    .map((line) => {
      const account = accountLabel(line.account_id, options.accounts);
      return {
        side: line.side,
        account_code: account.code,
        account_name: account.name,
        amount: Number(line.amount),
        cost_center_code: ccLabel(line.cost_center_id, options.costCenters),
        description: line.line_description?.trim() || "سند إغلاق حركات",
      } satisfies CloseMovementJournalPreviewLine;
    });

  if (cashLines.length > 0 || allocationTotal > 0) {
    entries.push({
      kind: "cash",
      title:
        options.voucherType === "receipt"
          ? "قيد قبض / إغلاق ذمم"
          : "قيد دفع / إغلاق ذمم",
      lines:
        cashLines.length > 0
          ? cashLines
          : [
              {
                side: options.voucherType === "receipt" ? "debit" : "credit",
                account_code: accountLabel(options.counterAccountId, options.accounts).code,
                account_name: accountLabel(options.counterAccountId, options.accounts).name,
                amount: allocationTotal,
                description: "مبلغ التخصيصات (يُزامَن مع أسطر السند)",
              },
            ],
    });
  }

  for (const line of options.nettingLines.filter(
    (item) => Number(item.amount || 0) > 0,
  )) {
    if (line.netting_kind === "cc") {
      const inter = accountLabel(line.inter_account_id, options.accounts);
      const fromCc = ccLabel(line.from_cc_id, options.costCenters);
      const toCc = ccLabel(line.to_cc_id, options.costCenters);
      entries.push({
        kind: "netting_cc",
        title: `تسوية CC: ${fromCc} → ${toCc}`,
        lines: [
          {
            side: "debit",
            account_code: inter.code,
            account_name: inter.name,
            amount: Number(line.amount),
            cost_center_code: toCc,
            description: line.note?.trim() || "مقاصة مراكز كلف",
          },
          {
            side: "credit",
            account_code: inter.code,
            account_name: inter.name,
            amount: Number(line.amount),
            cost_center_code: fromCc,
            description: line.note?.trim() || "مقاصة مراكز كلف",
          },
        ],
      });
    }

    if (line.netting_kind === "branch") {
      const inter = accountLabel(line.inter_account_id, options.accounts);
      const fromBranch = branchLabel(line.from_branch_id, options.branches);
      const toBranch = branchLabel(line.to_branch_id, options.branches);
      entries.push({
        kind: "netting_branch",
        title: `تسوية فرع: ${fromBranch} → ${toBranch}`,
        lines: [
          {
            side: "debit",
            account_code: inter.code,
            account_name: inter.name,
            amount: Number(line.amount),
            branch_code: toBranch,
            description: line.note?.trim() || "مقاصة فروع",
          },
          {
            side: "credit",
            account_code: inter.code,
            account_name: inter.name,
            amount: Number(line.amount),
            branch_code: fromBranch,
            description: line.note?.trim() || "مقاصة فروع",
          },
        ],
      });
    }
  }

  return entries;
}
