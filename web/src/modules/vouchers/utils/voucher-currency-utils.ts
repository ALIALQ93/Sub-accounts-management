import { formatCurrencyAmount } from "@/modules/currencies/utils/convert-amount";
import type { Currency } from "@/modules/currencies/types";
import type { Account } from "@/modules/vouchers/types";

export function getCurrencyById(
  currencies: Currency[],
  currencyId: string,
): Currency | undefined {
  return currencies.find((currency) => currency.id === currencyId);
}

export function filterAccountsForVoucherCurrency(
  accounts: Account[],
  currencyId: string,
): Account[] {
  if (!currencyId) return accounts;
  return accounts.filter((account) => account.currency_id === currencyId);
}

export function accountMatchesVoucherCurrency(
  account: Account | undefined | null,
  currencyId: string,
): boolean {
  if (!account || !currencyId) return false;
  return account.currency_id === currencyId;
}

export function getAmountStep(decimalPlaces: number): string {
  if (decimalPlaces <= 0) return "1";
  return `0.${"0".repeat(decimalPlaces - 1)}1`;
}

export function formatVoucherAmount(
  amount: number,
  currency?: Currency,
): string {
  const decimalPlaces = currency?.decimal_places ?? 2;
  const formatted = formatCurrencyAmount(amount, decimalPlaces);
  return currency?.code ? `${formatted} ${currency.code}` : formatted;
}

export function validateReceiptVoucherAccounts(params: {
  currencyId: string;
  receiptAccountId: string;
  creditLines: Array<{ account_id?: string }>;
  accounts: Account[];
  currencies: Currency[];
}): string | null {
  const { currencyId, receiptAccountId, creditLines, accounts, currencies } =
    params;

  if (!currencyId) {
    return "اختر عملة السند.";
  }

  const voucherCurrency = getCurrencyById(currencies, currencyId);
  if (!voucherCurrency) {
    return "عملة السند غير صالحة.";
  }

  const accountById = new Map(accounts.map((account) => [account.id, account]));

  if (!receiptAccountId) {
    return "حساب القبض غير معرّف. عيّنه من إعدادات السندات.";
  }

  const receiptAccount = accountById.get(receiptAccountId);
  if (!receiptAccount) {
    return "حساب القبض غير موجود أو غير نشط.";
  }

  if (!accountMatchesVoucherCurrency(receiptAccount, currencyId)) {
    const accountCurrency = receiptAccount.currency_id
      ? getCurrencyById(currencies, receiptAccount.currency_id)
      : undefined;
    return `حساب القبض (${receiptAccount.code}) بعملة ${
      accountCurrency?.code ?? "—"
    } لا يطابق عملة السند (${voucherCurrency.code}). عدّل الإعدادات أو غيّر عملة السند.`;
  }

  for (const line of creditLines) {
    if (!line.account_id) continue;
    const lineAccount = accountById.get(line.account_id);
    if (!lineAccount) {
      return "أحد حسابات الأسطر غير موجود أو غير نشط.";
    }
    if (!accountMatchesVoucherCurrency(lineAccount, currencyId)) {
      const lineCurrency = lineAccount.currency_id
        ? getCurrencyById(currencies, lineAccount.currency_id)
        : undefined;
      return `حساب ${lineAccount.code} بعملة ${
        lineCurrency?.code ?? "—"
      } لا يطابق عملة السند (${voucherCurrency.code}).`;
    }
    if (line.account_id === receiptAccountId) {
      return "لا يمكن أن يكون حساب القبض هو نفس حساب سطر الدائن.";
    }
  }

  return null;
}

