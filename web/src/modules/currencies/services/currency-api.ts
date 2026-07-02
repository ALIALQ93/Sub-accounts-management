"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { AccountDirectBalance, Currency } from "@/modules/currencies/types";
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

  async updateCurrency(
    id: string,
    payload: Partial<Pick<Currency, "exchange_rate" | "is_active">>,
  ): Promise<Currency> {
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
