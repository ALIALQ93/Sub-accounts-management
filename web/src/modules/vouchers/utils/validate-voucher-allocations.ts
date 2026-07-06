import type { OpenMovement, VoucherAllocation } from "@/modules/vouchers/types";

export function parseOptionalPaymentAmount(
  value: string | null | undefined,
): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function buildOpenAmountMapFromMovements(
  movements: OpenMovement[],
): Record<string, number> {
  return Object.fromEntries(
    movements.map((movement) => [
      movement.target_journal_line_id,
      movement.open_amount,
    ]),
  );
}

export function capAppliedAmount(amount: number, maxOpen?: number): number {
  const normalized = Math.max(0, Number(amount || 0));
  if (maxOpen == null || maxOpen <= 0) return normalized;
  return Math.min(normalized, maxOpen);
}

export function validateVoucherAllocations(
  allocations: VoucherAllocation[],
  openAmountByLineId: Record<string, number>,
): string | null {
  const validAllocations = allocations.filter(
    (allocation) =>
      allocation.target_journal_line_id &&
      Number(allocation.applied_amount || 0) > 0,
  );

  if (validAllocations.length === 0) {
    return "أضف تخصيصاً واحداً على الأقل بمبلغ أكبر من صفر.";
  }

  for (const allocation of validAllocations) {
    const applied = Number(allocation.applied_amount || 0);
    const maxOpen = openAmountByLineId[allocation.target_journal_line_id];
    if (maxOpen != null && applied > maxOpen + 0.001) {
      const reference = allocation.target_reference?.trim() || "الحركة";
      return `المبلغ المخصص (${applied.toFixed(2)}) يتجاوز المفتوح (${maxOpen.toFixed(2)}) لـ ${reference}.`;
    }
  }

  return null;
}
