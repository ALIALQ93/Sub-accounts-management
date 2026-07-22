import type { PermissionKey } from "@/modules/settings/permissions/permission-catalog";

export interface NavChildLink {
  href: string;
  label: string;
  permission?: PermissionKey;
}

export interface NavSection {
  id: string;
  label: string;
  href: string;
  permission: PermissionKey;
  children?: NavChildLink[];
}

export const APP_NAV_SECTIONS: NavSection[] = [
  {
    id: "dashboard",
    label: "الرئيسية",
    href: "/",
    permission: "dashboard.view",
  },
  {
    id: "vouchers",
    label: "السندات",
    href: "/vouchers",
    permission: "vouchers.view",
    children: [
      { href: "/vouchers", label: "كل السندات" },
      { href: "/vouchers?type=receipt", label: "قبض" },
      { href: "/vouchers?type=payment", label: "دفع" },
      { href: "/vouchers?type=settlement", label: "تصفية" },
      { href: "/vouchers?settlement=invoice", label: "إغلاق حركات" },
      { href: "/vouchers/opening-entry", label: "قيد افتتاحي" },
      {
        href: "/vouchers/settings",
        label: "إعدادات السندات",
        permission: "vouchers.settings",
      },
      {
        href: "/vouchers/settings/line-categories",
        label: "أنواع أسطر السند",
        permission: "vouchers.settings",
      },
    ],
  },
  {
    id: "invoices",
    label: "الفواتير",
    href: "/invoices",
    permission: "invoices.view",
    children: [
      { href: "/invoices", label: "الفواتير" },
      { href: "/invoices/transfers", label: "المناقلات" },
      { href: "/invoices/patterns", label: "أنماط الفواتير" },
    ],
  },
  {
    id: "materials",
    label: "المواد",
    href: "/materials",
    permission: "materials.view",
    children: [
      { href: "/materials", label: "بطاقات المواد" },
      { href: "/materials/categories", label: "الأصناف" },
      { href: "/materials/units", label: "الوحدات" },
      { href: "/materials/warehouses", label: "المستودعات" },
      { href: "/materials/warehouse-limits", label: "حدود المخزون" },
      { href: "/materials/settings", label: "إعدادات الجرد" },
      { href: "/materials/stock-adjustment/new", label: "تسوية جرد" },
      { href: "/materials/stock-adjustment/batch", label: "تسوية مجمّعة" },
    ],
  },
  {
    id: "pos",
    label: "نقاط البيع",
    href: "/pos",
    permission: "pos.view",
    children: [
      { href: "/pos", label: "اختيار نقطة" },
      { href: "/pos/points", label: "تعريف النقاط", permission: "pos.settings" },
    ],
  },
  {
    id: "accounts",
    label: "دليل الحسابات",
    href: "/accounts",
    permission: "accounts.view",
  },
  {
    id: "currencies",
    label: "العملات",
    href: "/currencies",
    permission: "currencies.view",
  },
  {
    id: "cost-centers",
    label: "مراكز الكلفة",
    href: "/cost-centers",
    permission: "cost_centers.view",
  },
  {
    id: "customers",
    label: "العملاء",
    href: "/customers",
    permission: "customers.view",
  },
  {
    id: "vendors",
    label: "الموردين",
    href: "/vendors",
    permission: "vendors.view",
  },
  {
    id: "open-movements",
    label: "الحركات المفتوحة",
    href: "/open-movements",
    permission: "open_movements.view",
  },
  {
    id: "journals",
    label: "قيود اليومية",
    href: "/journals",
    permission: "journals.view",
  },
  {
    id: "reports",
    label: "التقارير",
    href: "/reports",
    permission: "reports.view",
    children: [
      { href: "/reports", label: "كل التقارير" },
      { href: "/reports/trial-balance", label: "ميزان المراجعة" },
      { href: "/reports/account-statement", label: "كشف حساب" },
      { href: "/reports/receivables-aging", label: "أعمار الذمم" },
      { href: "/reports/inventory-balance", label: "رصيد المخزون" },
      { href: "/reports/cogs", label: "تكلفة المبيعات" },
      { href: "/reports/inventory-movements", label: "ملخص الحركات" },
      { href: "/reports/purchase-lines", label: "المشتريات" },
      { href: "/reports/sales-lines", label: "المبيعات" },
    ],
  },
  {
    id: "settings",
    label: "الإعدادات",
    href: "/settings",
    permission: "settings.company.view",
    children: [
      { href: "/settings", label: "نظرة عامة" },
      { href: "/settings/company", label: "بيانات الشركة" },
      { href: "/settings/branches", label: "الفروع" },
      { href: "/settings/accounting-periods", label: "الفترات المحاسبية" },
      {
        href: "/settings/users",
        label: "المستخدمون",
        permission: "settings.users.view",
      },
      {
        href: "/settings/permissions",
        label: "الصلاحيات",
        permission: "settings.permissions.manage",
      },
      { href: "/settings/about", label: "عن البرنامج" },
    ],
  },
];

export interface QuickShortcut {
  id: string;
  href: string;
  label: string;
}

export const DEFAULT_QUICK_SHORTCUTS: QuickShortcut[] = [
  { id: "vouchers-list", href: "/vouchers", label: "قائمة السندات" },
  { id: "vouchers-new", href: "/vouchers/new", label: "سند جديد" },
  { id: "accounts", href: "/accounts", label: "دليل الحسابات" },
  { id: "customers", href: "/customers", label: "العملاء" },
  { id: "vendors", href: "/vendors", label: "الموردين" },
  { id: "open-movements", href: "/open-movements", label: "الحركات المفتوحة" },
  { id: "journals", href: "/journals", label: "قيود اليومية" },
  { id: "reports", href: "/reports", label: "التقارير" },
];

export function flattenNavCatalog(): Array<{
  href: string;
  label: string;
  group: string;
  permission?: PermissionKey;
}> {
  const items: Array<{
    href: string;
    label: string;
    group: string;
    permission?: PermissionKey;
  }> = [];

  for (const section of APP_NAV_SECTIONS) {
    if (section.children?.length) {
      for (const child of section.children) {
        items.push({
          href: child.href,
          label: child.label,
          group: section.label,
          permission: child.permission ?? section.permission,
        });
      }
    } else {
      items.push({
        href: section.href,
        label: section.label,
        group: section.label,
        permission: section.permission,
      });
    }
  }

  items.push({
    href: "/vouchers/new",
    label: "سند جديد",
    group: "السندات",
    permission: "vouchers.create",
  });
  items.push({
    href: "/invoices/new",
    label: "فاتورة جديدة",
    group: "الفواتير",
    permission: "invoices.create",
  });
  items.push({
    href: "/materials/new",
    label: "مادة جديدة",
    group: "المواد",
    permission: "materials.create",
  });

  return items;
}

export function isNavSectionActive(pathname: string, section: NavSection): boolean {
  if (section.href === "/") return pathname === "/";
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}
