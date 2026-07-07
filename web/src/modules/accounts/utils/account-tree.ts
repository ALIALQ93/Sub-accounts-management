import type { Account } from "@/modules/vouchers/types";
import type {
  AccountStats,
  AccountTreeNode,
  FinancialStatement,
  FlatAccountRow,
  StatementFilter,
} from "@/modules/accounts/types";

const BALANCE_SHEET_ROOTS = new Set(["1", "2", "3"]);
const INCOME_STATEMENT_ROOTS = new Set(["4", "5", "6", "7"]);

export function buildAccountsById(
  accounts: Account[],
): Map<string, AccountTreeNode> {
  const byId = new Map<string, AccountTreeNode>();

  for (const account of accounts) {
    byId.set(account.id, {
      ...account,
      children: [],
      childCount: 0,
    });
  }

  return byId;
}

export function buildAccountTree(accounts: Account[]): AccountTreeNode[] {
  const byId = buildAccountsById(accounts);
  const roots: AccountTreeNode[] = [];

  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else if (!node.parent_id) {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: AccountTreeNode[]): AccountTreeNode[] =>
    nodes
      .sort((a, b) => a.code.localeCompare(b.code, "ar"))
      .map((node) => {
        node.children = sortNodes(node.children);
        node.childCount = node.children.length;
        return node;
      });

  return sortNodes(roots);
}

export function flattenAccountTree(
  nodes: AccountTreeNode[],
  expandedIds: Set<string>,
  depth = 0,
): FlatAccountRow[] {
  const rows: FlatAccountRow[] = [];

  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.children.length > 0 && expandedIds.has(node.id)) {
      rows.push(...flattenAccountTree(node.children, expandedIds, depth + 1));
    }
  }

  return rows;
}

export function getRootCode(
  account: Account,
  accountsById: Map<string, Account>,
): string {
  let current: Account | undefined = account;
  const visited = new Set<string>();

  while (current?.parent_id) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    current = accountsById.get(current.parent_id);
  }

  return current?.code ?? account.code;
}

export function getStatementType(
  account: Account,
  accountsById: Map<string, Account>,
): FinancialStatement | null {
  const rootCode = getRootCode(account, accountsById);
  if (BALANCE_SHEET_ROOTS.has(rootCode)) return "balance_sheet";
  if (INCOME_STATEMENT_ROOTS.has(rootCode)) return "income_statement";
  return null;
}

export function getStatementLabel(type: FinancialStatement): string {
  return type === "balance_sheet" ? "الميزانية" : "قائمة الدخل";
}

export function computeAccountStats(accounts: Account[]): AccountStats {
  return {
    total: accounts.length,
    active: accounts.filter((account) => account.is_active).length,
    postable: accounts.filter((account) => account.is_postable).length,
    parent: accounts.filter((account) => !account.is_postable).length,
  };
}

export function collectExpandableIds(nodes: AccountTreeNode[]): string[] {
  const ids: string[] = [];

  const walk = (items: AccountTreeNode[]) => {
    for (const item of items) {
      if (item.children.length > 0) {
        ids.push(item.id);
        walk(item.children);
      }
    }
  };

  walk(nodes);
  return ids;
}

function nodeMatchesQuery(node: AccountTreeNode, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return (
    node.code.toLowerCase().includes(normalized) ||
    node.name_ar.toLowerCase().includes(normalized) ||
    (node.name_en ?? "").toLowerCase().includes(normalized)
  );
}

function filterTreeNodes(
  nodes: AccountTreeNode[],
  query: string,
  statementFilter: StatementFilter,
  accountsById: Map<string, Account>,
): AccountTreeNode[] {
  const filtered: AccountTreeNode[] = [];

  for (const node of nodes) {
    const children = filterTreeNodes(
      node.children,
      query,
      statementFilter,
      accountsById,
    );
    const statementType = getStatementType(node, accountsById);
    const matchesStatement =
      statementFilter === "all" ||
      (statementType !== null && statementType === statementFilter);
    const matchesQuery = nodeMatchesQuery(node, query);
    const childMatched = children.length > 0;

    if ((matchesStatement && matchesQuery) || childMatched) {
      filtered.push({
        ...node,
        children,
        childCount: children.length,
      });
    }
  }

  return filtered;
}

export function getVisibleTree(
  accounts: Account[],
  query: string,
  statementFilter: StatementFilter,
): {
  tree: AccountTreeNode[];
  accountsById: Map<string, Account>;
} {
  const accountsById = buildAccountsById(accounts);
  const fullTree = buildAccountTree(accounts);
  const tree = filterTreeNodes(fullTree, query, statementFilter, accountsById);

  return { tree, accountsById };
}

export function getParentOptions(
  accounts: Account[],
  excludeId?: string,
  accountsWithMovements?: ReadonlySet<string>,
): Account[] {
  return accounts
    .filter((account) => account.is_active && account.id !== excludeId)
    .sort((a, b) => a.code.localeCompare(b.code, "ar"));
}

export function formatParentOptionLabel(
  account: Account,
  accountsWithMovements?: ReadonlySet<string>,
): string {
  const indent = "\u00A0".repeat(((account.level ?? 1) - 1) * 2);
  const movementHint =
    accountsWithMovements?.has(account.id) ? " — عليه حركة" : "";
  return `${indent}${account.code} — ${account.name_ar}${movementHint}`;
}

export function accountHasJournalMovements(
  accountId: string,
  accountsWithMovements?: ReadonlySet<string>,
): boolean {
  return accountsWithMovements?.has(accountId) ?? false;
}

export function isRootAccount(account: Account): boolean {
  return !account.parent_id && (account.level ?? 1) === 1;
}
