"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { MaterialCategoryOption, MaterialOption, MaterialUnitOption } from "@/modules/invoices/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

export const materialApi = {
  async listMaterials(): Promise<MaterialOption[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("materials")
      .select(
        "id, material_code, name_ar, name_en, category_id, sale_price, purchase_price, is_active",
      )
      .order("material_code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []).map((row) => ({
      ...(row as MaterialOption),
      sale_price: Number((row as MaterialOption).sale_price),
      purchase_price: Number((row as MaterialOption).purchase_price),
    }));
  },

  async listMaterialCategories(): Promise<MaterialCategoryOption[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("material_categories")
      .select("id, category_code, name_ar, is_active")
      .order("category_code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as MaterialCategoryOption[];
  },

  async listMaterialUnits(materialId: string): Promise<MaterialUnitOption[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("material_units")
      .select("id, material_id, unit_code, name_ar, is_base_unit, factor_to_base, is_active")
      .eq("material_id", materialId)
      .eq("is_active", true)
      .order("is_base_unit", { ascending: false })
      .order("unit_code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []).map((row) => ({
      ...(row as MaterialUnitOption),
      factor_to_base: Number((row as MaterialUnitOption).factor_to_base),
    }));
  },
};
