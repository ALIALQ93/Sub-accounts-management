import { currencyApi } from "@/modules/currencies/services/currency-api";
import { formatCurrencyAmount } from "@/modules/currencies/utils/convert-amount";
import type { Currency } from "@/modules/currencies/types";
import type { Account } from "@/modules/vouchers/types";

export function getCurrencyById(
  currencies: Currency[],
  currencyId: string,
): Currency | undefined {
  return currencies.find((currency) => currency.id === currencyId);
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

export async function resolveVoucherExchangeRate(params: {
  currencyId: string;
  voucherDate: string;
  currencies: Currency[];
}): Promise<number> {
  const { currencyId, voucherDate, currencies } = params;
  const currency = getCurrencyById(currencies, currencyId);
  if (!currency || currency.is_base) {
    return 1;
  }

  try {
    return await currencyApi.getExchangeRateAtDate(currencyId, voucherDate);
  } catch {
    return currency.exchange_rate > 0 ? currency.exchange_rate : 1;
  }
}

export function validateVoucherExchangeRate(params: {
  currencyId: string;
  exchangeRate: number;
  currencies: Currency[];
}): string | null {
  const { currencyId, exchangeRate, currencies } = params;
  const currency = getCurrencyById(currencies, currencyId);
  if (!currency) {
    return "عملة السند غير صالحة.";
  }
  if (currency.is_base) {
    return null;
  }
  if (!exchangeRate || exchangeRate <= 0) {
    return "أدخل سعر صرف صالحاً للعملة الأجنبية.";
  }
  return null;
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

  if (!getCurrencyById(currencies, currencyId)) {
    return "عملة السند غير صالحة.";
  }

  const accountById = new Map(accounts.map((account) => [account.id, account]));

  if (!receiptAccountId) {
    return "حساب القبض غير معرّف. عيّنه من إعدادات السندات.";
  }

  if (!accountById.get(receiptAccountId)) {
    return "حساب القبض غير موجود أو غير نشط.";
  }

  for (const line of creditLines) {
    if (!line.account_id) continue;
    if (!accountById.get(line.account_id)) {
      return "أحد حسابات الأسطر غير موجود أو غير نشط.";
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

  if (!getCurrencyById(currencies, currencyId)) {
    return "عملة السند غير صالحة.";
  }

  const accountById = new Map(accounts.map((account) => [account.id, account]));

  if (!paymentAccountId) {
    return "حساب الدفع غير معرّف. عيّنه من إعدادات السندات.";
  }

  if (!accountById.get(paymentAccountId)) {
    return "حساب الدفع غير موجود أو غير نشط.";
  }

  for (const line of debitLines) {
    if (!line.account_id) continue;
    if (!accountById.get(line.account_id)) {
      return "أحد حسابات الأسطر غير موجود أو غير نشط.";
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

  if (!getCurrencyById(currencies, currencyId)) {
    return "عملة السند غير صالحة.";
  }

  const accountById = new Map(accounts.map((account) => [account.id, account]));

  if (!clearingAccountId) {
    return "الحساب الوسيط غير معرّف. عيّنه من إعدادات السندات.";
  }

  if (!accountById.get(clearingAccountId)) {
    return "الحساب الوسيط غير موجود أو غير نشط.";
  }

  for (const line of userLines) {
    if (!line.account_id) continue;
    if (!accountById.get(line.account_id)) {
      return "أحد حسابات الأسطر غير موجود أو غير نشط.";
    }
    if (line.account_id === clearingAccountId) {
      return "لا يمكن أن يكون الحساب الوسيط هو نفس حساب أحد أسطر السند.";
    }
  }

  return null;
}
