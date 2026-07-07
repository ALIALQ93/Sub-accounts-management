"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) throw errorFromSupabase(error);
}

export interface StockAdjustmentResult {
  journal_entry_id: string;
  entry_no: string;
  system_quantity_base: number;
  counted_quantity_base: number;
  delta_quantity_base: number;
  adjustment_amount: number;
  unit_cost: number;
}

export interface PostStockAdjustmentPayload {
  materialId: string;
  warehouseId: string;
  countedQuantityBase: number;
  inventoryAccountId: string;
  adjustmentAccountId: string;
  adjustmentDate?: string;
  description?: string;
  costCenterId?: string;
}

export const stockAdjustmentApi = {
  async getSystemBalance(
    materialId: string,
    warehouseId: string,
    asOfDate?: string,
  ): Promise<number> {
    const { inventoryReportApi } = await import(
      "@/modules/reports/services/inventory-report-api"
    );
    const rows = await inventoryReportApi.listBalanceRows({
      materialId,
      warehouseId,
      asOfDate,
      hideZero: false,
    });
    const row = rows.find(
      (item) =>
        item.material_id === materialId && item.warehouse_id === warehouseId,
    );
    return row?.quantity_base ?? 0;
  },

  async postAdjustment(
    payload: PostStockAdjustmentPayload,
  ): Promise<StockAdjustmentResult> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("post_stock_adjustment", {
      p_material_id: payload.materialId,
      p_warehouse_id: payload.warehouseId,
      p_counted_quantity_base: payload.countedQuantityBase,
      p_inventory_account_id: payload.inventoryAccountId,
      p_adjustment_account_id: payload.adjustmentAccountId,
      p_adjustment_date: payload.adjustmentDate || null,
      p_description: payload.description?.trim() || null,
      p_cost_center_id: payload.costCenterId || null,
    });

    if (
      error?.code === "42883" ||
      error?.code === "PGRST202" ||
      error?.code === "42P01"
    ) {
      throw new Error(
        "دالة post_stock_adjustment غير متوفرة — شغّل patch_inventory_reports.sql.",
      );
    }
    throwIfSupabaseError(error);

    const result = data as Record<string, unknown>;
    return {
      journal_entry_id: String(result.journal_entry_id),
      entry_no: String(result.entry_no),
      system_quantity_base: Number(result.system_quantity_base),
      counted_quantity_base: Number(result.counted_quantity_base),
      delta_quantity_base: Number(result.delta_quantity_base),
      adjustment_amount: Number(result.adjustment_amount),
      unit_cost: Number(result.unit_cost),
    };
  },

  async postBatchAdjustment(payload: {
    lines: Array<{
      materialId: string;
      warehouseId: string;
      countedQuantityBase: number;
    }>;
    inventoryAccountId: string;
    adjustmentAccountId: string;
    adjustmentDate?: string;
    description?: string;
    costCenterId?: string;
  }): Promise<{
    journal_entry_id: string;
    entry_no: string;
    applied_lines: number;
    branch_count: number;
    lines: Array<{
      material_id: string;
      material_code: string;
      warehouse_id: string;
      warehouse_code: string;
      system_quantity_base: number;
      counted_quantity_base: number;
      delta_quantity_base: number;
      adjustment_amount: number;
    }>;
  }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("post_stock_adjustment_batch", {
      p_lines: payload.lines.map((line) => ({
        material_id: line.materialId,
        warehouse_id: line.warehouseId,
        counted_quantity_base: line.countedQuantityBase,
      })),
      p_inventory_account_id: payload.inventoryAccountId,
      p_adjustment_account_id: payload.adjustmentAccountId,
      p_adjustment_date: payload.adjustmentDate || null,
      p_description: payload.description?.trim() || null,
      p_cost_center_id: payload.costCenterId || null,
    });

    if (
      error?.code === "42883" ||
      error?.code === "PGRST202" ||
      error?.code === "42P01"
    ) {
      throw new Error(
        "دالة post_stock_adjustment_batch غير متوفرة — شغّل patch_inventory_phase2.sql.",
      );
    }
    throwIfSupabaseError(error);

    const result = data as Record<string, unknown>;
    return {
      journal_entry_id: String(result.journal_entry_id),
      entry_no: String(result.entry_no),
      applied_lines: Number(result.applied_lines),
      branch_count: Number(result.branch_count ?? 1),
      lines: ((result.lines as unknown[]) ?? []).map((row) => {
        const item = row as Record<string, unknown>;
        return {
          material_id: String(item.material_id),
          material_code: String(item.material_code),
          warehouse_id: String(item.warehouse_id),
          warehouse_code: String(item.warehouse_code),
          system_quantity_base: Number(item.system_quantity_base),
          counted_quantity_base: Number(item.counted_quantity_base),
          delta_quantity_base: Number(item.delta_quantity_base),
          adjustment_amount: Number(item.adjustment_amount),
        };
      }),
    };
  },
};
