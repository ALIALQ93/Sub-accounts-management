import type { AccountStatementLine } from "@/modules/accounts/types";

export function filterAccountStatementLines(
  lines: AccountStatementLine[],
  search: string,
): AccountStatementLine[] {
  const query = search.trim().toLowerCase();
  if (!query) return lines;

  return lines.filter((line) => {
    const haystack = [
      line.entry_no,
      line.voucher_no,
      line.line_description,
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
  return {
    accountId: searchParams.get("accountId") ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    costCenterId: searchParams.get("costCenterId") ?? "",
    search: searchParams.get("q") ?? "",
  };
}

export function buildAccountStatementShareParams(params: {
  accountId?: string;
  fromDate?: string;
  toDate?: string;
  costCenterId?: string;
  search?: string;
}): Record<string, string | undefined> {
  return {
    accountId: params.accountId,
    from: params.fromDate,
    to: params.toDate,
    costCenterId: params.costCenterId,
    q: params.search,
  };
}
