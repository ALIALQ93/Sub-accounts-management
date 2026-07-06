"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  CompanyInventorySettings,
  InventorySettingsFormValues,
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

const DEFAULT_SETTINGS: CompanyInventorySettings = {
  id: 1,
  inventory_method: null,
  costing_method: null,
  cost_per_warehouse: false,
  cost_per_cost_center: false,
  track_quantity_on_movement: true,
  foundation_locked: false,
  foundation_locked_at: null,
  first_posted_inventory_at: null,
};

export const inventorySettingsApi = {
  async getSettings(): Promise<CompanyInventorySettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("company_inventory_settings")
      .select(
        `
        id,
        inventory_method,
        costing_method,
        cost_per_warehouse,
        cost_per_cost_center,
        track_quantity_on_movement,
        foundation_locked,
        foundation_locked_at,
        first_posted_inventory_at
      `,
      )
      .eq("id", 1)
      .maybeSingle();

    if (isMissingTable(error)) return DEFAULT_SETTINGS;
    throwIfSupabaseError(error);
    return (data as CompanyInventorySettings | null) ?? DEFAULT_SETTINGS;
  },

  async updateSettings(
    payload: InventorySettingsFormValues,
  ): Promise<CompanyInventorySettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("company_inventory_settings")
      .update({
        inventory_method: payload.inventory_method || null,
        costing_method: payload.costing_method || null,
        cost_per_warehouse: payload.cost_per_warehouse,
        cost_per_cost_center: payload.cost_per_cost_center,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select(
        `
        id,
        inventory_method,
        costing_method,
        cost_per_warehouse,
        cost_per_cost_center,
        track_quantity_on_movement,
        foundation_locked,
        foundation_locked_at,
        first_posted_inventory_at
      `,
      )
      .single();
    throwIfSupabaseError(error);
    return data as CompanyInventorySettings;
  },
};
