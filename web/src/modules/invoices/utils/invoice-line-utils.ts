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
): number {
  const gross = quantity * unitPrice;
  const discount = computeLineDiscountAmount(
    quantity,
    unitPrice,
    discountPercent,
    discountAmount,
  );
  return Math.max(0, Math.round((gross - discount) * 100) / 100);
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

export function defaultUnitPrice(
  commercialKind: string,
  material: { sale_price: number; purchase_price: number },
  factorToBase: number,
): number {
  const base =
    commercialKind === "purchase" ||
    commercialKind === "return_sale" ||
    commercialKind === "opening_stock"
      ? material.purchase_price
      : material.sale_price;
  return unitPriceFromBase(base, factorToBase);
}
