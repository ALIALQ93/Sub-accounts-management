"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  AccountDirectBalance,
  Currency,
  CurrencyRateHistoryEntry,
} from "@/modules/currencies/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

export const currencyApi = {
  async listCurrencies(): Promise<Currency[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("currencies")
      .select("*")
      .order("is_base", { ascending: false })
      .order("code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []).map((row) => ({
      ...(row as Currency),
      exchange_rate: Number((row as Currency).exchange_rate),
      decimal_places: Number((row as Currency).decimal_places),
    }));
  },

  async listActiveCurrencies(): Promise<Currency[]> {
    const rows = await this.listCurrencies();
    return rows.filter((currency) => currency.is_active);
  },

  async getExchangeRateAtDate(
    currencyId: string,
    asOfDate: string,
  ): Promise<number> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_currency_rate_at_date", {
      p_currency_id: currencyId,
      p_as_of: asOfDate,
    });
    throwIfSupabaseError(error);
    const rate = Number(data ?? 1);
    return rate > 0 ? rate : 1;
  },

  async updateCurrency(
    id: string,
    payload: Partial<Pick<Currency, "exchange_rate" | "is_active">>,
  ): Promise<Currency> {
    if (payload.exchange_rate !== undefined) {
      throw new Error(
        "Use updateExchangeRate() to change exchange rates — changes are logged in history.",
      );
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("currencies")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return {
      ...(data as Currency),
      exchange_rate: Number((data as Currency).exchange_rate),
      decimal_places: Number((data as Currency).decimal_places),
    };
  },

  async updateExchangeRate(
    currencyId: string,
    exchangeRate: number,
    effectiveFrom?: string,
    note?: string | null,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("update_currency_exchange_rate", {
      p_currency_id: currencyId,
      p_exchange_rate: exchangeRate,
      p_effective_from: effectiveFrom || new Date().toISOString().split("T")[0],
      p_note: note ?? null,
    });
    throwIfSupabaseError(error);
  },

  async listRateHistory(params?: {
    currencyId?: string;
    limit?: number;
  }): Promise<CurrencyRateHistoryEntry[]> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("currency_rate_history")
      .select(
        "id, currency_id, exchange_rate, previous_rate, change_source, effective_from, note, created_at, currencies(code, name_ar)",
      )
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(params?.limit ?? 100);

    if (params?.currencyId) {
      query = query.eq("currency_id", params.currencyId);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);

    return (data ?? []).map((row) => {
      const currency = (row as {
        currencies?: { code?: string; name_ar?: string } | null;
      }).currencies;

      return {
        id: (row as { id: string }).id,
        currency_id: (row as { currency_id: string }).currency_id,
        currency_code: currency?.code ?? "—",
        currency_name_ar: currency?.name_ar ?? "—",
        exchange_rate: Number((row as { exchange_rate: number }).exchange_rate),
        previous_rate:
          (row as { previous_rate?: number | null }).previous_rate == null
            ? null
            : Number((row as { previous_rate?: number | null }).previous_rate),
        change_source: (row as { change_source: CurrencyRateHistoryEntry["change_source"] })
          .change_source,
        effective_from: (row as { effective_from: string }).effective_from,
        note: (row as { note: string | null }).note,
        created_at: (row as { created_at: string }).created_at,
      };
    });
  },

  async hasAccountingActivity(): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("has_accounting_activity");
    throwIfSupabaseError(error);
    return Boolean(data);
  },

  async setBaseCurrency(currencyId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("set_base_currency", {
      p_currency_id: currencyId,
    });
    throwIfSupabaseError(error);
  },

  async listDirectBalances(): Promise<AccountDirectBalance[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("account_direct_balances")
      .select("account_id, debit, credit, balance");
    throwIfSupabaseError(error);

    return (data ?? []).map((row) => ({
      account_id: (row as AccountDirectBalance).account_id,
      debit: Number((row as AccountDirectBalance).debit ?? 0),
      credit: Number((row as AccountDirectBalance).credit ?? 0),
      balance: Number((row as AccountDirectBalance).balance ?? 0),
    }));
  },
};
