"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
import type {
  UnitCatalogFormValues,
  UnitCatalogItem,
} from "@/modules/materials/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) throw errorFromSupabase(error);
}

function mapUnit(row: UnitCatalogItem): UnitCatalogItem {
  return {
    id: row.id,
    unit_code: row.unit_code,
    name_ar: row.name_ar,
    name_en: row.name_en ?? null,
    is_active: Boolean(row.is_active),
  };
}

export const unitApi = {
  async listUnits(): Promise<UnitCatalogItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("units")
      .select("id, unit_code, name_ar, name_en, is_active")
      .order("unit_code", { ascending: true });
    throwIfSupabaseError(error);
    return ((data ?? []) as UnitCatalogItem[]).map(mapUnit);
  },

  async createUnit(payload: UnitCatalogFormValues): Promise<UnitCatalogItem> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("units")
      .insert({
        unit_code: payload.unit_code.trim().toUpperCase(),
        name_ar: payload.name_ar.trim(),
        name_en: payload.name_en.trim() || null,
        is_active: payload.is_active,
      })
      .select("id, unit_code, name_ar, name_en, is_active")
      .single();
    throwIfSupabaseError(error);
    return mapUnit(data as UnitCatalogItem);
  },

  async updateUnit(
    id: string,
    payload: Partial<UnitCatalogFormValues>,
  ): Promise<UnitCatalogItem> {
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

    const { data, error } = await supabase
      .from("units")
      .update(patch)
      .eq("id", id)
      .select("id, unit_code, name_ar, name_en, is_active")
      .single();
    throwIfSupabaseError(error);
    return mapUnit(data as UnitCatalogItem);
  },
};
