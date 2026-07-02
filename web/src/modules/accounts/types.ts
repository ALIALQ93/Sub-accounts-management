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
  code: string;
  name_ar: string;
  parent_id: string;
  is_postable: boolean;
}

export interface AccountStats {
  total: number;
  active: number;
  postable: number;
  parent: number;
}
