import type { OpenMovement } from "@/modules/vouchers/types";

export interface DimensionOpenSummary {
  id: string;
  code: string | null;
  name: string | null;
  debit_total: number;
  credit_total: number;
  net_open: number;
  line_count: number;
}

export function formatOpenMovementLabel(movement: OpenMovement): string {
  const parts = [
    movement.entry_no,
    movement.account_code,
    movement.open_side === "debit"
      ? "مدين"
      : movement.open_side === "credit"
        ? "دائن"
        : null,
    movement.cost_center_code ? `CC:${movement.cost_center_code}` : null,
    movement.branch_code ? `فرع:${movement.branch_code}` : null,
    movement.open_amount.toFixed(2),
  ].filter(Boolean);

  return parts.join(" | ");
}

export function summarizeOpenByCostCenter(
  movements: OpenMovement[],
): DimensionOpenSummary[] {
  const map = new Map<string, DimensionOpenSummary>();

  for (const movement of movements) {
    const id = movement.cost_center_id ?? "__none__";
    const existing = map.get(id);

    if (!existing) {
      map.set(id, {
        id,
        code: movement.cost_center_code ?? null,
        name: movement.cost_center_name ?? (id === "__none__" ? "بدون CC" : null),
        debit_total: 0,
        credit_total: 0,
        net_open: 0,
        line_count: 0,
      });
    }

    const summary = map.get(id)!;
    if (movement.open_side === "debit") {
      summary.debit_total += movement.open_amount;
    } else if (movement.open_side === "credit") {
      summary.credit_total += movement.open_amount;
    }
    summary.net_open = summary.debit_total - summary.credit_total;
    summary.line_count += 1;
  }

  return Array.from(map.values()).sort(
    (left, right) => Math.abs(right.net_open) - Math.abs(left.net_open),
  );
}

export function summarizeOpenByBranch(
  movements: OpenMovement[],
): DimensionOpenSummary[] {
  const map = new Map<string, DimensionOpenSummary>();

  for (const movement of movements) {
    const id = movement.branch_id ?? "__none__";
    const existing = map.get(id);

    if (!existing) {
      map.set(id, {
        id,
        code: movement.branch_code ?? null,
        name: movement.branch_name ?? (id === "__none__" ? "بدون فرع" : null),
        debit_total: 0,
        credit_total: 0,
        net_open: 0,
        line_count: 0,
      });
    }

    const summary = map.get(id)!;
    if (movement.open_side === "debit") {
      summary.debit_total += movement.open_amount;
    } else if (movement.open_side === "credit") {
      summary.credit_total += movement.open_amount;
    }
    summary.net_open = summary.debit_total - summary.credit_total;
    summary.line_count += 1;
  }

  return Array.from(map.values()).sort(
    (left, right) => Math.abs(right.net_open) - Math.abs(left.net_open),
  );
}

export function findDimensionNetOpen(
  summaries: DimensionOpenSummary[],
  dimensionId: string | null | undefined,
): number {
  if (!dimensionId) return 0;
  const summary = summaries.find((row) => row.id === dimensionId);
  return summary ? Math.abs(summary.net_open) : 0;
}
