import type { AppRole } from "@/modules/settings/types";

export interface PermissionDefinition {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionModule {
  id: string;
  label: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "dashboard",
    label: "الرئيسية",
    permissions: [{ key: "dashboard.view", label: "عرض لوحة التحكم" }],
  },
  {
    id: "vouchers",
    label: "السندات",
    permissions: [
      { key: "vouchers.view", label: "عرض السندات" },
      { key: "vouchers.create", label: "إنشاء سند" },
      { key: "vouchers.edit", label: "تعديل سند (مسودة/معتمد)" },
      { key: "vouchers.delete", label: "حذف سند" },
      { key: "vouchers.post", label: "ترحيل سند" },
      {
        key: "vouchers.settings",
        label: "إعدادات السندات والترقيم",
      },
    ],
  },
  {
    id: "accounts",
    label: "دليل الحسابات",
    permissions: [
      { key: "accounts.view", label: "عرض دليل الحسابات" },
      { key: "accounts.create", label: "إضافة حساب" },
      { key: "accounts.edit", label: "تعديل حساب" },
    ],
  },
  {
    id: "journals",
    label: "قيود اليومية",
    permissions: [{ key: "journals.view", label: "عرض القيود المرحّلة" }],
  },
  {
    id: "reports",
    label: "التقارير",
    permissions: [{ key: "reports.view", label: "عرض التقارير" }],
  },
  {
    id: "currencies",
    label: "العملات",
    permissions: [
      { key: "currencies.view", label: "عرض العملات" },
      { key: "currencies.edit", label: "تعديل أسعار العملات" },
    ],
  },
  {
    id: "cost_centers",
    label: "مراكز الكلفة",
    permissions: [
      { key: "cost_centers.view", label: "عرض مراكز الكلفة" },
      { key: "cost_centers.create", label: "إضافة مركز كلفة" },
      { key: "cost_centers.edit", label: "تعديل مركز كلفة" },
    ],
  },
  {
    id: "customers",
    label: "العملاء",
    permissions: [
      { key: "customers.view", label: "عرض العملاء" },
      { key: "customers.create", label: "إضافة عميل" },
      { key: "customers.edit", label: "تعديل عميل" },
    ],
  },
  {
    id: "vendors",
    label: "الموردين",
    permissions: [
      { key: "vendors.view", label: "عرض الموردين" },
      { key: "vendors.create", label: "إضافة مورد" },
      { key: "vendors.edit", label: "تعديل مورد" },
    ],
  },
  {
    id: "open_movements",
    label: "الحركات المفتوحة",
    permissions: [
      { key: "open_movements.view", label: "عرض الحركات المفتوحة" },
    ],
  },
  {
    id: "invoices",
    label: "الفواتير",
    permissions: [
      { key: "invoices.view", label: "عرض الفواتير" },
      { key: "invoices.create", label: "إنشاء فاتورة" },
      { key: "invoices.edit", label: "تعديل فاتورة (مسودة)" },
      { key: "invoices.post", label: "ترحيل فاتورة" },
      { key: "invoices.cancel", label: "إلغاء فاتورة مسودة" },
      {
        key: "invoices.settings",
        label: "إعدادات أنماط الفواتير",
      },
    ],
  },
  {
    id: "materials",
    label: "المواد والمستودعات",
    permissions: [
      { key: "materials.view", label: "عرض المواد والمستودعات" },
      { key: "materials.create", label: "إضافة مادة" },
      { key: "materials.edit", label: "تعديل مواد ومستودعات" },
      { key: "materials.settings", label: "إعدادات الجرد والتكلفة" },
    ],
  },
  {
    id: "pos",
    label: "نقاط البيع",
    permissions: [
      { key: "pos.view", label: "عرض نقاط البيع" },
      { key: "pos.sell", label: "البيع من نقطة البيع" },
      { key: "pos.settings", label: "تعريف وتخصيص نقاط البيع" },
    ],
  },
  {
    id: "settings",
    label: "الإعدادات والإدارة",
    permissions: [
      { key: "settings.company.view", label: "عرض بيانات الشركة" },
      { key: "settings.company.edit", label: "تعديل بيانات الشركة" },
      { key: "settings.users.view", label: "عرض قائمة المستخدمين" },
      { key: "settings.users.manage", label: "إدارة المستخدمين (إضافة/تفعيل)" },
      {
        key: "settings.permissions.manage",
        label: "إدارة الصلاحيات التفصيلية",
      },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap((module) =>
  module.permissions.map((permission) => permission.key),
);

export type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

export const ALL_PERMISSIONS_SET = new Set<string>(ALL_PERMISSION_KEYS);

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_MODULES.flatMap((module) =>
    module.permissions.map((permission) => [permission.key, permission.label]),
  ),
);

export const ROLE_PERMISSION_DEFAULTS: Record<AppRole, PermissionKey[]> = {
  admin: [...ALL_PERMISSION_KEYS] as PermissionKey[],
  accountant: [
    "dashboard.view",
    "vouchers.view",
    "vouchers.create",
    "vouchers.edit",
    "vouchers.post",
    "accounts.view",
    "accounts.create",
    "accounts.edit",
    "journals.view",
    "reports.view",
    "currencies.view",
    "cost_centers.view",
    "cost_centers.create",
    "cost_centers.edit",
    "customers.view",
    "customers.create",
    "customers.edit",
    "vendors.view",
    "vendors.create",
    "vendors.edit",
    "open_movements.view",
    "invoices.view",
    "invoices.create",
    "invoices.edit",
    "invoices.post",
    "invoices.cancel",
    "materials.view",
    "materials.create",
    "materials.edit",
    "materials.settings",
    "pos.view",
    "pos.sell",
    "pos.settings",
    "settings.company.view",
  ],
  viewer: [
    "dashboard.view",
    "vouchers.view",
    "accounts.view",
    "journals.view",
    "reports.view",
    "currencies.view",
    "cost_centers.view",
    "customers.view",
    "vendors.view",
    "open_movements.view",
    "invoices.view",
    "materials.view",
    "pos.view",
    "settings.company.view",
  ],
};
