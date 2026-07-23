/**
 * تحويل الكمية إلى وحدة الأساس — يجب أن يطابق
 * `material_units_sync_conversion()` في `database/patch_materials_card_v2.sql`:
 *   multiply: factor_to_base = conversion_factor
 *   divide:   factor_to_base = 1 / conversion_factor
 * المرجع النهائي عند الحفظ هو تريغر SQL (يُعاد الحساب دائماً).
 * هذه الدالة للمعاينة/الواجهة فقط — لا تغيّر صيغتها دون تحديث التريغر.
 */
export function computeFactorToBase(
  isBase: boolean,
  op: "multiply" | "divide",
  factor: number,
): number {
  if (isBase) return 1;
  if (!(factor > 0)) return 1;
  return op === "divide" ? 1 / factor : factor;
}
