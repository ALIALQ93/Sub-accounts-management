import { buildAccountTree } from "@/modules/accounts/utils/account-tree";
import { convertAmount } from "@/modules/currencies/utils/convert-amount";
import type { Currency } from "@/modules/currencies/types";
import type { Account, TrialBalanceRow } from "@/modules/vouchers/types";

export type TrialBalanceCurrencyMode = "all" | "base" | "native";

export interface TrialBalanceQueryParams {
  fromDate?: string;
  toDate?: string;
  currencyId?: string;
  currencyMode?: TrialBalanceCurrencyMode;
  accountId?: string;
  accountSubtree?: boolean;
  costCenterId?: string;
  periodId?: string;
  aggregateTree?: boolean;
  hideZero?: boolean;
  search?: string;
}

function emptyRow(account: Account): TrialBalanceRow {
  return {
    account_id: account.id,
    account_code: account.code,
    account_name: account.name_ar,
    currency_id: account.currency_id ?? null,
    parent_id: account.parent_id ?? null,
    is_postable: account.is_postable,
    is_aggregated: false,
    depth: 0,
    opening_entry_balance: 0,
    opening_balance: 0,
    period_debit: 0,
    period_credit: 0,
    closing_balance: 0,
    debit: 0,
    credit: 0,
    balance: 0,
  };
}

function addRowAmounts(target: TrialBalanceRow, source: TrialBalanceRow): void {
  target.opening_entry_balance =
    (target.opening_entry_balance ?? 0) + (source.opening_entry_balance ?? 0);
  target.opening_balance += source.opening_balance;
  target.period_debit += source.period_debit;
  target.period_credit += source.period_credit;
  target.closing_balance += source.closing_balance;
  target.debit += source.period_debit;
  target.credit += source.period_credit;
  target.balance += source.closing_balance;
}

function normalizeRow(row: TrialBalanceRow): TrialBalanceRow {
  return {
    ...row,
    debit: row.period_debit,
    credit: row.period_credit,
    balance: row.closing_balance,
  };
}

export function mapRpcTrialBalanceRow(raw: {
  account_id: string;
  account_code: string;
  account_name: string;
  currency_id: string | null;
  parent_id: string | null;
  is_postable: boolean;
  opening_entry_balance?: number | string | null;
  opening_balance: number | string;
  period_debit: number | string;
  period_credit: number | string;
  closing_balance: number | string;
}): TrialBalanceRow {
  const openingEntry = Number(raw.opening_entry_balance ?? 0);
  const opening = Number(raw.opening_balance ?? 0);
  const debit = Number(raw.period_debit ?? 0);
  const credit = Number(raw.period_credit ?? 0);
  const closing = Number(raw.closing_balance ?? 0);

  return normalizeRow({
    account_id: raw.account_id,
    account_code: raw.account_code,
    account_name: raw.account_name,
    currency_id: raw.currency_id,
    parent_id: raw.parent_id,
    is_postable: raw.is_postable,
    is_aggregated: false,
    depth: 0,
    opening_entry_balance: openingEntry,
    opening_balance: opening,
    period_debit: debit,
    period_credit: credit,
    closing_balance: closing,
    debit,
    credit,
    balance: closing,
  });
}

export function aggregateTrialBalanceTree(
  postableRows: TrialBalanceRow[],
  accounts: Account[],
): TrialBalanceRow[] {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const rowsById = new Map<string, TrialBalanceRow>();

  for (const row of postableRows) {
    rowsById.set(row.account_id, { ...row, is_aggregated: false });

    let parentId = row.parent_id ?? accountsById.get(row.account_id)?.parent_id ?? null;
    while (parentId) {
      const parent = accountsById.get(parentId);
      if (!parent) break;

      if (!rowsById.has(parentId)) {
        rowsById.set(parentId, {
          ...emptyRow(parent),
          is_aggregated: true,
        });
      }

      addRowAmounts(rowsById.get(parentId)!, row);
      parentId = parent.parent_id ?? null;
    }
  }

  const tree = buildAccountTree(accounts);
  const ordered: TrialBalanceRow[] = [];

  const walk = (nodes: ReturnType<typeof buildAccountTree>, depth: number) => {
    for (const node of nodes) {
      const row = rowsById.get(node.id);
      if (row && hasTrialBalanceActivity(row)) {
        ordered.push({ ...row, depth });
      }
      if (node.children.length > 0) {
        walk(node.children, depth + 1);
      }
    }
  };

  walk(tree, 0);
  return ordered.map(normalizeRow);
}

export function hasTrialBalanceActivity(row: TrialBalanceRow): boolean {
  return (
    Math.abs(row.opening_entry_balance ?? 0) > 0.000001 ||
    Math.abs(row.opening_balance) > 0.000001 ||
    Math.abs(row.period_debit) > 0.000001 ||
    Math.abs(row.period_credit) > 0.000001 ||
    Math.abs(row.closing_balance) > 0.000001
  );
}

export function applyHideZeroRows(rows: TrialBalanceRow[]): TrialBalanceRow[] {
  return rows.filter(hasTrialBalanceActivity);
}

