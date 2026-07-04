import type { AccountStatementLine } from "@/modules/accounts/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import { convertAmount } from "@/modules/currencies/utils/convert-amount";
import type { Currency } from "@/modules/currencies/types";

export type ExchangeRateCache = Map<string, number>;

export function rateCacheKey(currencyId: string, asOfDate: string): string {
  return `${currencyId}:${asOfDate}`;
}

export async function getCachedExchangeRate(
  currencyId: string,
  asOfDate: string,
  currencies: Currency[],
  cache: ExchangeRateCache,
): Promise<number> {
  const currency = currencies.find((item) => item.id === currencyId);
  if (!currency || currency.is_base) {
    return 1;
  }

  const key = rateCacheKey(currencyId, asOfDate);
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  try {
    const rate = await currencyApi.getExchangeRateAtDate(currencyId, asOfDate);
    cache.set(key, rate > 0 ? rate : currency.exchange_rate);
    return cache.get(key)!;
  } catch {
    const fallback = currency.exchange_rate > 0 ? currency.exchange_rate : 1;
    cache.set(key, fallback);
    return fallback;
  }
}

export async function convertStatementAmountAtDate(
  amount: number,
  accountCurrencyId: string | null | undefined,
  displayCurrency: Currency,
  currencies: Currency[],
  asOfDate: string,
  cache: ExchangeRateCache,
): Promise<number> {
  if (!amount) return 0;

  const accountCurrency = accountCurrencyId
    ? currencies.find((currency) => currency.id === accountCurrencyId)
    : undefined;

  if (!accountCurrency || accountCurrency.id === displayCurrency.id) {
    return amount;
  }

  const [fromRate, toRate] = await Promise.all([
    getCachedExchangeRate(accountCurrency.id, asOfDate, currencies, cache),
    displayCurrency.is_base
      ? Promise.resolve(1)
      : getCachedExchangeRate(displayCurrency.id, asOfDate, currencies, cache),
  ]);

  return convertAmount(amount, fromRate, toRate);
}

export function convertStatementAmount(
  amount: number,
  accountCurrencyId: string | null | undefined,
  displayCurrency: Currency,
  currencies: Currency[],
): number {
  if (!amount) return 0;
  const accountCurrency = accountCurrencyId
    ? currencies.find((currency) => currency.id === accountCurrencyId)
    : undefined;
  if (!accountCurrency || accountCurrency.id === displayCurrency.id) {
    return amount;
  }
  return convertAmount(
    amount,
    accountCurrency.exchange_rate,
    displayCurrency.exchange_rate,
  );
}

export function filterAccountStatementLines(
  lines: AccountStatementLine[],
  search: string,
): AccountStatementLine[] {
  const query = search.trim().toLowerCase();
  if (!query) return lines;

  return lines.filter((line) => {
    const haystack = [
      line.account_code,
      line.account_name,
      line.account_sub_code,
      line.account_currency_code,
      line.entry_no,
      line.voucher_no,
      line.line_description,
      line.voucher_description,
      line.journal_description,
      line.cost_center_code,
      line.cost_center_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function parseAccountStatementShareParams(searchParams: URLSearchParams) {
  const accountIdsParam = searchParams.get("accountIds") ?? "";
  const legacyAccountId = searchParams.get("accountId") ?? "";
  const accountIds = accountIdsParam
    ? accountIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : legacyAccountId
      ? [legacyAccountId]
      : [];

  return {
    accountIds,
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    costCenterId: searchParams.get("costCenterId") ?? "",
    search: searchParams.get("q") ?? "",
    displayCurrencyId: searchParams.get("currency") ?? "",
    onlyDisplayCurrency: searchParams.get("onlyCurrency") === "1",
  };
}

export function buildAccountStatementShareParams(params: {
  accountIds?: string[];
  fromDate?: string;
  toDate?: string;
  costCenterId?: string;
  search?: string;
  displayCurrencyId?: string;
  onlyDisplayCurrency?: boolean;
}): Record<string, string | undefined> {
  const accountIds = (params.accountIds ?? []).filter(Boolean);
  return {
    accountIds: accountIds.length > 0 ? accountIds.join(",") : undefined,
    accountId: accountIds.length === 1 ? accountIds[0] : undefined,
    from: params.fromDate,
    to: params.toDate,
    costCenterId: params.costCenterId,
    q: params.search,
    currency: params.displayCurrencyId,
    onlyCurrency: params.onlyDisplayCurrency ? "1" : undefined,
  };
}

export function resolveDisplayCurrency(
  currencies: Currency[],
  displayCurrencyId: string,
  fallbackAccountCurrencyId?: string | null,
): Currency | undefined {
  if (displayCurrencyId) {
    return currencies.find((currency) => currency.id === displayCurrencyId);
  }
  if (fallbackAccountCurrencyId) {
    return currencies.find((currency) => currency.id === fallbackAccountCurrencyId);
  }
  return currencies.find((currency) => currency.is_base) ?? currencies[0];
}

export function formatStatementNotes(line: {
  account_sub_code?: string | null;
  line_description?: string | null;
  voucher_description?: string | null;
}): string {
  const parts: string[] = [];
  if (line.account_sub_code?.trim()) {
    parts.push(`كود فرعي: ${line.account_sub_code.trim()}`);
  }
  if (line.line_description?.trim()) {
    parts.push(`سطر: ${line.line_description.trim()}`);
  }
  if (line.voucher_description?.trim()) {
    parts.push(`سند: ${line.voucher_description.trim()}`);
  }
  return parts.join("\n");
}

export function statementAmountsConverted(
  accountCurrencyId: string | null | undefined,
  displayCurrencyId: string,
): boolean {
  return Boolean(
    accountCurrencyId && accountCurrencyId !== displayCurrencyId,
  );
}
