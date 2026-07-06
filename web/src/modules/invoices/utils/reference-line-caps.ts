import type { DraftMaterialLine } from "@/modules/invoices/components/invoice-material-lines-table";

export type ReferenceLineCapKey = string;

export function referenceLineCapKey(
  materialId: string,
  materialUnitId: string,
): ReferenceLineCapKey {
  return `${materialId}:${materialUnitId}`;
}

export function buildReferenceLineCaps(
  lines: Array<{ material_id: string; material_unit_id: string; quantity: number }>,
): Record<ReferenceLineCapKey, number> {
  const caps: Record<ReferenceLineCapKey, number> = {};
  for (const line of lines) {
    const key = referenceLineCapKey(line.material_id, line.material_unit_id);
    caps[key] = (caps[key] ?? 0) + Number(line.quantity);
  }
  return caps;
}

export function mergeReferenceLineCaps(
  capGroups: Array<Record<ReferenceLineCapKey, number>>,
): Record<ReferenceLineCapKey, number> {
  const merged: Record<ReferenceLineCapKey, number> = {};
  for (const caps of capGroups) {
    for (const [key, qty] of Object.entries(caps)) {
      merged[key] = (merged[key] ?? 0) + qty;
    }
  }
  return merged;
}

export function validateReferenceQuantities(
  materialLines: DraftMaterialLine[],
  caps: Record<ReferenceLineCapKey, number> | null | undefined,
): string | null {
  if (!caps || Object.keys(caps).length === 0) return null;

  for (const line of materialLines) {
    if (!line.material_id || !line.material_unit_id) continue;
    const key = referenceLineCapKey(line.material_id, line.material_unit_id);
    const cap = caps[key];
    if (cap == null) {
      return `سطر ${line.line_no}: المادة/الوحدة غير موجودة في الفاتورة المرجعية.`;
    }
    if (line.quantity > cap + 1e-9) {
      return `سطر ${line.line_no}: الكمية (${line.quantity}) تتجاوز كمية المرجع (${cap}).`;
    }
  }

  return null;
}

export function referenceCapForLine(
  line: Pick<DraftMaterialLine, "material_id" | "material_unit_id">,
  caps: Record<ReferenceLineCapKey, number> | null | undefined,
): number | null {
  if (!caps || !line.material_id || !line.material_unit_id) return null;
  return caps[referenceLineCapKey(line.material_id, line.material_unit_id)] ?? null;
}
