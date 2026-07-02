import type {
  AccountChildBalanceBreakdown,
  AccountDirectBalance,
  AccountDisplayBalance,
} from "@/modules/currencies/types";
import { convertAmount } from "@/modules/currencies/utils/convert-amount";
import type { AccountTreeNode } from "@/modules/accounts/types";
import type { Account } from "@/modules/vouchers/types";
import type { Currency } from "@/modules/currencies/types";

function emptyDirectBalance(accountId: string): AccountDirectBalance {
  return { account_id: accountId, debit: 0, credit: 0, balance: 0 };
}

function getCurrencyMap(currencies: Currency[]): Map<string, Currency> {
  return new Map(currencies.map((currency) => [currency.id, currency]));
}

function computeNodeDisplayBalance(
  node: AccountTreeNode,
  directByAccount: Map<string, AccountDirectBalance>,
  currencyById: Map<string, Currency>,
): AccountDisplayBalance {
  const accountCurrency = node.currency_id
    ? currencyById.get(node.currency_id)
    : undefined;

  const currencyCode = accountCurrency?.code ?? "—";
  const currencySymbol = accountCurrency?.symbol ?? "";
  const decimalPlaces = accountCurrency?.decimal_places ?? 2;
  const targetRate = accountCurrency?.exchange_rate ?? 1;

  const direct = directByAccount.get(node.id) ?? emptyDirectBalance(node.id);

  if (node.is_postable) {
    return {
      account_id: node.id,
      currency_code: currencyCode,
      currency_symbol: currencySymbol,
      decimal_places: decimalPlaces,
      direct_debit: direct.debit,
      direct_credit: direct.credit,
      direct_balance: direct.balance,
      display_debit: direct.debit,
      display_credit: direct.credit,
      display_balance: direct.balance,
      is_aggregated: false,
    };
  }

  let displayDebit = 0;
  let displayCredit = 0;
  let displayBalance = 0;

  for (const child of node.children) {
    const childBalance = computeNodeDisplayBalance(
      child,
      directByAccount,
      currencyById,
    );
    const childCurrency = child.currency_id
      ? currencyById.get(child.currency_id)
      : undefined;
    const childRate = childCurrency?.exchange_rate ?? 1;

    displayDebit += convertAmount(
      childBalance.display_debit,
      childRate,
      targetRate,
    );
    displayCredit += convertAmount(
      childBalance.display_credit,
      childRate,
      targetRate,
    );
    displayBalance += convertAmount(
      childBalance.display_balance,
      childRate,
      targetRate,
    );
  }

  return {
    account_id: node.id,
    currency_code: currencyCode,
    currency_symbol: currencySymbol,
    decimal_places: decimalPlaces,
    direct_debit: direct.debit,
    direct_credit: direct.credit,
    direct_balance: direct.balance,
    display_debit: displayDebit,
    display_credit: displayCredit,
    display_balance: displayBalance,
    is_aggregated: node.children.length > 0,
  };
}

export function computeAccountDisplayBalances(
  tree: AccountTreeNode[],
  directBalances: AccountDirectBalance[],
  currencies: Currency[],
): Map<string, AccountDisplayBalance> {
  const directByAccount = new Map(
    directBalances.map((row) => [row.account_id, row]),
  );
  const currencyById = getCurrencyMap(currencies);
  const result = new Map<string, AccountDisplayBalance>();

  const walk = (nodes: AccountTreeNode[]) => {
    for (const node of nodes) {
      result.set(
        node.id,
        computeNodeDisplayBalance(node, directByAccount, currencyById),
      );
      walk(node.children);
    }
  };

  walk(tree);
  return result;
}

export function buildChildBalanceBreakdown(
  node: AccountTreeNode,
  directByAccount: Map<string, AccountDirectBalance>,
  currencies: Currency[],
): AccountChildBalanceBreakdown[] {
  const currencyById = getCurrencyMap(currencies);
  const parentCurrency = node.currency_id
    ? currencyById.get(node.currency_id)
    : undefined;
  const parentRate = parentCurrency?.exchange_rate ?? 1;

  return node.children.map((child) => {
    const childCurrency = child.currency_id
      ? currencyById.get(child.currency_id)
      : undefined;
    const childRate = childCurrency?.exchange_rate ?? 1;
    const childBalance = computeNodeDisplayBalance(
      child,
      directByAccount,
      currencyById,
    );

    return {
      account_id: child.id,
      code: child.code,
      name_ar: child.name_ar,
      currency_code: childCurrency?.code ?? "—",
      currency_symbol: childCurrency?.symbol ?? "",
      decimal_places: childCurrency?.decimal_places ?? 2,
      debit: childBalance.display_debit,
      credit: childBalance.display_credit,
      balance: childBalance.display_balance,
      converted_debit: convertAmount(
        childBalance.display_debit,
        childRate,
        parentRate,
      ),
      converted_credit: convertAmount(
        childBalance.display_credit,
        childRate,
        parentRate,
      ),
      converted_balance: convertAmount(
        childBalance.display_balance,
        childRate,
        parentRate,
      ),
    };
  });
}

export function buildDirectBalanceMap(
  directBalances: AccountDirectBalance[],
): Map<string, AccountDirectBalance> {
  return new Map(directBalances.map((row) => [row.account_id, row]));
}

export function findAccountInTree(
  nodes: AccountTreeNode[],
  accountId: string,
): AccountTreeNode | null {
  for (const node of nodes) {
    if (node.id === accountId) return node;
    const found = findAccountInTree(node.children, accountId);
    if (found) return found;
  }
  return null;
}

export function getDefaultCurrencyId(
  currencies: Currency[],
  parentId?: string,
  accounts?: Account[],
): string {
  if (parentId && accounts) {
    const parent = accounts.find((account) => account.id === parentId);
    if (parent?.currency_id) return parent.currency_id;
  }

  const base = currencies.find((currency) => currency.is_base && currency.is_active);
  if (base) return base.id;

  const active = currencies.find((currency) => currency.is_active);
  return active?.id ?? currencies[0]?.id ?? "";
}
