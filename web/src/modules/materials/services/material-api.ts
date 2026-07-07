"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
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
  if (error) throw errorFromSupabase(error);
}

function isMissingTable(error: PostgrestError | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "42703"
  );
}

function isMissingMinStockColumn(error: PostgrestError | null): boolean {
  return error?.code === "42703" && (error.message ?? "").includes("min_stock");
}

const MATERIAL_SELECT =
  "id, material_code, name_ar, name_en, category_id, sale_price, purchase_price, inventory_account_id, is_active";

const MATERIAL_SELECT_WITH_MIN =
  `${MATERIAL_SELECT}, min_stock`;

function mapMaterial(row: Material & { min_stock?: number | null }): Material {
  return {
    ...row,
    purchase_price: Number(row.purchase_price),
    sale_price: Number(row.sale_price),
    min_stock: Number(row.min_stock ?? 0),
  };
}

export const materialApi = {
  async listMaterials(): Promise<MaterialListItem[]> {
    const supabase = getSupabaseClient();
    const primary = await supabase
      .from("materials")
      .select(
        `
        ${MATERIAL_SELECT_WITH_MIN},
        material_categories ( category_code, name_ar )
      `,
      )
      .order("material_code", { ascending: true });

    let rows = primary.data;
    let error = primary.error;

    if (isMissingMinStockColumn(error)) {
      const fallback = await supabase
        .from("materials")
        .select(
          `
          ${MATERIAL_SELECT},
          material_categories ( category_code, name_ar )
        `,
        )
        .order("material_code", { ascending: true });
      rows = fallback.data as typeof primary.data;
      error = fallback.error;
    }

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);

    return (rows ?? []).map((row) => {
      const category = row.material_categories as
        | { category_code: string; name_ar: string }
        | { category_code: string; name_ar: string }[]
        | null;
      const categoryRow = Array.isArray(category) ? category[0] : category;
      const material = mapMaterial(row as unknown as Material);
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
    const primary = await supabase
      .from("materials")
      .select(MATERIAL_SELECT_WITH_MIN)
      .eq("id", id)
      .maybeSingle();

    let row = primary.data;
    let error = primary.error;

    if (isMissingMinStockColumn(error)) {
      const fallback = await supabase
        .from("materials")
        .select(MATERIAL_SELECT)
        .eq("id", id)
        .maybeSingle();
      row = fallback.data as typeof primary.data;
      error = fallback.error;
    }

    if (isMissingTable(error)) return null;
    throwIfSupabaseError(error);
    return row ? mapMaterial(row as Material) : null;
  },

  async createMaterial(
    payload: MaterialFormValues,
    baseUnit: MaterialUnitFormValues,
  ): Promise<Material> {
    const supabase = getSupabaseClient();
    const insertPayload: Record<string, unknown> = {
      material_code: payload.material_code.trim().toUpperCase(),
      name_ar: payload.name_ar.trim(),
      name_en: payload.name_en.trim() || null,
      category_id: payload.category_id || null,
      purchase_price: payload.purchase_price,
      sale_price: payload.sale_price,
      inventory_account_id: payload.inventory_account_id || null,
      is_active: payload.is_active,
      min_stock: payload.min_stock,
    };

    const primary = await supabase
      .from("materials")
      .insert(insertPayload)
      .select(MATERIAL_SELECT_WITH_MIN)
      .single();

    let row: Record<string, unknown> | null = null;
    let error = primary.error;

    if (isMissingMinStockColumn(error)) {
      delete insertPayload.min_stock;
      const fallback = await supabase
        .from("materials")
        .insert(insertPayload)
        .select(MATERIAL_SELECT)
        .single();
      row = fallback.data as Record<string, unknown> | null;
      error = fallback.error;
    } else {
      row = primary.data as Record<string, unknown> | null;
    }
    throwIfSupabaseError(error);

    const material = mapMaterial(row as unknown as Material);
    try {
      await this.createMaterialUnit(material.id, {
        ...baseUnit,
        is_base_unit: true,
        factor_to_base: 1,
      });
    } catch (unitError) {
      await supabase.from("materials").delete().eq("id", material.id);
      throw unitError;
    }
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
    if (payload.min_stock != null) patch.min_stock = payload.min_stock;

    const primary = await supabase
      .from("materials")
      .update(patch)
      .eq("id", id)
      .select(MATERIAL_SELECT_WITH_MIN)
      .single();

    let row: Record<string, unknown> | null = null;
    let error = primary.error;

    if (isMissingMinStockColumn(error)) {
      delete patch.min_stock;
      const fallback = await supabase
        .from("materials")
        .update(patch)
        .eq("id", id)
        .select(MATERIAL_SELECT)
        .single();
      row = fallback.data as Record<string, unknown> | null;
      error = fallback.error;
    } else {
      row = primary.data as Record<string, unknown> | null;
    }

    throwIfSupabaseError(error);
    return mapMaterial(row as unknown as Material);
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
