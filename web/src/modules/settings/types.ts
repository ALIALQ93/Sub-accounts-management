export type AppRole = "admin" | "accountant" | "viewer";

export interface UserProfile {
  id: string;
  email: string;
  full_name_ar: string;
  full_name_en: string | null;
  role: AppRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CompanySettings {
  id: number;
  legal_name_ar: string;
  legal_name_en: string | null;
  tax_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  fiscal_year_start_month: number;
  base_currency_id: string | null;
  updated_at?: string;
}

export interface CompanySettingsFormValues {
  legal_name_ar: string;
  legal_name_en: string;
  tax_number: string;
  address: string;
  phone: string;
  email: string;
  fiscal_year_start_month: number;
  base_currency_id: string;
}

export interface CreateUserFormValues {
  email: string;
  password: string;
  full_name_ar: string;
  full_name_en: string;
  role: AppRole;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  accountant: "محاسب",
  viewer: "عرض فقط",
};

export const FISCAL_MONTHS = [
  { value: 1, label: "يناير" },
  { value: 2, label: "فبراير" },
  { value: 3, label: "مارس" },
  { value: 4, label: "أبريل" },
  { value: 5, label: "مايو" },
  { value: 6, label: "يونيو" },
  { value: 7, label: "يوليو" },
  { value: 8, label: "أغسطس" },
  { value: 9, label: "سبتمبر" },
  { value: 10, label: "أكتوبر" },
  { value: 11, label: "نوفمبر" },
  { value: 12, label: "ديسمبر" },
];
