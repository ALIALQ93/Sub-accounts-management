"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Warehouse, WarehouseFormValues } from "@/modules/materials/types";
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

export const warehouseApi = {
  async listWarehouses(): Promise<Warehouse[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("warehouses")
      .select(
        `
        id,
        warehouse_code,
        name_ar,
        name_en,
        branch_id,
        is_active,
        branches ( branch_code, name_ar )
      `,
      )
      .order("warehouse_code", { ascending: true });

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);

    return (data ?? []).map((row) => {
      const branch = row.branches as
        | { branch_code: string; name_ar: string }
        | { branch_code: string; name_ar: string }[]
        | null;
      const branchRow = Array.isArray(branch) ? branch[0] : branch;
      const warehouse = row as Warehouse;
      return {
        ...warehouse,
        branch_code: branchRow?.branch_code,
        branch_name_ar: branchRow?.name_ar,
      };
    });
  },

  async createWarehouse(payload: WarehouseFormValues): Promise<Warehouse> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("warehouses")
      .insert({
        warehouse_code: payload.warehouse_code.trim().toUpperCase(),
        name_ar: payload.name_ar.trim(),
        name_en: payload.name_en.trim() || null,
        branch_id: payload.branch_id,
        is_active: payload.is_active,
      })
      .select("id, warehouse_code, name_ar, name_en, branch_id, is_active")
      .single();
    throwIfSupabaseError(error);
    return data as Warehouse;
  },

  async updateWarehouse(
    id: string,
    payload: Partial<WarehouseFormValues>,
  ): Promise<Warehouse> {
    const supabase = getSupabaseClient();
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.warehouse_code != null) {
      patch.warehouse_code = payload.warehouse_code.trim().toUpperCase();
    }
    if (payload.name_ar != null) patch.name_ar = payload.name_ar.trim();
    if (payload.name_en != null) patch.name_en = payload.name_en.trim() || null;
    if (payload.branch_id != null) patch.branch_id = payload.branch_id;
    if (payload.is_active != null) patch.is_active = payload.is_active;

    const { data, error } = await supabase
      .from("warehouses")
      .update(patch)
      .eq("id", id)
      .select("id, warehouse_code, name_ar, name_en, branch_id, is_active")
      .single();
    throwIfSupabaseError(error);
    return data as Warehouse;
  },
};
