"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { CostCenter } from "@/modules/vouchers/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

export interface CostCenterFormValues {
  code: string;
  name_ar: string;
  name_en: string;
  is_active: boolean;
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

  async createCostCenter(payload: CostCenterFormValues): Promise<CostCenter> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("cost_centers")
      .insert({
        code: payload.code.trim().toUpperCase(),
        name_ar: payload.name_ar.trim(),
        name_en: payload.name_en.trim() || null,
        is_active: payload.is_active,
      })
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as CostCenter;
  },

  async updateCostCenter(
    id: string,
    payload: Partial<CostCenterFormValues>,
  ): Promise<CostCenter> {
    const supabase = getSupabaseClient();
    const updatePayload: Record<string, unknown> = {};

    if (payload.code !== undefined) {
      updatePayload.code = payload.code.trim().toUpperCase();
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
