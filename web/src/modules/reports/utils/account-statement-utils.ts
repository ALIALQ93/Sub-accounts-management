import type { AccountStatementLine } from "@/modules/accounts/types";
import { convertAmount } from "@/modules/currencies/utils/convert-amount";
import type { Currency } from "@/modules/currencies/types";

export function effectiveBaseAmounts(params: {
  debit: number;
  credit: number;
  debitBase: number;
  creditBase: number;
  exchangeRate: number | null;
}): { debitBase: number; creditBase: number } {
  if (params.debitBase > 0 || params.creditBase > 0) {
    return { debitBase: params.debitBase, creditBase: params.creditBase };
  }
  const rate = params.exchangeRate && params.exchangeRate > 0 ? params.exchangeRate : 1;
  return {
    debitBase: params.debit * rate,
    creditBase: params.credit * rate,
  };
}

export function resolveStatementLineAmounts(params: {
  debit: number;
  credit: number;
  debitBase: number;
  creditBase: number;
  lineCurrencyId: string | null;
  lineExchangeRate: number | null;
  accountCurrencyId: string | null;
  displayCurrency: Currency;
  currencies: Currency[];
}): {
  debit: number;
  credit: number;
  nativeDebit: number;
  nativeCredit: number;
  nativeCurrencyCode: string | null;
  lineExchangeRate: number | null;
  amountsConverted: boolean;
} {
  const baseCurrency = params.currencies.find((currency) => currency.is_base);
  const lineCurrency = params.lineCurrencyId
    ? params.currencies.find((currency) => currency.id === params.lineCurrencyId)
    : undefined;
  const accountCurrency = params.accountCurrencyId
    ? params.currencies.find((currency) => currency.id === params.accountCurrencyId)
    : undefined;

  const nativeDebit = params.debit;
  const nativeCredit = params.credit;
  const nativeCurrencyCode =
    lineCurrency?.code ?? accountCurrency?.code ?? null;
  const { debitBase, creditBase } = effectiveBaseAmounts({
    debit: params.debit,
    credit: params.credit,
    debitBase: params.debitBase,
    creditBase: params.creditBase,
    exchangeRate: params.lineExchangeRate,
  });

  if (params.lineCurrencyId) {
    if (params.displayCurrency.id === params.lineCurrencyId) {
      return {
        debit: nativeDebit,
        credit: nativeCredit,
        nativeDebit,
        nativeCredit,
        nativeCurrencyCode,
        lineExchangeRate: params.lineExchangeRate,
        amountsConverted: false,
      };
    }

    if (
      params.displayCurrency.is_base ||
      params.displayCurrency.id === baseCurrency?.id
    ) {
      return {
        debit: debitBase,
        credit: creditBase,
        nativeDebit,
        nativeCredit,
        nativeCurrencyCode,
        lineExchangeRate: params.lineExchangeRate,
        amountsConverted: true,
      };
    }

    return {
      debit:
        debitBase > 0
          ? convertAmount(debitBase, 1, params.displayCurrency.exchange_rate)
          : 0,
      credit:
        creditBase > 0
          ? convertAmount(creditBase, 1, params.displayCurrency.exchange_rate)
          : 0,
      nativeDebit,
      nativeCredit,
      nativeCurrencyCode,
      lineExchangeRate: params.lineExchangeRate,
      amountsConverted: true,
    };
  }

  if (
    params.accountCurrencyId &&
    params.displayCurrency.id === params.accountCurrencyId
  ) {
    return {
      debit: nativeDebit,
      credit: nativeCredit,
      nativeDebit,
      nativeCredit,
      nativeCurrencyCode,
      lineExchangeRate: null,
      amountsConverted: false,
    };
  }

  if (
    params.displayCurrency.is_base ||
    params.displayCurrency.id === baseCurrency?.id
  ) {
    return {
      debit: debitBase || nativeDebit,
      credit: creditBase || nativeCredit,
      nativeDebit,
      nativeCredit,
      nativeCurrencyCode,
      lineExchangeRate: null,
      amountsConverted: Boolean(
        params.accountCurrencyId &&
          params.accountCurrencyId !== baseCurrency?.id,
      ),
    };
  }

  if (accountCurrency) {
    return {
      debit: convertAmount(
        nativeDebit,
        accountCurrency.exchange_rate,
        params.displayCurrency.exchange_rate,
      ),
      credit: convertAmount(
        nativeCredit,
        accountCurrency.exchange_rate,
        params.displayCurrency.exchange_rate,
      ),
      nativeDebit,
      nativeCredit,
      nativeCurrencyCode,
      lineExchangeRate: null,
      amountsConverted: true,
    };
  }

  return {
    debit: nativeDebit,
    credit: nativeCredit,
    nativeDebit,
    nativeCredit,
    nativeCurrencyCode,
    lineExchangeRate: params.lineExchangeRate,
    amountsConverted: false,
  };
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
      line.line_currency_code,
      line.entry_no,
      line.voucher_no,
      line.line_description,
      line.voucher_description,
      line.journal_description,
      line.cost_center_code,
      line.cost_center_name,
      line.line_exchange_rate?.toString(),
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
  line_exchange_rate?: number | null;
  line_currency_code?: string | null;
}): string {
  const parts: string[] = [];
  if (line.account_sub_code?.trim()) {
    parts.push(`كود فرعي: ${line.account_sub_code.trim()}`);
  }
  if (line.line_currency_code && line.line_exchange_rate) {
    parts.push(
      `سعر السند: ${line.line_exchange_rate} (${line.line_currency_code})`,
    );
  }
  if (line.line_description?.trim()) {
    parts.push(`سطر: ${line.line_description.trim()}`);
  }
  if (line.voucher_description?.trim()) {
    parts.push(`سند: ${line.voucher_description.trim()}`);
  }
  return parts.join("\n");
}

export function accountMatchesDisplayCurrency(
  accountCurrencyId: string | null | undefined,
  displayCurrencyId: string,
): boolean {
  return Boolean(accountCurrencyId && accountCurrencyId === displayCurrencyId);
}
