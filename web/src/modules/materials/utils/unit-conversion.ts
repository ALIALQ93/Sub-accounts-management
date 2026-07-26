/**
 * تحويل الكمية إلى وحدة الأساس — يجب أن يطابق حرفياً
 * `material_units_sync_conversion()` في `database/patch_materials_card_v2.sql`:
 *   multiply: factor_to_base = round(conversion_factor, 6)
 *   divide:   factor_to_base = round(1 / conversion_factor, 6)
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
  const raw = op === "divide" ? 1 / factor : factor;
  // مطابقة round(...::numeric, 6) في Postgres
  return Math.round(raw * 1e6) / 1e6;
}