/**
 * يعرض صفوف ميزان المراجعة بعملة مناسبة.
 *
 * مهم: `get_trial_balance` يُرجع كل المبالغ بعملة الشركة الأساسية
 * (`debit_base` / `credit_base`) دائماً. `currency_id` على الصف وصف لعملة الحساب فقط.
 *
 * - `base`: إبقاء الأرقام كما هي + وسم عملة الأساس (بدون تحويل إضافي).
 * - `native` / `all`: تحويل من الأساس → عملة الحساب للعرض، ثم وسم عملة الحساب.
 */
export function applyTrialBalanceCurrencyDisplay(
  rows: TrialBalanceRow[],
  currencies: Currency[],
  mode: TrialBalanceCurrencyMode,
): { rows: TrialBalanceRow[]; displayCurrency?: Currency } {
  const baseCurrency = currencies.find((currency) => currency.is_base) ?? currencies[0];
  if (!baseCurrency) return { rows };

  const baseRate = baseCurrency.exchange_rate > 0 ? baseCurrency.exchange_rate : 1;

  if (mode === "base") {
    const converted = rows.map((row) =>
      normalizeRow({
        ...row,
        currency_id: baseCurrency.id,
        currency_code: baseCurrency.code,
      }),
    );
    return { rows: converted, displayCurrency: baseCurrency };
  }

  // native / all — المبالغ واردة بعملة الأساس؛ حوّل لعملة الحساب عند العرض
  const withNative = rows.map((row) => {
    const accountCurrency = row.currency_id
      ? currencies.find((item) => item.id === row.currency_id)
      : undefined;

    const isAlreadyBase =
      !accountCurrency ||
      accountCurrency.is_base ||
      accountCurrency.id === baseCurrency.id;

    if (isAlreadyBase) {
      return normalizeRow({
        ...row,
        currency_id: accountCurrency?.id ?? baseCurrency.id,
        currency_code: accountCurrency?.code ?? baseCurrency.code,
      });
    }

    const toRate =
      accountCurrency.exchange_rate > 0 ? accountCurrency.exchange_rate : 1;

    const convertFromBase = (amount: number) =>
      convertAmount(amount, baseRate, toRate);

    return normalizeRow({
      ...row,
      currency_id: accountCurrency.id,
      currency_code: accountCurrency.code,
      opening_entry_balance: convertFromBase(row.opening_entry_balance ?? 0),
      opening_balance: convertFromBase(row.opening_balance),
      period_debit: convertFromBase(row.period_debit),
      period_credit: convertFromBase(row.period_credit),
      closing_balance: convertFromBase(row.closing_balance),
      debit: convertFromBase(row.period_debit),
      credit: convertFromBase(row.period_credit),
      balance: convertFromBase(row.closing_balance),
    });
  });

  return { rows: withNative };
}

export function filterTrialBalanceSearch(
  rows: TrialBalanceRow[],
  search: string,
): TrialBalanceRow[] {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter(
    (row) =>
      row.account_code.toLowerCase().includes(query) ||
      row.account_name.toLowerCase().includes(query),
  );
}

export function computeTrialBalanceTotals(rows: TrialBalanceRow[], postableOnly = true) {
  const source = postableOnly
    ? rows.filter((row) => row.is_postable && !row.is_aggregated)
    : rows;

  return source.reduce(
    (acc, row) => {
      acc.openingEntry += row.opening_entry_balance ?? 0;
      acc.opening += row.opening_balance;
      acc.debit += row.period_debit;
      acc.credit += row.period_credit;
      acc.closing += row.closing_balance;
      return acc;
    },
    { openingEntry: 0, opening: 0, debit: 0, credit: 0, closing: 0 },
  );
}

export function countDistinctTrialBalanceCurrencies(rows: TrialBalanceRow[]): number {
  return new Set(rows.map((row) => row.currency_id).filter(Boolean)).size;
}

export function buildTrialBalanceShareParams(
  params: TrialBalanceQueryParams,
): Record<string, string | undefined> {
  return {
    from: params.fromDate,
    to: params.toDate,
    q: params.search,
    currency: params.currencyMode === "base" ? "base" : params.currencyId,
    accountId: params.accountId,
    accountSubtree: params.accountSubtree === false ? "0" : undefined,
    costCenterId: params.costCenterId,
    periodId: params.periodId,
    tree: params.aggregateTree ? "1" : undefined,
    hideZero: params.hideZero ? "1" : undefined,
  };
}

export function parseTrialBalanceShareParams(
  searchParams: URLSearchParams,
): TrialBalanceQueryParams {
  const currencyParam = searchParams.get("currency") ?? "";
  return {
    fromDate: searchParams.get("from") ?? "",
    toDate: searchParams.get("to") ?? "",
    search: searchParams.get("q") ?? "",
    currencyMode: currencyParam === "base" ? "base" : "native",
    currencyId:
      currencyParam && currencyParam !== "base" ? currencyParam : undefined,
    accountId: searchParams.get("accountId") ?? "",
    accountSubtree: searchParams.get("accountSubtree") !== "0",
    costCenterId: searchParams.get("costCenterId") ?? "",
    periodId: searchParams.get("periodId") ?? "",
    aggregateTree: searchParams.get("tree") === "1",
    hideZero: searchParams.get("hideZero") === "1",
  };
}
