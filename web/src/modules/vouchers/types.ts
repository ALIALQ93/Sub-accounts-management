export type VoucherType = "receipt" | "payment" | "settlement";
export type SettlementMode = "account" | "invoice";
export type VoucherStatus = "draft" | "approved" | "posted" | "cancelled";
export type VoucherLineSide = "debit" | "credit";

export interface VoucherHeader {
  id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  settlement_mode: SettlementMode;
  voucher_date: string;
  description: string | null;
  status: VoucherStatus;
  customer_id: string | null;
  vendor_id: string | null;
  journal_entry_id: string | null;
  currency_id?: string | null;
  cost_center_id?: string | null;
  exchange_rate?: number | null;
  branch_id?: string | null;
  is_opening_entry?: boolean;
}

export interface VoucherLine {
  id: string;
  voucher_id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  side: VoucherLineSide;
  amount: number;
  line_description: string | null;
  cost_center_id?: string | null;
  line_category_id?: string | null;
  category_quantity?: number | null;
  cc_optional?: boolean;
}

export interface VoucherLineCategory {
  id: string;
  voucher_type: VoucherType;
  code: string;
  name_ar: string;
  name_en: string | null;
  requires_quantity: boolean;
  quantity_label: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  sub_code?: string | null;
  name_ar: string;
  name_en: string | null;
  is_active: boolean;
  netting_includes_cash_default?: boolean;
}

export interface VoucherTypeDefaults {
  voucher_type: VoucherType;
  default_account_id: string | null;
  default_currency_id: string | null;
  default_cost_center_id: string | null;
  auto_post_enabled: boolean;
}

export interface VoucherAllocation {
  id: string;
  voucher_id: string;
  target_journal_line_id: string;
  target_reference?: string;
  applied_amount: number;
  note: string | null;
}

export interface VoucherAttachment {
  id: string;
  voucher_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface VoucherDetails {
  header: VoucherHeader;
  lines: VoucherLine[];
  allocations: VoucherAllocation[];
  netting_lines?: VoucherNettingLine[];
  attachments?: VoucherAttachment[];
}

export interface PostVoucherResponse {
  voucher_id: string;
  status: "posted";
  journal_entry_id: string;
  journal_entry_no: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface Account {
  id: string;
  code: string;
  sub_code?: string | null;
  name_ar: string;
  name_en?: string | null;
  currency_id?: string | null;
  is_postable: boolean;
  is_active: boolean;
  parent_id: string | null;
  level?: number;
}

export interface VoucherListItem {
  id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  settlement_mode: SettlementMode;
  voucher_date: string;
  status: VoucherStatus;
  description: string | null;
  attachment_count: number;
  currency_id: string | null;
  currency_code: string | null;
  exchange_rate: number | null;
  total_amount: number;
  total_amount_base: number;
}

export type OpenSide = "debit" | "credit";

export interface OpenMovementFilters {
  branchId?: string;
  costCenterId?: string;
  partyType?: "customer" | "vendor";
  partyId?: string;
  openSide?: OpenSide | "all";
  eligibleOnly?: boolean;
  overdueOnly?: boolean;
}

export interface OpenMovement {
  target_journal_line_id: string;
  journal_entry_id?: string;
  entry_no: string;
  entry_date?: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  branch_id?: string | null;
  branch_code?: string | null;
  branch_name?: string | null;
  cost_center_id?: string | null;
  cost_center_code?: string | null;
  cost_center_name?: string | null;
  party_type?: string | null;
  party_id?: string | null;
  open_side?: OpenSide | null;
  original_amount?: number;
  allocated_amount?: number;
  open_amount: number;
  due_date?: string | null;
  is_eligible_for_payment?: boolean;
  is_overdue?: boolean;
  source_invoice_id?: string | null;
  line_description: string | null;
}

export type VoucherNettingKind = "cc" | "branch";

export interface VoucherNettingLine {
  id: string;
  voucher_id: string;
  netting_kind: VoucherNettingKind;
  from_cc_id?: string | null;
  to_cc_id?: string | null;
  from_branch_id?: string | null;
  to_branch_id?: string | null;
  amount: number;
  currency_id?: string | null;
  includes_cash: boolean;
  inter_account_id?: string | null;
  note: string | null;
}

export interface Customer {
  id: string;
  customer_code: string;
  name_ar: string;
  phone: string | null;
  email: string | null;
  receivable_account_id: string;
  is_active: boolean;
}

export interface Vendor {
  id: string;
  vendor_code: string;
  name_ar: string;
  phone: string | null;
  email: string | null;
  payable_account_id: string;
  is_active: boolean;
}

export interface JournalEntryListItem {
  id: string;
  entry_no: string;
  entry_date: string;
  status: "draft" | "posted" | "cancelled";
  description: string | null;
  source_type: string | null;
  source_id: string | null;
}

export interface JournalEntryLineDetail {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  line_description: string | null;
  cost_center_id?: string | null;
  cost_center_code?: string | null;
  cost_center_name?: string | null;
}

export interface JournalEntryDetails {
  header: JournalEntryListItem;
  lines: JournalEntryLineDetail[];
}

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  currency_id?: string | null;
  currency_code?: string;
  parent_id?: string | null;
  is_postable: boolean;
  is_aggregated?: boolean;
  depth?: number;
  opening_entry_balance?: number;
  opening_balance: number;
  period_debit: number;
  period_credit: number;
  closing_balance: number;
  /** @deprecated use period_debit */
  debit: number;
  /** @deprecated use period_credit */
  credit: number;
  /** @deprecated use closing_balance */
  balance: number;
}

export interface TrialBalanceParams {
  fromDate?: string;
  toDate?: string;
  currencyId?: string;
  accountId?: string;
  accountSubtree?: boolean;
  costCenterId?: string;
  periodId?: string;
}

export interface DashboardLastMovement {
  type: "voucher" | "journal";
  id: string;
  reference: string;
  date: string;
  description: string | null;
  status: string;
}

export interface DashboardStats {
  voucher_count: number;
  today_journal_count: number;
  total_debit: number;
  total_credit: number;
  last_movement: DashboardLastMovement | null;
}
