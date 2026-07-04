import type { SettlementMode, VoucherType } from "@/modules/vouchers/types";

export interface VoucherTypeConfig {
  type: VoucherType;
  labelAr: string;
  descriptionAr: string;
  colorClass: string;
  newRoute: string;
  listFilter: VoucherType;
  allowedSettlementModes: SettlementMode[];
  defaultSettlementMode: SettlementMode;
}

export interface CloseMovementsVoucherConfig {
  voucherType: "receipt" | "payment";
  labelAr: string;
  descriptionAr: string;
  colorClass: string;
  newRoute: string;
}

export const VOUCHER_TYPE_CONFIG: Record<VoucherType, VoucherTypeConfig> = {
  receipt: {
    type: "receipt",
    labelAr: "سند قبض",
    descriptionAr: "استلام نقد أو تحصيل على الحساب",
    colorClass: "border-emerald-300 bg-emerald-50 text-emerald-900",
    newRoute: "/vouchers/receipt/new",
    listFilter: "receipt",
    allowedSettlementModes: ["account"],
    defaultSettlementMode: "account",
  },
  payment: {
    type: "payment",
    labelAr: "سند دفع",
    descriptionAr: "صرف نقد أو سداد على الحساب",
    colorClass: "border-rose-300 bg-rose-50 text-rose-900",
    newRoute: "/vouchers/payment/new",
    listFilter: "payment",
    allowedSettlementModes: ["account"],
    defaultSettlementMode: "account",
  },
  settlement: {
    type: "settlement",
    labelAr: "سند تصفية",
    descriptionAr: "تسوية وتحويل بين حسابات",
    colorClass: "border-blue-300 bg-blue-50 text-blue-900",
    newRoute: "/vouchers/settlement/new",
    listFilter: "settlement",
    allowedSettlementModes: ["account"],
    defaultSettlementMode: "account",
  },
};

export const VOUCHER_TYPES: VoucherType[] = ["receipt", "payment", "settlement"];

export const CLOSE_MOVEMENTS_VOUCHER_CONFIG: Record<
  "receipt" | "payment",
  CloseMovementsVoucherConfig
> = {
  receipt: {
    voucherType: "receipt",
    labelAr: "إغلاق حركات — قبض",
    descriptionAr: "تحصيل مرتبط بتخصيص حركات مفتوحة للعميل",
    colorClass: "border-violet-300 bg-violet-50 text-violet-900",
    newRoute: "/vouchers/receipt/close-movements/new",
  },
  payment: {
    voucherType: "payment",
    labelAr: "إغلاق حركات — دفع",
    descriptionAr: "سداد مرتبط بتخصيص حركات مفتوحة للمورد",
    colorClass: "border-violet-300 bg-violet-50 text-violet-900",
    newRoute: "/vouchers/payment/close-movements/new",
  },
};

export const CLOSE_MOVEMENTS_VOUCHER_TYPES: Array<"receipt" | "payment"> = [
  "receipt",
  "payment",
];

export function getVoucherTypeLabel(type: VoucherType): string {
  return VOUCHER_TYPE_CONFIG[type].labelAr;
}

export function getSettlementModeLabel(mode: SettlementMode): string {
  return mode === "account" ? "على الحساب" : "إغلاق حركات";
}

export function isSettlementModeAllowed(
  voucherType: VoucherType,
  mode: SettlementMode,
): boolean {
  return VOUCHER_TYPE_CONFIG[voucherType].allowedSettlementModes.includes(mode);
}
