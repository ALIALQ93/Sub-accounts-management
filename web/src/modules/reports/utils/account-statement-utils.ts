import type { AccountStatementLine } from "@/modules/accounts/types";
import { convertAmount } from "@/modules/currencies/utils/convert-amount";
import type { Currency } from "@/modules/currencies/types";

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