export function validatePaymentVoucherAccounts(params: {
  currencyId: string;
  paymentAccountId: string;
  debitLines: Array<{ account_id?: string }>;
  accounts: Account[];
  currencies: Currency[];
}): string | null {
  const { currencyId, paymentAccountId, debitLines, accounts, currencies } =
    params;

  if (!currencyId) {
    return "اختر عملة السند.";
  }

  const voucherCurrency = getCurrencyById(currencies, currencyId);
  if (!voucherCurrency) {
    return "عملة السند غير صالحة.";
  }

  const accountById = new Map(accounts.map((account) => [account.id, account]));

  if (!paymentAccountId) {
    return "حساب الدفع غير معرّف. عيّنه من إعدادات السندات.";
  }

  const paymentAccount = accountById.get(paymentAccountId);
  if (!paymentAccount) {
    return "حساب الدفع غير موجود أو غير نشط.";
  }

  if (!accountMatchesVoucherCurrency(paymentAccount, currencyId)) {
    const accountCurrency = paymentAccount.currency_id
      ? getCurrencyById(currencies, paymentAccount.currency_id)
      : undefined;
    return `حساب الدفع (${paymentAccount.code}) بعملة ${
      accountCurrency?.code ?? "—"
    } لا يطابق عملة السند (${voucherCurrency.code}). عدّل الإعدادات أو غيّر عملة السند.`;
  }

  for (const line of debitLines) {
    if (!line.account_id) continue;
    const lineAccount = accountById.get(line.account_id);
    if (!lineAccount) {
      return "أحد حسابات الأسطر غير موجود أو غير نشط.";
    }
    if (!accountMatchesVoucherCurrency(lineAccount, currencyId)) {
      const lineCurrency = lineAccount.currency_id
        ? getCurrencyById(currencies, lineAccount.currency_id)
        : undefined;
      return `حساب ${lineAccount.code} بعملة ${
        lineCurrency?.code ?? "—"
      } لا يطابق عملة السند (${voucherCurrency.code}).`;
    }
    if (line.account_id === paymentAccountId) {
      return "لا يمكن أن يكون حساب الدفع هو نفس حساب سطر المدين.";
    }
  }

  return null;
}

export function validateSettlementVoucherAccounts(params: {
  currencyId: string;
  clearingAccountId: string;
  userLines: Array<{ account_id?: string; side?: string }>;
  accounts: Account[];
  currencies: Currency[];
}): string | null {
  const { currencyId, clearingAccountId, userLines, accounts, currencies } =
    params;

  if (!currencyId) {
    return "اختر عملة السند.";
  }

  const voucherCurrency = getCurrencyById(currencies, currencyId);
  if (!voucherCurrency) {
    return "عملة السند غير صالحة.";
  }

  const accountById = new Map(accounts.map((account) => [account.id, account]));

  if (!clearingAccountId) {
    return "الحساب الوسيط غير معرّف. عيّنه من إعدادات السندات.";
  }

  const clearingAccount = accountById.get(clearingAccountId);
  if (!clearingAccount) {
    return "الحساب الوسيط غير موجود أو غير نشط.";
  }

  if (!accountMatchesVoucherCurrency(clearingAccount, currencyId)) {
    const accountCurrency = clearingAccount.currency_id
      ? getCurrencyById(currencies, clearingAccount.currency_id)
      : undefined;
    return `الحساب الوسيط (${clearingAccount.code}) بعملة ${
      accountCurrency?.code ?? "—"
    } لا يطابق عملة السند (${voucherCurrency.code}). عدّل الإعدادات أو غيّر عملة السند.`;
  }

  for (const line of userLines) {
    if (!line.account_id) continue;
    const lineAccount = accountById.get(line.account_id);
    if (!lineAccount) {
      return "أحد حسابات الأسطر غير موجود أو غير نشط.";
    }
    if (!accountMatchesVoucherCurrency(lineAccount, currencyId)) {
      const lineCurrency = lineAccount.currency_id
        ? getCurrencyById(currencies, lineAccount.currency_id)
        : undefined;
      return `حساب ${lineAccount.code} بعملة ${
        lineCurrency?.code ?? "—"
      } لا يطابق عملة السند (${voucherCurrency.code}).`;
    }
    if (line.account_id === clearingAccountId) {
      return "لا يمكن أن يكون الحساب الوسيط هو نفس حساب أحد أسطر السند.";
    }
  }

  return null;
}
