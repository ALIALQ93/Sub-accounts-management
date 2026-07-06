import type { InvoiceOpenItem } from "@/modules/invoices/services/invoice-settlement-api";
import type { VoucherAllocation } from "@/modules/vouchers/types";

export function distributePaymentAcrossOpenItems(
  items: InvoiceOpenItem[],
  paymentAmount: number,
): Map<string, number> {
  const amounts = new Map<string, number>();
  let remaining = Math.max(0, paymentAmount);

  const sorted = [...items].sort(
    (left, right) =>
      left.entry_date.localeCompare(right.entry_date) ||
      left.entry_no.localeCompare(right.entry_no),
  );

  for (const item of sorted) {
    if (remaining <= 0.001) {
      amounts.set(item.journal_line_id, 0);
      continue;
    }

    const applied = Math.min(item.open_amount, remaining);
    amounts.set(item.journal_line_id, applied);
    remaining -= applied;
  }

  return amounts;
}

export function buildVoucherAllocationsFromOpenItems(
  items: InvoiceOpenItem[],
  options?: { paymentAmount?: number },
): VoucherAllocation[] {
  if (items.length === 0) return [];

  const totalOpen = items.reduce((sum, item) => sum + item.open_amount, 0);
  const paymentAmount = options?.paymentAmount;
  const usePartial =
    paymentAmount != null &&
    paymentAmount > 0 &&
    paymentAmount + 0.001 < totalOpen;

  const amountsByLine = usePartial
    ? distributePaymentAcrossOpenItems(items, paymentAmount)
    : new Map(items.map((item) => [item.journal_line_id, item.open_amount]));

  return items
    .map((item): VoucherAllocation | null => {
      const appliedAmount = amountsByLine.get(item.journal_line_id) ?? 0;
      if (appliedAmount <= 0) return null;

      return {
        id: crypto.randomUUID(),
        voucher_id: "draft",
        target_journal_line_id: item.journal_line_id,
        target_reference: item.entry_no,
        applied_amount: appliedAmount,
        note: usePartial
          ? `${item.line_description ?? `قيد ${item.entry_no}`} — دفع جزئي`
          : (item.line_description ?? `قيد ${item.entry_no}`),
      };
    })
    .filter((row): row is VoucherAllocation => row !== null);
}
