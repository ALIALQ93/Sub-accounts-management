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
