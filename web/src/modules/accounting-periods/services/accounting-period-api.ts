"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

function isMissingTable(error: PostgrestError | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "42703"
  );
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type AccountingPeriodStatus = "open" | "closed";

export interface AccountingPeriod {
  id: string;
  period_code: string;
  name_ar: string;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus;
  branch_id: string | null;
  branch_code: string | null;
  branch_name_ar: string | null;
  is_active: boolean;
}

export interface AccountingPeriodFormValues {
  period_code: string;
  name_ar: string;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus;
  branch_id: string;
  is_active: boolean;
}

type Row = {
  id: string;
  period_code: string;
  name_ar: string;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus;
  branch_id: string | null;
  is_active: boolean;
  branches: { branch_code: string; name_ar: string } | { branch_code: string; name_ar: string }[] | null;
};

function mapRow(row: Row): AccountingPeriod {
  const branch = firstRelation(row.branches);
  return {
    id: row.id,
    period_code: row.period_code,
    name_ar: row.name_ar,
    fiscal_year: row.fiscal_year,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    branch_id: row.branch_id,
    branch_code: branch?.branch_code ?? null,
    branch_name_ar: branch?.name_ar ?? null,
    is_active: row.is_active,
  };
}

export const accountingPeriodApi = {
  async listPeriods(): Promise<AccountingPeriod[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounting_periods")
      .select(
        `
        id,
        period_code,
        name_ar,
        fiscal_year,
        start_date,
        end_date,
        status,
        branch_id,
        is_active,
        branches ( branch_code, name_ar )
      `,
      )
      .order("fiscal_year", { ascending: false })
      .order("start_date", { ascending: false });

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);
    return ((data ?? []) as unknown as Row[]).map(mapRow);
  },

  async listActivePeriodOptions(): Promise<AccountingPeriod[]> {
    const rows = await this.listPeriods();
    return rows.filter((row) => row.is_active);
  },

  async createPeriod(values: AccountingPeriodFormValues): Promise<AccountingPeriod> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounting_periods")
      .insert({
        period_code: values.period_code.trim(),
        name_ar: values.name_ar.trim(),
        fiscal_year: values.fiscal_year,
        start_date: values.start_date,
        end_date: values.end_date,
        status: values.status,
        branch_id: values.branch_id || null,
        is_active: values.is_active,
      })
      .select(
        `
        id,
        period_code,
        name_ar,
        fiscal_year,
        start_date,
        end_date,
        status,
        branch_id,
        is_active,
        branches ( branch_code, name_ar )
      `,
      )
      .single();
    throwIfSupabaseError(error);
    return mapRow(data as unknown as Row);
  },

  async updatePeriod(
    id: string,
    values: AccountingPeriodFormValues,
  ): Promise<AccountingPeriod> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounting_periods")
      .update({
        period_code: values.period_code.trim(),
        name_ar: values.name_ar.trim(),
        fiscal_year: values.fiscal_year,
        start_date: values.start_date,
        end_date: values.end_date,
        status: values.status,
        branch_id: values.branch_id || null,
        is_active: values.is_active,
      })
      .eq("id", id)
      .select(
        `
        id,
        period_code,
        name_ar,
        fiscal_year,
        start_date,
        end_date,
        status,
        branch_id,
        is_active,
        branches ( branch_code, name_ar )
      `,
      )
      .single();
    throwIfSupabaseError(error);
    return mapRow(data as unknown as Row);
  },
};
