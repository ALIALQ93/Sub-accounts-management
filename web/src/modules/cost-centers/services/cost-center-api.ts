"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { generateCostCenterCode } from "@/modules/cost-centers/utils/generate-cost-center-code";
import type { CostCenter } from "@/modules/vouchers/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

function normalizeSubCode(value?: string): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, 30) : null;
}

export interface CostCenterFormValues {
  sub_code?: string;
  name_ar: string;
  name_en: string;
  is_active: boolean;
}

export interface CostCenterBulkInsertRow {
  name_ar: string;
  name_en?: string | null;
  sub_code?: string | null;
}

export const costCenterApi = {
  async listCostCenters(): Promise<CostCenter[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("cost_centers")
      .select("*")
      .order("code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as CostCenter[];
  },

  async peekNextCostCenterCode(): Promise<string> {
    const centers = await this.listCostCenters();
    return generateCostCenterCode(centers);
  },

  async createCostCenter(payload: CostCenterFormValues): Promise<CostCenter> {
    const supabase = getSupabaseClient();
    const existing = await this.listCostCenters();
    const code = generateCostCenterCode(existing);

    const { data, error } = await supabase
      .from("cost_centers")
      .insert({
        code,
        sub_code: normalizeSubCode(payload.sub_code),
        name_ar: payload.name_ar.trim(),
        name_en: payload.name_en.trim() || null,
        is_active: payload.is_active,
      })
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as CostCenter;
  },

  async createCostCentersBulk(
    rows: CostCenterBulkInsertRow[],
  ): Promise<CostCenter[]> {
    if (rows.length === 0) return [];

    const supabase = getSupabaseClient();
    const existing = await this.listCostCenters();
    let working = [...existing];

    const inserts = rows.map((row) => {
      const code = generateCostCenterCode(working);
      const record = {
        code,
        sub_code: normalizeSubCode(row.sub_code ?? undefined),
        name_ar: row.name_ar.trim(),
        name_en: row.name_en?.trim() || null,
        is_active: true,
      };
      working = [
        ...working,
        {
          id: code,
          code,
          sub_code: record.sub_code,
          name_ar: record.name_ar,
          name_en: record.name_en,
          is_active: true,
        },
      ];
      return record;
    });

    const { data, error } = await supabase
      .from("cost_centers")
      .insert(inserts)
      .select("*");
    throwIfSupabaseError(error);
    return (data ?? []) as CostCenter[];
  },

  async updateCostCenter(
    id: string,
    payload: Partial<CostCenterFormValues>,
  ): Promise<CostCenter> {
    const supabase = getSupabaseClient();
    const updatePayload: Record<string, unknown> = {};

    if (payload.sub_code !== undefined) {
      updatePayload.sub_code = normalizeSubCode(payload.sub_code);
    }
    if (payload.name_ar !== undefined) {
      updatePayload.name_ar = payload.name_ar.trim();
    }
    if (payload.name_en !== undefined) {
      updatePayload.name_en = payload.name_en.trim() || null;
    }
    if (payload.is_active !== undefined) {
      updatePayload.is_active = payload.is_active;
    }

    const { data, error } = await supabase
      .from("cost_centers")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as CostCenter;
  },
};
