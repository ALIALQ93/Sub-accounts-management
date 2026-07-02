import type { Account } from "@/modules/vouchers/types";
import { isRootAccount } from "@/modules/accounts/utils/account-tree";

function parseTrailingNumber(code: string): { prefix: string; num: number; width: number } | null {
  const match = code.match(/^(.*?)(\d+)$/);
  if (!match) return null;

  const [, prefix, numStr] = match;
  return {
    prefix,
    num: parseInt(numStr, 10),
    width: numStr.length,
  };
}

export function generateAccountCode(
  parent: Account,
  allAccounts: Account[],
): string {
  const children = allAccounts.filter((account) => account.parent_id === parent.id);

  if (children.length === 0) {
    if (isRootAccount(parent)) {
      return `${parent.code}10101`;
    }
    return `${parent.code}01`;
  }

  const sortedCodes = children.map((child) => child.code).sort((a, b) => {
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
      return a.length - b.length || a.localeCompare(b, undefined, { numeric: true });
    }
    return a.localeCompare(b, "ar");
  });

  const lastCode = sortedCodes[sortedCodes.length - 1];
  const parsed = parseTrailingNumber(lastCode);

  if (parsed) {
    const next = (parsed.num + 1).toString().padStart(parsed.width, "0");
    let candidate = `${parsed.prefix}${next}`;

    while (allAccounts.some((account) => account.code === candidate)) {
      const reparsed = parseTrailingNumber(candidate);
      if (!reparsed) break;
      const bumped = (reparsed.num + 1).toString().padStart(reparsed.width, "0");
      candidate = `${reparsed.prefix}${bumped}`;
    }

    return candidate.slice(0, 30);
  }

  let index = children.length + 1;
  let candidate = `${parent.code}${String(index).padStart(2, "0")}`;
  while (allAccounts.some((account) => account.code === candidate)) {
    index += 1;
    candidate = `${parent.code}${String(index).padStart(2, "0")}`;
  }

  return candidate.slice(0, 30);
}

export function previewAccountCode(
  parentId: string,
  allAccounts: Account[],
): string {
  const parent = allAccounts.find((account) => account.id === parentId);
  if (!parent) return "—";
  return generateAccountCode(parent, allAccounts);
}
