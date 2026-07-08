export type PricingMaterialMode =
  | "purchase"
  | "sale"
  | "semi_wholesale"
  | "wholesale"
  | "none";

export type PricingCostMode = "line_net" | "line_gross" | "none";

export type PricingConsumedMode =
  | "lot_cost"
  | "weighted_avg"
  | "standard"
  | "line_price";

export const PRICING_MATERIAL_MODE_LABELS: Record<PricingMaterialMode, string> = {
  purchase: "سعر الشراء (بطاقة المادة / الوحدة)",
  sale: "سعر البيع",
  semi_wholesale: "نصف جملة",
  wholesale: "جملة",
  none: "بدون تحميل تلقائي (يدوي)",
};

export const PRICING_COST_MODE_LABELS: Record<PricingCostMode, string> = {
  line_net: "صافي السطر (بعد خصم/إضافي عند التفعيل)",
  line_gross: "إجمالي السطر (قبل خصم/إضافي)",
  none: "لا يؤثر على تكلفة المخزون",
};

export const PRICING_CONSUMED_MODE_LABELS: Record<PricingConsumedMode, string> = {
  lot_cost: "تكلفة الدفعة (صلاحية / تسلسلي)",
  weighted_avg: "متوسط مرجح للمادة في المستودع",
  standard: "تكلفة معيارية من البطاقة",
  line_price: "سعر السطر (قيمة المبيع)",
};

export function defaultPricingMaterialMode(
  commercialKind: string,
): PricingMaterialMode {
  if (
    commercialKind === "purchase" ||
    commercialKind === "return_sale" ||
    commercialKind === "opening_stock" ||
    commercialKind === "transfer_in"
  ) {
    return "purchase";
  }
  return "sale";
}

export function defaultPricingCostMode(): PricingCostMode {
  return "line_net";
}

export function defaultPricingConsumedMode(): PricingConsumedMode {
  return "weighted_avg";
}

export function isInboundCommercialKind(commercialKind: string): boolean {
  return (
    commercialKind === "purchase" ||
    commercialKind === "return_sale" ||
    commercialKind === "opening_stock" ||
    commercialKind === "transfer_in"
  );
}
