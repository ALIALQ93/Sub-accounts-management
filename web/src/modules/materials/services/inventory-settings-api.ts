"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  CompanyInventorySettings,
  InventorySettingsFormValues,
  ManufacturingProduceExpiryPolicy,
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

function parseExpiryPolicy(
  value: unknown,
): ManufacturingProduceExpiryPolicy {
  if (
    value === "min_component" ||
    value === "production_plus_days" ||
    value === "min_of_both" ||
    value === "manual"
  ) {
    return value;
  }
  return "min_component";
}

const SETTINGS_SELECT = `
  id,
  inventory_method,
  costing_method,
  cost_per_warehouse,
  cost_per_cost_center,
  cost_per_expiry_date,
  cost_per_serial_number,
  manufacturing_produce_expiry_policy,
  track_quantity_on_movement,
  foundation_locked,
  foundation_locked_at,
  first_posted_inventory_at
`;

const DEFAULT_SETTINGS: CompanyInventorySettings = {
  id: 1,
  inventory_method: null,
  costing_method: null,
  cost_per_warehouse: false,
  cost_per_cost_center: false,
  cost_per_expiry_date: false,
  cost_per_serial_number: false,
  manufacturing_produce_expiry_policy: "min_component",
  track_quantity_on_movement: true,
  foundation_locked: false,
  foundation_locked_at: null,
  first_posted_inventory_at: null,
};

function mapSettings(row: Record<string, unknown>): CompanyInventorySettings {
  return {
    id: Number(row.id ?? 1),
    inventory_method: (row.inventory_method as CompanyInventorySettings["inventory_method"]) ?? null,
    costing_method: (row.costing_method as CompanyInventorySettings["costing_method"]) ?? null,
    cost_per_warehouse: Boolean(row.cost_per_warehouse),
    cost_per_cost_center: Boolean(row.cost_per_cost_center),
    cost_per_expiry_date: Boolean(row.cost_per_expiry_date),
    cost_per_serial_number: Boolean(row.cost_per_serial_number),
    manufacturing_produce_expiry_policy: parseExpiryPolicy(
      row.manufacturing_produce_expiry_policy,
    ),
    track_quantity_on_movement: row.track_quantity_on_movement !== false,
    foundation_locked: Boolean(row.foundation_locked),
    foundation_locked_at: (row.foundation_locked_at as string | null) ?? null,
    first_posted_inventory_at:
      (row.first_posted_inventory_at as string | null) ?? null,
  };
}

export const inventorySettingsApi = {
  async getSettings(): Promise<CompanyInventorySettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("company_inventory_settings")
      .select(SETTINGS_SELECT)
      .eq("id", 1)
      .maybeSingle();

    if (isMissingTable(error)) {
      // عمود السياسة قد يكون غائباً على قواعد قديمة
      const fallback = await supabase
        .from("company_inventory_settings")
        .select(
          `
          id,
          inventory_method,
          costing_method,
          cost_per_warehouse,
          cost_per_cost_center,
          cost_per_expiry_date,
          cost_per_serial_number,
          track_quantity_on_movement,
          foundation_locked,
          foundation_locked_at,
          first_posted_inventory_at
        `,
        )
        .eq("id", 1)
        .maybeSingle();
      if (isMissingTable(fallback.error)) return DEFAULT_SETTINGS;
      throwIfSupabaseError(fallback.error);
      return mapSettings((fallback.data as Record<string, unknown>) ?? {});
    }
    throwIfSupabaseError(error);
    return mapSettings((data as Record<string, unknown>) ?? {});
  },

  async updateSettings(
    payload: InventorySettingsFormValues,
  ): Promise<CompanyInventorySettings> {
    const supabase = getSupabaseClient();
    const baseUpdate = {
      inventory_method: payload.inventory_method || null,
      costing_method: payload.costing_method || null,
      cost_per_warehouse: payload.cost_per_warehouse,
      cost_per_cost_center: payload.cost_per_cost_center,
      cost_per_expiry_date: payload.cost_per_expiry_date,
      cost_per_serial_number: payload.cost_per_serial_number,
      manufacturing_produce_expiry_policy:
        payload.manufacturing_produce_expiry_policy,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("company_inventory_settings")
      .update(baseUpdate)
      .eq("id", 1)
      .select(SETTINGS_SELECT)
      .single();

    if (isMissingTable(error)) {
      const { manufacturing_produce_expiry_policy: _drop, ...withoutPolicy } =
        baseUpdate;
      const retry = await supabase
        .from("company_inventory_settings")
        .update(withoutPolicy)
        .eq("id", 1)
        .select(
          `
          id,
          inventory_method,
          costing_method,
          cost_per_warehouse,
          cost_per_cost_center,
          cost_per_expiry_date,
          cost_per_serial_number,
          track_quantity_on_movement,
          foundation_locked,
          foundation_locked_at,
          first_posted_inventory_at
        `,
        )
        .single();
      throwIfSupabaseError(retry.error);
      return mapSettings(retry.data as Record<string, unknown>);
    }

    throwIfSupabaseError(error);
    return mapSettings(data as Record<string, unknown>);
  },
};
