export interface PosPaymentMethod {
  id: string;
  pos_point_id: string;
  account_id: string;
  label_ar: string;
  label_en: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  account_code?: string;
  account_name_ar?: string;
}

export interface PosPaymentMethodFormValues {
  id?: string;
  account_id: string;
  label_ar: string;
  label_en: string;
  is_default: boolean;
  is_active: boolean;
}

export interface PosPoint {
  id: string;
  point_code: string;
  name_ar: string;
  name_en: string | null;
  branch_id: string;
  warehouse_id: string;
  invoice_pattern_id: string;
  default_customer_id: string | null;
  default_debtor_account_id: string | null;
  default_creditor_account_id: string | null;
  receipt_header: string | null;
  receipt_footer: string | null;
  allow_price_override: boolean;
  allow_line_discount: boolean;
  require_customer: boolean;
  is_active: boolean;
  sort_order: number;
  branch_code?: string;
  branch_name_ar?: string;
  warehouse_code?: string;
  warehouse_name_ar?: string;
  pattern_name_ar?: string;
}

export interface PosPointDetail extends PosPoint {
  payment_methods: PosPaymentMethod[];
  allowed_material_ids: string[];
  allowed_category_ids: string[];
}

export interface PosPointFormValues {
  point_code: string;
  name_ar: string;
  name_en: string;
  branch_id: string;
  warehouse_id: string;
  invoice_pattern_id: string;
  default_customer_id: string;
  default_debtor_account_id: string;
  default_creditor_account_id: string;
  receipt_header: string;
  receipt_footer: string;
  allow_price_override: boolean;
  allow_line_discount: boolean;
  require_customer: boolean;
  is_active: boolean;
  sort_order: number;
  payment_methods: PosPaymentMethodFormValues[];
  allowed_material_ids: string[];
  allowed_category_ids: string[];
}

export interface PosCartLine {
  key: string;
  material_id: string;
  material_unit_id: string;
  material_code: string;
  name_ar: string;
  unit_code: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
}
