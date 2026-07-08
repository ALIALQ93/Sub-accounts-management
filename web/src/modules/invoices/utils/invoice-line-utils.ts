import { defaultPricingMaterialMode } from "@/modules/invoices/utils/pricing-modes";

export function unitPriceFromBase(
  basePrice: number,
  factorToBase: number,
): number {
  return Math.round(basePrice * factorToBase * 10000) / 10000;
}

export function computeLineAmountPreview(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function computeLineNetAmount(
  quantity: number,
  unitPrice: number,
  discountPercent?: number | null,
  discountAmount?: number | null,
  extraPercent?: number | null,
  extraAmount?: number | null,
): number {
  const gross = quantity * unitPrice;
  const discount = computeLineDiscountAmount(
    quantity,
    unitPrice,
    discountPercent,
    discountAmount,
  );
  const extra = computeLineExtraAmount(
    quantity,
    unitPrice,
    extraPercent,
    extraAmount,
  );
  return Math.max(0, Math.round((gross - discount + extra) * 100) / 100);
}

export function computeLineGross(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function computeLineDiscountAmount(
  quantity: number,
  unitPrice: number,
  discountPercent?: number | null,
  discountAmount?: number | null,
): number {
  const gross = quantity * unitPrice;
  if (discountPercent != null && discountPercent > 0) {
    return Math.round(gross * discountPercent * 100) / 10000;
  }
  if (discountAmount != null && discountAmount > 0) {
    return discountAmount;
  }
  return 0;
}

export function computeLineExtraAmount(
  quantity: number,
  unitPrice: number,
  extraPercent?: number | null,
  extraAmount?: number | null,
): number {
  const gross = quantity * unitPrice;
  if (extraPercent != null && extraPercent > 0) {
    return Math.round(gross * extraPercent * 100) / 10000;
  }
  if (extraAmount != null && extraAmount > 0) {
    return extraAmount;
  }
  return 0;
}

export function partyKindForCommercial(
  commercialKind: string,
): "customer" | "vendor" | "none" {
  if (commercialKind === "sale" || commercialKind === "return_purchase") {
    return "customer";
  }
  if (commercialKind === "purchase" || commercialKind === "return_sale") {
    return "vendor";
  }
  return "none";
}

export interface MaterialUnitPriceSource {
  factor_to_base: number;
  purchase_price?: number | null;
  sale_price?: number | null;
  semi_wholesale_price?: number | null;
  wholesale_price?: number | null;
}

export function resolveMaterialUnitPrice(
  pricingMaterialMode: string | null | undefined,
  material: { sale_price: number; purchase_price: number },
  unit: MaterialUnitPriceSource | null,
  commercialKind: string,
): number {
  const mode = pricingMaterialMode ?? defaultPricingMaterialMode(commercialKind);
  if (mode === "none") return 0;

  const factor = unit?.factor_to_base ?? 1;
  let basePrice = 0;

  switch (mode) {
    case "purchase":
      basePrice = unit?.purchase_price ?? material.purchase_price;
      break;
    case "sale":
      basePrice = unit?.sale_price ?? material.sale_price;
      break;
    case "semi_wholesale":
      basePrice =
        unit?.semi_wholesale_price ??
        unit?.sale_price ??
        material.sale_price;
      break;
    case "wholesale":
      basePrice =
        unit?.wholesale_price ?? unit?.sale_price ?? material.sale_price;
      break;
    default:
      basePrice = defaultPricingMaterialMode(commercialKind) === "purchase"
        ? (unit?.purchase_price ?? material.purchase_price)
        : (unit?.sale_price ?? material.sale_price);
  }

  return unitPriceFromBase(Number(basePrice) || 0, factor);
}

export function defaultUnitPrice(
  commercialKind: string,
  material: { sale_price: number; purchase_price: number },
  factorToBase: number,
): number {
  return resolveMaterialUnitPrice(
    null,
    material,
    { factor_to_base: factorToBase },
    commercialKind,
  );
}
