import type { InventorySettingsFormValues } from "@/modules/materials/types";
import type { CompanySettingsFormValues } from "@/modules/settings/types";

export type SetupStepId =
  | "database"
  | "company"
  | "admin"
  | "branch"
  | "accounts"
  | "inventory"
  | "invoice_patterns"
  | "opening"
  | "finish";

export type BusinessNature = "commercial" | "industrial" | "service";

export const BUSINESS_NATURE_LABELS: Record<BusinessNature, string> = {
  commercial: "تجاري",
  industrial: "صناعي",
  service: "خدمي",
};

export const SETUP_STEPS: Array<{ id: SetupStepId; title: string; description: string }> = [
  {
    id: "database",
    title: "تهيئة قاعدة البيانات",
    description: "التحقق من تثبيت المخطط عبر setup_all",
  },
  {
    id: "company",
    title: "بيانات الشركة",
    description: "الاسم والعملة وبداية السنة المالية",
  },
  {
    id: "admin",
    title: "المدير الأول",
    description: "تأكيد حساب المدير",
  },
  {
    id: "branch",
    title: "الفرع والمستودع",
    description: "تعديل القيم المقترحة",
  },
  {
    id: "accounts",
    title: "دليل الحسابات",
    description: "طبيعة الشركة وقالب الدليل",
  },
  {
    id: "inventory",
    title: "إعدادات المخزون",
    description: "الجرد والتكلفة قبل أول ترحيل",
  },
  {
    id: "invoice_patterns",
    title: "أنماط الفواتير",
    description: "اختيار الأنماط المطلوبة من الكتالوج",
  },
  {
    id: "opening",
    title: "القيد الافتتاحي",
    description: "اختياري — يمكن تأجيله",
  },
  {
    id: "finish",
    title: "إتمام",
    description: "مراجعة وتأكيد",
  },
];

export interface SchemaSetupCheck {
  key: string;
  label_ar: string;
  ok: boolean;
}

export interface SchemaSetupSummary {
  is_setup_complete: boolean;
  company_name_ar: string;
  root_accounts: number;
  branches: number;
  warehouses: number;
  currencies: number;
  materials: number;
  posted_invoices: number;
  inventory_movements: number;
}

export interface SchemaSetupStatus {
  ok: boolean;
  source: string;
  checks: SchemaSetupCheck[];
  message_ar: string;
  summary?: SchemaSetupSummary | null;
}

export interface SetupBranchForm {
  branch_code: string;
  branch_name_ar: string;
  warehouse_code: string;
  warehouse_name_ar: string;
}

export interface SetupAdminForm {
  full_name_ar: string;
  full_name_en: string;
}

export interface RootAccountSummary {
  code: string;
  name_ar: string;
}

export interface CoaTemplateSummary {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  standard: string;
  supports_natures: string[];
  sort_order: number;
}

export interface CoaTemplateAccountPreview {
  code: string;
  parent_code: string | null;
  name_ar: string;
  level: number;
  is_postable: boolean;
}

export interface InvoicePatternCatalogItem {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  direction: "input" | "output";
  commercial_kind: string;
  is_return: boolean;
  is_opening_stock: boolean;
  sort_order: number;
  paired_catalog_code: string | null;
}

export interface SetupWizardState {
  company: CompanySettingsFormValues;
  admin: SetupAdminForm;
  adminEmail: string;
  branch: SetupBranchForm;
  branchId: string | null;
  warehouseId: string | null;
  inventory: InventorySettingsFormValues;
  businessNature: BusinessNature | "";
  selectedCoaTemplateCode: string;
  coaApplied: boolean;
  coaTemplates: CoaTemplateSummary[];
  templatePreview: CoaTemplateAccountPreview[];
  rootAccounts: RootAccountSummary[];
  patternCatalog: InvoicePatternCatalogItem[];
  selectedPatternCodes: string[];
  patternsApplied: boolean;
  schemaStatus: SchemaSetupStatus | null;
  schemaAccepted: boolean;
}

export const EMPTY_COMPANY_FORM: CompanySettingsFormValues = {
  legal_name_ar: "",
  legal_name_en: "",
  tax_number: "",
  address: "",
  phone: "",
  email: "",
  fiscal_year_start_month: 1,
  base_currency_id: "",
  logo_url: "",
};

export const EMPTY_INVENTORY_FORM: InventorySettingsFormValues = {
  inventory_method: "",
  costing_method: "",
  cost_per_warehouse: false,
  cost_per_cost_center: false,
  cost_per_expiry_date: false,
  cost_per_serial_number: false,
  manufacturing_produce_expiry_policy: "min_component",
};
