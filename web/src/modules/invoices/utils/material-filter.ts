import type { MaterialOption } from "@/modules/invoices/types";

export function filterMaterialsForPattern(
  materials: MaterialOption[],
  allowedMaterialIds: string[],
  allowedCategoryIds: string[],
): MaterialOption[] {
  if (allowedMaterialIds.length === 0 && allowedCategoryIds.length === 0) {
    return materials;
  }

  return materials.filter((material) => {
    if (
      allowedMaterialIds.length > 0 &&
      allowedMaterialIds.includes(material.id)
    ) {
      return true;
    }
    if (
      allowedCategoryIds.length > 0 &&
      material.category_id &&
      allowedCategoryIds.includes(material.category_id)
    ) {
      return true;
    }
    return false;
  });
}

export function isMaterialAllowedForPattern(
  material: MaterialOption,
  allowedMaterialIds: string[],
  allowedCategoryIds: string[],
): boolean {
  if (allowedMaterialIds.length === 0 && allowedCategoryIds.length === 0) {
    return true;
  }
  if (allowedMaterialIds.includes(material.id)) return true;
  if (
    material.category_id &&
    allowedCategoryIds.includes(material.category_id)
  ) {
    return true;
  }
  return false;
}
