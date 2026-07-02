import type { CostCenter } from "@/modules/vouchers/types";

const CODE_PREFIX = "CC-";

function parseCostCenterNumber(code: string): number | null {
  const match = code.trim().toUpperCase().match(/^CC-(\d+)$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export function generateCostCenterCode(centers: CostCenter[]): string {
  const numbers = centers
    .map((center) => parseCostCenterNumber(center.code))
    .filter((value): value is number => value !== null);

  const max = numbers.length > 0 ? Math.max(...numbers) : -1;
  const next = max + 1;
  const width = Math.max(3, numbers.length > 0 ? String(max).length : 3);

  let candidate = `${CODE_PREFIX}${String(next).padStart(width, "0")}`;
  while (centers.some((center) => center.code.toUpperCase() === candidate)) {
    const parsed = parseCostCenterNumber(candidate);
    if (parsed === null) break;
    candidate = `${CODE_PREFIX}${String(parsed + 1).padStart(width, "0")}`;
  }

  return candidate;
}

export function previewCostCenterCode(centers: CostCenter[]): string {
  return generateCostCenterCode(centers);
}
