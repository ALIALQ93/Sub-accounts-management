"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  Material,
  MaterialCategory,
  MaterialFormValues,
  MaterialListItem,
  MaterialUnit,
  MaterialUnitFormValues,
} from "@/modules/materials/types";
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

function mapMaterial(row: Material): Material {
  return {
    ...row,
    purchase_price: Number(row.purchase_price),
    sale_price: Number(row.sale_price),
  };
}

export const materialApi = {
  async listMaterials(): Promise<MaterialListItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("materials")
      .select(
        `
        id,
        material_code,
        name_ar,
        name_en,
        category_id,
        sale_price,
        purchase_price,
        inventory_account_id,
        is_active,
        material_categories ( category_code, name_ar )
      `,
      )
      .order("material_code", { ascending: true });

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);

    return (data ?? []).map((row) => {
      const category = row.material_categories as
        | { category_code: string; name_ar: string }
        | { category_code: string; name_ar: string }[]
        | null;
      const categoryRow = Array.isArray(category) ? category[0] : category;
      const material = mapMaterial(row as Material);
      return {
        ...material,
        category_code: categoryRow?.category_code ?? null,
        category_name_ar: categoryRow?.name_ar ?? null,
      };
    });
  },

  async listMaterialCategories(): Promise<MaterialCategory[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("material_categories")
      .select("id, category_code, name_ar, name_en, parent_id, is_active")
      .order("category_code", { ascending: true });

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);
    return (data ?? []) as MaterialCategory[];
  },

  async getMaterialById(id: string): Promise<Material | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("materials")
      .select(
        "id, material_code, name_ar, name_en, category_id, sale_price, purchase_price, inventory_account_id, is_active",
      )
      .eq("id", id)
      .maybeSingle();

    if (isMissingTable(error)) return null;
    throwIfSupabaseError(error);
    return data ? mapMaterial(data as Material) : null;
  },

  async createMaterial(
    payload: MaterialFormValues,
    baseUnit: MaterialUnitFormValues,
  ): Promise<Material> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("materials")
      .insert({
        material_code: payload.material_code.trim().toUpperCase(),
        name_ar: payload.name_ar.trim(),
        name_en: payload.name_en.trim() || null,
        category_id: payload.category_id || null,
        purchase_price: payload.purchase_price,
        sale_price: payload.sale_price,
        inventory_account_id: payload.inventory_account_id || null,
        is_active: payload.is_active,
      })
      .select(
        "id, material_code, name_ar, name_en, category_id, sale_price, purchase_price, inventory_account_id, is_active",
      )
      .single();
    throwIfSupabaseError(error);

    const material = mapMaterial(data as Material);
    await this.createMaterialUnit(material.id, {
      ...baseUnit,
      is_base_unit: true,
      factor_to_base: 1,
    });
    return material;
  },

  async updateMaterial(id: string, payload: Partial<MaterialFormValues>): Promise<Material> {
    const supabase = getSupabaseClient();
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.material_code != null) {
      patch.material_code = payload.material_code.trim().toUpperCase();
    }
    if (payload.name_ar != null) patch.name_ar = payload.name_ar.trim();
    if (payload.name_en != null) patch.name_en = payload.name_en.trim() || null;
    if (payload.category_id != null) patch.category_id = payload.category_id || null;
    if (payload.purchase_price != null) patch.purchase_price = payload.purchase_price;
    if (payload.sale_price != null) patch.sale_price = payload.sale_price;
    if (payload.inventory_account_id != null) {
      patch.inventory_account_id = payload.inventory_account_id || null;
    }
    if (payload.is_active != null) patch.is_active = payload.is_active;

    const { data, error } = await supabase
      .from("materials")
      .update(patch)
      .eq("id", id)
      .select(
        "id, material_code, name_ar, name_en, category_id, sale_price, purchase_price, inventory_account_id, is_active",
      )
      .single();
    throwIfSupabaseError(error);
    return mapMaterial(data as Material);
  },

  async listMaterialUnits(materialId: string): Promise<MaterialUnit[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("material_units")
      .select(
        "id, material_id, unit_code, name_ar, name_en, is_base_unit, factor_to_base, is_active, sort_order",
      )
      .eq("material_id", materialId)
      .order("is_base_unit", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("unit_code", { ascending: true });

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);
    return (data ?? []).map((row) => ({
      ...(row as MaterialUnit),
      factor_to_base: Number((row as MaterialUnit).factor_to_base),
    }));
  },

  async createMaterialUnit(
    materialId: string,
    payload: MaterialUnitFormValues,
  ): Promise<MaterialUnit> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("material_units")
      .insert({
        material_id: materialId,
        unit_code: payload.unit_code.trim().toUpperCase(),
        name_ar: payload.name_ar.trim(),
        name_en: payload.name_en.trim() || null,
        is_base_unit: payload.is_base_unit,
        factor_to_base: payload.is_base_unit ? 1 : payload.factor_to_base,
        is_active: payload.is_active,
      })
      .select(
        "id, material_id, unit_code, name_ar, name_en, is_base_unit, factor_to_base, is_active, sort_order",
      )
      .single();
    throwIfSupabaseError(error);
    return {
      ...(data as MaterialUnit),
      factor_to_base: Number((data as MaterialUnit).factor_to_base),
    };
  },

  async updateMaterialUnit(
    unitId: string,
    payload: Partial<MaterialUnitFormValues>,
  ): Promise<MaterialUnit> {
    const supabase = getSupabaseClient();
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.unit_code != null) {
      patch.unit_code = payload.unit_code.trim().toUpperCase();
    }
    if (payload.name_ar != null) patch.name_ar = payload.name_ar.trim();
    if (payload.name_en != null) patch.name_en = payload.name_en.trim() || null;
    if (payload.is_active != null) patch.is_active = payload.is_active;
    if (payload.factor_to_base != null && !payload.is_base_unit) {
      patch.factor_to_base = payload.factor_to_base;
    }

    const { data, error } = await supabase
      .from("material_units")
      .update(patch)
      .eq("id", unitId)
      .select(
        "id, material_id, unit_code, name_ar, name_en, is_base_unit, factor_to_base, is_active, sort_order",
      )
      .single();
    throwIfSupabaseError(error);
    return {
      ...(data as MaterialUnit),
      factor_to_base: Number((data as MaterialUnit).factor_to_base),
    };
  },
};
