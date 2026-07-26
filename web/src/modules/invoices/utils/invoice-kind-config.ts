import type {
  DisassemblyCostMode,
  InvoiceCommercialKind,
  InvoiceDirection,
  InvoiceNatureGroup,
} from "@/modules/invoices/types";

export const DIRECTION_OPTIONS: Array<{ value: InvoiceDirection; label: string }> = [
  { value: "input", label: "إدخال" },
  { value: "output", label: "إخراج" },
];

export const NATURE_GROUP_LABELS: Record<InvoiceNatureGroup, string> = {
  commercial: "تجارية",
  logistics: "لوجستية",
  transform: "تحويلية",
  inventory: "جردية",
};

export const COMMERCIAL_KIND_OPTIONS: Array<{
  value: InvoiceCommercialKind;
  label: string;
  direction: InvoiceDirection;
  group: InvoiceNatureGroup;
}> = [
  { value: "sale", label: "مبيعات", direction: "output", group: "commercial" },
  { value: "purchase", label: "مشتريات", direction: "input", group: "commercial" },
  {
    value: "return_sale",
    label: "مرتجع مبيعات",
    direction: "input",
    group: "commercial",
  },
  {
    value: "return_purchase",
    label: "مرتجع مشتريات",
    direction: "output",
    group: "commercial",
  },
  {
    value: "transfer_out",
    label: "مناقلة — إخراج",
    direction: "output",
    group: "logistics",
  },
  {
    value: "transfer_in",
    label: "مناقلة — إدخال",
    direction: "input",
    group: "logistics",
  },
  {
    value: "manufacturing",
    label: "تصنيع / تجميع",
    direction: "output",
    group: "transform",
  },
  {
    value: "disassembly",
    label: "تفكيك",
    direction: "output",
    group: "transform",
  },
  {
    value: "opening_stock",
    label: "بضاعة أول المدة",
    direction: "input",
    group: "inventory",
  },
  {
    value: "inventory_scrap",
    label: "إخراج تالف",
    direction: "output",
    group: "inventory",
  },
  {
    value: "inventory_shortage",
    label: "عجز جرد",
    direction: "output",
    group: "inventory",
  },
  {
    value: "inventory_surplus",
    label: "فائض جرد",
    direction: "input",
    group: "inventory",
  },
];

export const DISASSEMBLY_COST_MODE_OPTIONS: Array<{
  value: DisassemblyCostMode;
  label: string;
  hint: string;
}> = [
  {
    value: "allocate_from_parent",
    label: "توزيع تكلفة المنتج المجمّع",
    hint: "قيمة الأب الحالية تُوزَّع على المكوّنات (قد تعيد متوسطها).",
  },
  {
    value: "components_at_current_cost",
    label: "تكلفة المكوّنات الحالية + فرق",
    hint: "إدخال بمتوسط كل مكوّن؛ الفرق مع الأب على حساب التكلفة.",
  },
];

export function getCommercialKindLabel(kind: string): string {
  return COMMERCIAL_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}

export function getDirectionLabel(direction: string): string {
  return DIRECTION_OPTIONS.find((o) => o.value === direction)?.label ?? direction;
}

export function getCommercialKindOption(kind: string) {
  return COMMERCIAL_KIND_OPTIONS.find((o) => o.value === kind);
}

export function groupedCommercialKindOptions(): Array<{
  group: InvoiceNatureGroup;
  label: string;
  options: typeof COMMERCIAL_KIND_OPTIONS;
}> {
  const order: InvoiceNatureGroup[] = [
    "commercial",
    "logistics",
    "transform",
    "inventory",
  ];
  return order.map((group) => ({
    group,
    label: NATURE_GROUP_LABELS[group],
    options: COMMERCIAL_KIND_OPTIONS.filter((o) => o.group === group),
  }));
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
