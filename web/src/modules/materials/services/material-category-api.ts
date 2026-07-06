"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  MaterialCategory,
  MaterialCategoryFormValues,
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

export const materialCategoryApi = {
  async listCategories(): Promise<MaterialCategory[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("material_categories")
      .select("id, category_code, name_ar, name_en, parent_id, is_active")
      .order("category_code", { ascending: true });

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);
    return (data ?? []) as MaterialCategory[];
  },

  async createCategory(payload: MaterialCategoryFormValues): Promise<MaterialCategory> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("material_categories")
      .insert({
        category_code: payload.category_code.trim().toUpperCase(),
        name_ar: payload.name_ar.trim(),
        name_en: payload.name_en.trim() || null,
        parent_id: payload.parent_id || null,
        is_active: payload.is_active,
      })
      .select("id, category_code, name_ar, name_en, parent_id, is_active")
      .single();
    throwIfSupabaseError(error);
    return data as MaterialCategory;
  },

  async updateCategory(
    id: string,
    payload: Partial<MaterialCategoryFormValues>,
  ): Promise<MaterialCategory> {
    const supabase = getSupabaseClient();
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.category_code != null) {
      patch.category_code = payload.category_code.trim().toUpperCase();
    }
    if (payload.name_ar != null) patch.name_ar = payload.name_ar.trim();
    if (payload.name_en != null) patch.name_en = payload.name_en.trim() || null;
    if (payload.parent_id != null) patch.parent_id = payload.parent_id || null;
    if (payload.is_active != null) patch.is_active = payload.is_active;

    const { data, error } = await supabase
      .from("material_categories")
      .update(patch)
      .eq("id", id)
      .select("id, category_code, name_ar, name_en, parent_id, is_active")
      .single();
    throwIfSupabaseError(error);
    return data as MaterialCategory;
  },
};
