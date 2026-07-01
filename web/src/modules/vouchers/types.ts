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
}

export interface VoucherAllocation {
  id: string;
  voucher_id: string;
  target_journal_line_id: string;
  target_reference?: string;
  applied_amount: number;
  note: string | null;
}

export interface VoucherDetails {
  header: VoucherHeader;
  lines: VoucherLine[];
  allocations: VoucherAllocation[];
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
  name_ar: string;
  is_postable: boolean;
  is_active: boolean;
  parent_id: string | null;
}

export interface VoucherListItem {
  id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  settlement_mode: SettlementMode;
  voucher_date: string;
  status: VoucherStatus;
  description: string | null;
}

export interface OpenMovement {
  target_journal_line_id: string;
  entry_no: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  open_amount: number;
  line_description: string | null;
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

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
}
