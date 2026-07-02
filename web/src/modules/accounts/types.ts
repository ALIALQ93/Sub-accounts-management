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
  journal_entry_id: string;
  entry_no: string;
  entry_date: string;
  journal_description: string | null;
  line_description: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  source_type: string | null;
  source_id: string | null;
  voucher_no: string | null;
}

export interface AccountStatementResult {
  opening_balance: number;
  lines: AccountStatementLine[];
  total_debit: number;
  total_credit: number;
  closing_balance: number;
}
