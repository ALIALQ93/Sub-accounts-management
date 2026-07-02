export interface Currency {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  exchange_rate: number;
  decimal_places: number;
  is_base: boolean;
  is_active: boolean;
}

export interface CurrencyFormValues {
  exchange_rate: number;
  is_active: boolean;
}

export interface AccountDirectBalance {
  account_id: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface AccountDisplayBalance {
  account_id: string;
  currency_code: string;
  currency_symbol: string;
  decimal_places: number;
  direct_debit: number;
  direct_credit: number;
  direct_balance: number;
  display_debit: number;
  display_credit: number;
  display_balance: number;
  is_aggregated: boolean;
}

export interface AccountChildBalanceBreakdown {
  account_id: string;
  code: string;
  name_ar: string;
  currency_code: string;
  currency_symbol: string;
  decimal_places: number;
  debit: number;
  credit: number;
  balance: number;
  converted_debit: number;
  converted_credit: number;
  converted_balance: number;
}
