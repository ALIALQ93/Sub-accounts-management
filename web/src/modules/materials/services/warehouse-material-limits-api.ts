"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) throw errorFromSupabase(error);
}

function isMissingTable(error: PostgrestError | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "42703"
  );
}

export interface WarehouseMaterialLimit {
  id: string;
  warehouse_id: string;
  material_id: string;
  min_stock: number;
  material_code?: string;
  material_name_ar?: string;
}

export const warehouseMaterialLimitsApi = {
  async listByWarehouse(warehouseId: string): Promise<WarehouseMaterialLimit[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("warehouse_material_limits")
      .select(
        `
        id,
        warehouse_id,
        material_id,
        min_stock,
        materials ( material_code, name_ar )
      `,
      )
      .eq("warehouse_id", warehouseId)
      .order("material_id");

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);

    return (data ?? []).map((row) => {
      const material = row.materials as
        | { material_code: string; name_ar: string }
        | { material_code: string; name_ar: string }[]
        | null;
      const materialRow = Array.isArray(material) ? material[0] : material;
      return {
        id: String(row.id),
        warehouse_id: String(row.warehouse_id),
        material_id: String(row.material_id),
        min_stock: Number(row.min_stock),
        material_code: materialRow?.material_code,
        material_name_ar: materialRow?.name_ar,
      };
    });
  },

  async listAll(): Promise<WarehouseMaterialLimit[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("warehouse_material_limits")
      .select("id, warehouse_id, material_id, min_stock");

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);

    return (data ?? []).map((row) => ({
      id: String(row.id),
      warehouse_id: String(row.warehouse_id),
      material_id: String(row.material_id),
      min_stock: Number(row.min_stock),
    }));
  },

  async upsertLimit(
    warehouseId: string,
    materialId: string,
    minStock: number,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("warehouse_material_limits").upsert(
      {
        warehouse_id: warehouseId,
        material_id: materialId,
        min_stock: minStock,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "warehouse_id,material_id" },
    );
    if (isMissingTable(error)) {
      throw new Error(
        "جدول warehouse_material_limits غير متوفر — شغّل patch_inventory_phase5.sql.",
      );
    }
    throwIfSupabaseError(error);
  },

  async deleteLimit(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("warehouse_material_limits")
      .delete()
      .eq("id", id);
    if (isMissingTable(error)) return;
    throwIfSupabaseError(error);
  },
};
