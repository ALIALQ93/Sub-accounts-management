import type { InvoiceCommercialKind, InvoiceDirection } from "@/modules/invoices/types";

export const DIRECTION_OPTIONS: Array<{ value: InvoiceDirection; label: string }> = [
  { value: "input", label: "إدخال" },
  { value: "output", label: "إخراج" },
];

export const COMMERCIAL_KIND_OPTIONS: Array<{
  value: InvoiceCommercialKind;
  label: string;
  direction: InvoiceDirection;
}> = [
  { value: "sale", label: "مبيعات", direction: "output" },
  { value: "purchase", label: "مشتريات", direction: "input" },
  { value: "transfer_out", label: "مناقلة — إخراج", direction: "output" },
  { value: "transfer_in", label: "مناقلة — إدخال", direction: "input" },
  { value: "return_sale", label: "مرتجع مبيعات", direction: "input" },
  { value: "return_purchase", label: "مرتجع مشتريات", direction: "output" },
  { value: "opening_stock", label: "بضاعة أول المدة", direction: "input" },
];

export function getCommercialKindLabel(kind: string): string {
  return COMMERCIAL_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}

export function getDirectionLabel(direction: string): string {
  return DIRECTION_OPTIONS.find((o) => o.value === direction)?.label ?? direction;
}

export const SETTLEMENT_MODE_OPTIONS = [
  { value: "credit" as const, label: "آجل" },
  { value: "cash" as const, label: "نقدي" },
];

export const NUMBERING_RESET_OPTIONS = [
  { value: "never" as const, label: "بدون إعادة ضبط" },
  { value: "yearly" as const, label: "سنوي" },
  { value: "monthly" as const, label: "شهري" },
];
