import type { Account } from "@/modules/vouchers/types";

export function getPartyParentAccountOptions(accounts: Account[]): Account[] {
  const nonPostable = accounts.filter(
    (account) => account.is_active && !account.is_postable,
  );

  if (nonPostable.length > 0) {
    return nonPostable.sort((a, b) => a.code.localeCompare(b.code, "ar"));
  }

  return accounts
    .filter((account) => account.is_active)
    .sort((a, b) => a.code.localeCompare(b.code, "ar"));
}
