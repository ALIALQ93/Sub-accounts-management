export type ContextMenuItem = {
  id: string;
  label: string;
  href?: string;
  action?: string;
  permission?: string;
};

const MENUS: Record<string, ContextMenuItem[]> = {
  materials: [
    {
      id: "new-material",
      label: "مادة جديدة",
      href: "/materials/new",
      permission: "materials.create",
    },
    { id: "categories", label: "أصناف", href: "/materials/categories" },
    { id: "units", label: "وحدات", href: "/materials/units" },
    { id: "warehouses", label: "مستودعات", href: "/materials/warehouses" },
    {
      id: "stock-adjustment",
      label: "تسوية جرد",
      href: "/materials/stock-adjustment/new",
    },
    {
      id: "bulk-import",
      label: "استيراد جماعي",
      action: "bulk-import",
      permission: "materials.create",
    },
    {
      id: "warehouse-limits",
      label: "حدود مخزون",
      href: "/materials/warehouse-limits",
    },
  ],
  invoices: [
    {
      id: "new-invoice",
      label: "فاتورة جديدة",
      href: "/invoices/new",
      permission: "invoices.create",
    },
    { id: "patterns", label: "أنماط", href: "/invoices/patterns" },
    { id: "transfers", label: "مناقلات", href: "/invoices/transfers" },
  ],
  vouchers: [
    {
      id: "new-voucher",
      label: "سند جديد",
      href: "/vouchers/new",
      permission: "vouchers.create",
    },
    { id: "all-vouchers", label: "كل السندات", href: "/vouchers" },
    { id: "receipt", label: "قبض", href: "/vouchers?type=receipt" },
    { id: "payment", label: "دفع", href: "/vouchers?type=payment" },
  ],
  accounts: [
    { id: "accounts", label: "دليل الحسابات", href: "/accounts" },
    {
      id: "opening",
      label: "قيد افتتاحي",
      href: "/vouchers/opening-entry",
    },
  ],
  customers: [
    { id: "customers", label: "العملاء", href: "/customers" },
  ],
  vendors: [
    { id: "vendors", label: "الموردين", href: "/vendors" },
  ],
  reports: [
    { id: "reports", label: "كل التقارير", href: "/reports" },
    {
      id: "trial-balance",
      label: "ميزان المراجعة",
      href: "/reports/trial-balance",
    },
    {
      id: "inventory-balance",
      label: "رصيد المخزون",
      href: "/reports/inventory-balance",
    },
  ],
  settings: [
    { id: "settings", label: "نظرة عامة", href: "/settings" },
    { id: "company", label: "بيانات الشركة", href: "/settings/company" },
    { id: "branches", label: "الفروع", href: "/settings/branches" },
  ],
};

export function getSectionContextMenu(sectionId: string): ContextMenuItem[] {
  return MENUS[sectionId] ?? [];
}
