"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { VoucherLineCategory, VoucherType } from "@/modules/vouchers/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

export interface VoucherLineCategoryFormValues {
  code: string;
  name_ar: string;
  name_en?: string;
  requires_quantity: boolean;
  quantity_label?: string;
  sort_order?: number;
  is_active?: boolean;
}

export const voucherLineCategoryApi = {
  async listCategories(
    voucherType?: VoucherType,
    activeOnly = false,
  ): Promise<VoucherLineCategory[]> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("voucher_line_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name_ar", { ascending: true });

    if (voucherType) {
      query = query.eq("voucher_type", voucherType);
    }
    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return (data ?? []) as VoucherLineCategory[];
  },

  async createCategory(
    voucherType: VoucherType,
    payload: VoucherLineCategoryFormValues,
  ): Promise<VoucherLineCategory> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_line_categories")
      .insert({
        voucher_type: voucherType,
        code: payload.code.trim().toUpperCase(),
        name_ar: payload.name_ar.trim(),
        name_en: payload.name_en?.trim() || null,
        requires_quantity: payload.requires_quantity,
        quantity_label: payload.requires_quantity
          ? payload.quantity_label?.trim() || "العدد"
          : null,
        sort_order: payload.sort_order ?? 0,
        is_active: payload.is_active ?? true,
      })
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherLineCategory;
  },

  async updateCategory(
    id: string,
    payload: Partial<VoucherLineCategoryFormValues>,
  ): Promise<VoucherLineCategory> {
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
    if (payload.requires_quantity !== undefined) {
      updatePayload.requires_quantity = payload.requires_quantity;
      if (!payload.requires_quantity) {
        updatePayload.quantity_label = null;
      }
    }
    if (payload.quantity_label !== undefined) {
      updatePayload.quantity_label = payload.quantity_label.trim() || null;
    }
    if (payload.sort_order !== undefined) {
      updatePayload.sort_order = payload.sort_order;
    }
    if (payload.is_active !== undefined) {
      updatePayload.is_active = payload.is_active;
    }

    const { data, error } = await supabase
      .from("voucher_line_categories")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherLineCategory;
  },
};
