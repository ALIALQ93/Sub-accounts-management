export type InvoiceDirection = "input" | "output";

export type InvoiceCommercialKind =
  | "sale"
  | "purchase"
  | "transfer_out"
  | "transfer_in"
  | "return_sale"
  | "return_purchase"
  | "opening_stock";

export type InvoiceSettlementMode = "credit" | "cash";

export type InvoiceNumberingReset = "never" | "yearly" | "monthly";

export interface InvoicePattern {
  id: string;
  pattern_no: number;
  name_ar: string;
  name_en: string | null;
  secrecy_level: number;
  direction: InvoiceDirection;
  commercial_kind: string;
  is_return: boolean;
  is_opening_stock: boolean;
  is_active: boolean;
  sort_order: number;
  default_branch_id: string | null;
  default_cost_center_id: string | null;
  default_currency_id: string | null;
  default_warehouse_id: string | null;
  target_warehouse_id: string | null;
  default_creditor_account_id: string | null;
  default_debtor_account_id: string | null;
  default_cost_account_id: string | null;
  default_inventory_account_id: string | null;
  default_discount_account_id: string | null;
  default_extra_account_id: string | null;
  transfer_transit_account_id: string | null;
  generate_journal: boolean;
  auto_post: boolean;
  cc_on_goods: boolean;
  cc_on_party: boolean;
  warehouse_movement: boolean;
  load_party_currency: boolean;
  default_settlement_mode: InvoiceSettlementMode;
  payment_terms_enabled: boolean;
  default_payment_terms_days: number | null;
  rounding_enabled: boolean;
  rounding_target: "invoice_total" | "line_amount" | "both" | null;
  rounding_mode: "nearest" | "up" | "down" | null;
  rounding_step: number | null;
  discount_enabled: boolean;
  max_discount_percent: number | null;
  discount_applies_to: "line" | "invoice" | null;
  line_extra_enabled: boolean;
  line_adjustments_affect_material_cost: boolean;
  reservation_enabled: boolean;
  reserve_on_save: boolean;
  release_on_cancel: boolean;
  reservation_days: number | null;
  numbering_prefix: string;
  numbering_padding: number;
  numbering_include_year: boolean;
  numbering_start: number;
  numbering_reset: InvoiceNumberingReset;
  paired_input_pattern_id: string | null;
  reference_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SalesRepOption {
  id: string;
  rep_code: string;
  name_ar: string;
  is_active: boolean;
}

export interface InvoicePatternListItem {
  id: string;
  pattern_no: number;
  name_ar: string;
  name_en: string | null;
  direction: InvoiceDirection;
  commercial_kind: string;
  is_active: boolean;
  sort_order: number;
  default_settlement_mode: InvoiceSettlementMode;
}

export type InvoiceStatus = "draft" | "posted" | "cancelled";

export interface InvoicePatternConditions {
  pattern_id: string;
  require_party: boolean;
  require_sales_rep: boolean;
  require_cost_center: boolean;
  require_receipt_no: boolean;
  prevent_duplicate_receipt_no: boolean;
  require_payment_terms: boolean;
  require_warehouse: boolean;
  require_color: boolean;
  require_size: boolean;
  require_source: boolean;
  require_caliber: boolean;
}

export interface InvoiceListItem {
  id: string;
  invoice_no: string;
  invoice_date: string;
  status: InvoiceStatus;
  settlement_mode: InvoiceSettlementMode;
  pattern_id: string;
  pattern_name_ar?: string;
  commercial_kind?: string;
  branch_name_ar?: string;
  party_name_ar?: string;
  material_total?: number;
  created_at: string;
}

export interface InvoiceHeader {
  id: string;
  pattern_id: string;
  invoice_no: string;
  invoice_date: string;
  branch_id: string;
  cost_center_id: string | null;
  customer_id: string | null;
  vendor_id: string | null;
  creditor_account_id: string | null;
  debtor_account_id: string | null;
  cost_account_id: string | null;
  inventory_account_id: string | null;
  discount_account_id: string | null;
  extra_account_id: string | null;
  commission_account_id: string | null;
  transfer_transit_account_id: string | null;
  settlement_mode: InvoiceSettlementMode;
  payment_terms_days: number | null;
  due_date: string | null;
  currency_id: string | null;
  exchange_rate: number | null;
  receipt_no: string | null;
  sales_rep_id: string | null;
  reference_invoice_id: string | null;
  reference_closed_at: string | null;
  invoice_discount_percent: number | null;
  invoice_discount_amount: number;
  description: string | null;
  status: InvoiceStatus;
  journal_entry_id: string | null;
  inventory_transfer_id: string | null;
  transfer_role: "out" | "in" | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceMaterialLine {
  id: string;
  invoice_id: string;
  line_no: number;
  branch_id: string;
  cost_center_id: string | null;
  warehouse_id: string;
  material_id: string;
  material_unit_id: string;
  quantity: number;
  quantity_base: number;
  unit_price: number;
  line_amount: number;
  discount_percent?: number | null;
  discount_amount?: number;
  extra_percent?: number | null;
  extra_amount?: number;
  qty_received?: number | null;
  line_description: string | null;
  expiry_date?: string | null;
  serial_number?: string | null;
  material_code?: string;
  material_name_ar?: string;
  unit_name_ar?: string;
  warehouse_code?: string;
}

export interface InvoiceAccountLine {
  id: string;
  invoice_id: string;
  line_no: number;
  branch_id: string;
  cost_center_id: string | null;
  account_id: string;
  side: "debit" | "credit";
  amount: number;
  description: string | null;
  account_code?: string;
  account_name?: string;
}

export interface InvoiceDetail {
  header: InvoiceHeader;
  pattern: InvoicePattern;
  materialLines: InvoiceMaterialLine[];
  accountLines: InvoiceAccountLine[];
}

export interface MaterialOption {
  id: string;
  material_code: string;
  name_ar: string;
  name_en: string | null;
  category_id: string | null;
  sale_price: number;
  purchase_price: number;
  is_active: boolean;
  barcode?: string | null;
  has_expiry_date?: boolean;
  expiry_days?: number | null;
  require_expiry_on_inbound?: boolean;
  require_expiry_on_outbound?: boolean;
  has_serial_number?: boolean;
  require_serial_on_inbound?: boolean;
  require_serial_on_outbound?: boolean;
}

export interface MaterialUnitOption {
  id: string;
  material_id: string;
  unit_code: string;
  name_ar: string;
  is_base_unit: boolean;
  factor_to_base: number;
  is_active: boolean;
}

export interface MaterialCategoryOption {
  id: string;
  category_code: string;
  name_ar: string;
  is_active: boolean;
}

export type TransferStatus =
  | "draft"
  | "dispatched"
  | "in_transit"
  | "partially_received"
  | "received"
  | "cancelled";

export interface InventoryTransferListItem {
  id: string;
  transfer_no: string;
  status: TransferStatus;
  from_branch_name_ar?: string;
  to_branch_name_ar?: string;
  out_invoice_id: string | null;
  in_invoice_id: string | null;
  created_at: string;
}

export interface InventoryTransferLine {
  id: string;
  transfer_id: string;
  line_no: number;
  material_id: string;
  material_unit_id: string;
  qty_ordered: number;
  qty_shipped: number;
  qty_received: number;
  material_code?: string;
  material_name_ar?: string;
  unit_name_ar?: string;
}

export interface InventoryTransferDetail {
  id: string;
  transfer_no: string;
  from_branch_id: string;
  to_branch_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  out_invoice_id: string | null;
  in_invoice_id: string | null;
  status: TransferStatus;
  notes: string | null;
  lines: InventoryTransferLine[];
}
