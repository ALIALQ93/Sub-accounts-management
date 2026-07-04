import type { Account } from "@/modules/vouchers/types";

export type FinancialStatement = "balance_sheet" | "income_statement";

export type StatementFilter = "all" | FinancialStatement;

export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  childCount: number;
}

export interface FlatAccountRow {
  node: AccountTreeNode;
  depth: number;
}

export interface AccountFormValues {
  name_ar: string;
  name_en: string;
  parent_id: string;
  currency_id: string;
  is_postable: boolean;
  sub_code?: string;
}

export interface AccountStats {
  total: number;
  active: number;
  postable: number;
  parent: number;
}

export interface AccountStatementLine {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  account_sub_code: string | null;
  account_currency_id: string | null;
  account_currency_code: string | null;
  native_debit: number;
  native_credit: number;
  amounts_converted: boolean;
  journal_entry_id: string;
  entry_no: string;
  entry_date: string;
  journal_description: string | null;
  line_description: string | null;
  voucher_description: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  source_type: string | null;
  source_id: string | null;
  voucher_no: string | null;
  cost_center_id?: string | null;
  cost_center_code?: string | null;
  cost_center_name?: string | null;
}

export interface AccountStatementParams {
  accountId?: string;
  accountIds?: string[];
  fromDate?: string;
  toDate?: string;
  costCenterId?: string;
  displayCurrencyId?: string;
  onlyDisplayCurrency?: boolean;
}

export interface AccountStatementAccountSummary {
  account_id: string;
  account_code: string;
  account_name: string;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
}

export interface AccountStatementResult {
  opening_balance: number;
  lines: AccountStatementLine[];
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  account_summaries: AccountStatementAccountSummary[];
}
