"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) throw errorFromSupabase(error);
}

function isMissingRpc(error: PostgrestError | null): boolean {
  return (
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    error?.code === "42P01"
  );
}

export interface InventoryBalanceRow {
  material_id: string;
  material_code: string;
  material_name_ar: string;
  category_id: string | null;
  category_name_ar: string | null;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name_ar: string;
  branch_id: string;
  branch_code: string;
  quantity_base: number;
  inventory_value: number;
  unit_cost_avg: number | null;
}

export interface InventoryMovementLedgerRow {
  movement_id: string;
  movement_date: string;
  movement_kind: string;
  material_id: string;
  material_code: string;
  material_name_ar: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name_ar: string;
  branch_code: string;
  quantity_base_delta: number;
  unit_cost: number | null;
  line_value: number;
  running_balance_base: number;
  source_type: string;
  source_id: string;
  created_at: string;
}

export interface InventoryBalanceParams {
  asOfDate?: string;
  materialId?: string;
  warehouseId?: string;
  branchId?: string;
  categoryId?: string;
  hideZero?: boolean;
}

export interface InventoryLedgerParams {
  fromDate?: string;
  toDate?: string;
  materialId?: string;
  warehouseId?: string;
  branchId?: string;
}

export const MOVEMENT_KIND_LABELS: Record<string, string> = {
  sale: "مبيعات",
  purchase: "مشتريات",
  transfer_out: "مناقلة — إخراج",
  transfer_in: "مناقلة — إدخال",
  return_sale: "مرتجع مبيعات",
  return_purchase: "مرتجع مشتريات",
  opening_stock: "بضاعة أول المدة",
  adjustment: "تسوية جرد",
};

function mapBalanceRow(row: Record<string, unknown>): InventoryBalanceRow {
  return {
    material_id: String(row.material_id),
    material_code: String(row.material_code),
    material_name_ar: String(row.material_name_ar),
    category_id: row.category_id ? String(row.category_id) : null,
    category_name_ar: row.category_name_ar ? String(row.category_name_ar) : null,
    warehouse_id: String(row.warehouse_id),
    warehouse_code: String(row.warehouse_code),
    warehouse_name_ar: String(row.warehouse_name_ar),
    branch_id: String(row.branch_id),
    branch_code: String(row.branch_code),
    quantity_base: Number(row.quantity_base),
    inventory_value: Number(row.inventory_value),
    unit_cost_avg:
      row.unit_cost_avg == null ? null : Number(row.unit_cost_avg),
  };
}

function mapLedgerRow(row: Record<string, unknown>): InventoryMovementLedgerRow {
  return {
    movement_id: String(row.movement_id),
    movement_date: String(row.movement_date),
    movement_kind: String(row.movement_kind),
    material_id: String(row.material_id),
    material_code: String(row.material_code),
    material_name_ar: String(row.material_name_ar),
    warehouse_id: String(row.warehouse_id),
    warehouse_code: String(row.warehouse_code),
    warehouse_name_ar: String(row.warehouse_name_ar),
    branch_code: String(row.branch_code),
    quantity_base_delta: Number(row.quantity_base_delta),
    unit_cost: row.unit_cost == null ? null : Number(row.unit_cost),
    line_value: Number(row.line_value),
    running_balance_base: Number(row.running_balance_base),
    source_type: String(row.source_type),
    source_id: String(row.source_id),
    created_at: String(row.created_at),
  };
}

export interface InventoryAnalysisRow {
  analysis_kind: "shortage" | "stagnant";
  material_id: string;
  material_code: string;
  material_name_ar: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name_ar: string;
  branch_code: string;
  quantity_base: number;
  min_stock: number | null;
  inventory_value: number;
  last_movement_date: string | null;
  days_idle: number | null;
}

export interface InventoryAnalysisParams {
  asOfDate?: string;
  shortageMaxQty?: number;
  stagnantDays?: number;
  warehouseId?: string;
  branchId?: string;
}

export const ANALYSIS_KIND_LABELS: Record<string, string> = {
  shortage: "نقص / نفاد",
  stagnant: "راكد",
};

export interface InventoryMovementSummaryRow {
  movement_kind: string;
  source_type: string;
  commercial_kind: string;
  movement_count: number;
  quantity_in_base: number;
  quantity_out_base: number;
  total_value: number;
}

export const COMMERCIAL_KIND_LABELS: Record<string, string> = {
  sale: "مبيعات",
  purchase: "مشتريات",
  transfer_out: "مناقلة — إخراج",
  transfer_in: "مناقلة — إدخال",
  return_sale: "مرتجع مبيعات",
  return_purchase: "مرتجع مشتريات",
  opening_stock: "بضاعة أول المدة",
  stock_adjustment: "تسوية جرد",
  invoice: "فاتورة",
};

function mapAnalysisRow(row: Record<string, unknown>): InventoryAnalysisRow {
  return {
    analysis_kind: row.analysis_kind as InventoryAnalysisRow["analysis_kind"],
    material_id: String(row.material_id),
    material_code: String(row.material_code),
    material_name_ar: String(row.material_name_ar),
    warehouse_id: String(row.warehouse_id),
    warehouse_code: String(row.warehouse_code),
    warehouse_name_ar: String(row.warehouse_name_ar),
    branch_code: String(row.branch_code),
    quantity_base: Number(row.quantity_base),
    min_stock: row.min_stock == null ? null : Number(row.min_stock),
    inventory_value: Number(row.inventory_value),
    last_movement_date: row.last_movement_date
      ? String(row.last_movement_date)
      : null,
    days_idle: row.days_idle == null ? null : Number(row.days_idle),
  };
}

export const inventoryReportApi = {
  async listBalanceRows(
    params: InventoryBalanceParams = {},
  ): Promise<InventoryBalanceRow[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_inventory_balance", {
      p_as_of_date: params.asOfDate || null,
      p_material_id: params.materialId || null,
      p_warehouse_id: params.warehouseId || null,
      p_branch_id: params.branchId || null,
      p_category_id: params.categoryId || null,
      p_hide_zero: params.hideZero !== false,
    });

    if (isMissingRpc(error)) {
      throw new Error(
        "دالة get_inventory_balance غير متوفرة — شغّل patch_inventory_reports.sql.",
      );
    }
    throwIfSupabaseError(error);
    return (data ?? []).map((row: Record<string, unknown>) =>
      mapBalanceRow(row),
    );
  },

  async listMovementLedger(
    params: InventoryLedgerParams = {},
  ): Promise<InventoryMovementLedgerRow[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_inventory_movement_ledger", {
      p_from_date: params.fromDate || null,
      p_to_date: params.toDate || null,
      p_material_id: params.materialId || null,
      p_warehouse_id: params.warehouseId || null,
      p_branch_id: params.branchId || null,
    });

    if (isMissingRpc(error)) {
      throw new Error(
        "دالة get_inventory_movement_ledger غير متوفرة — شغّل patch_inventory_reports.sql.",
      );
    }
    throwIfSupabaseError(error);
    return (data ?? []).map((row: Record<string, unknown>) =>
      mapLedgerRow(row),
    );
  },

  summarizeTotals(rows: InventoryBalanceRow[]) {
    return rows.reduce(
      (acc, row) => ({
        quantity_base: acc.quantity_base + row.quantity_base,
        inventory_value: acc.inventory_value + row.inventory_value,
        line_count: acc.line_count + 1,
      }),
      { quantity_base: 0, inventory_value: 0, line_count: 0 },
    );
  },

  async listAnalysisRows(
    params: InventoryAnalysisParams = {},
  ): Promise<InventoryAnalysisRow[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_inventory_analysis", {
      p_as_of_date: params.asOfDate || null,
      p_shortage_max_qty: params.shortageMaxQty ?? 0,
      p_stagnant_days: params.stagnantDays ?? 90,
      p_warehouse_id: params.warehouseId || null,
      p_branch_id: params.branchId || null,
    });

    if (isMissingRpc(error)) {
      throw new Error(
        "دالة get_inventory_analysis غير متوفرة — شغّل patch_inventory_phase2.sql.",
      );
    }
    throwIfSupabaseError(error);
    return (data ?? []).map((row: Record<string, unknown>) => mapAnalysisRow(row));
  },

  /** تحليل نقص محلي — أولوية حد المستودع ثم بطاقة المادة */
  listBelowMinStockRows(
    balanceRows: InventoryBalanceRow[],
    materials: Array<{ id: string; min_stock: number }>,
    warehouseLimits: Array<{
      material_id: string;
      warehouse_id: string;
      min_stock: number;
    }> = [],
  ): InventoryAnalysisRow[] {
    const minByMaterial = new Map(
      materials.map((material) => [material.id, material.min_stock]),
    );
    const minByWarehouse = new Map(
      warehouseLimits.map((row) => [
        `${row.material_id}:${row.warehouse_id}`,
        row.min_stock,
      ]),
    );

    const effectiveMin = (materialId: string, warehouseId: string): number => {
      const whMin = minByWarehouse.get(`${materialId}:${warehouseId}`) ?? 0;
      if (whMin > 0) return whMin;
      return minByMaterial.get(materialId) ?? 0;
    };

    return balanceRows
      .filter((row) => {
        const minStock = effectiveMin(row.material_id, row.warehouse_id);
        return minStock > 0 && row.quantity_base < minStock;
      })
      .map((row) => ({
        analysis_kind: "shortage" as const,
        material_id: row.material_id,
        material_code: row.material_code,
        material_name_ar: row.material_name_ar,
        warehouse_id: row.warehouse_id,
        warehouse_code: row.warehouse_code,
        warehouse_name_ar: row.warehouse_name_ar,
        branch_code: row.branch_code,
        quantity_base: row.quantity_base,
        min_stock: effectiveMin(row.material_id, row.warehouse_id),
        inventory_value: row.inventory_value,
        last_movement_date: null,
        days_idle: null,
      }));
  },

  async listMovementSummary(
    params: InventoryLedgerParams = {},
  ): Promise<InventoryMovementSummaryRow[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_inventory_movements_summary", {
      p_from_date: params.fromDate || null,
      p_to_date: params.toDate || null,
      p_material_id: params.materialId || null,
      p_warehouse_id: params.warehouseId || null,
      p_branch_id: params.branchId || null,
    });

    if (isMissingRpc(error)) {
      throw new Error(
        "دالة get_inventory_movements_summary غير متوفرة — شغّل patch_inventory_phase5.sql.",
      );
    }
    throwIfSupabaseError(error);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      movement_kind: String(row.movement_kind),
      source_type: String(row.source_type),
      commercial_kind: String(row.commercial_kind),
      movement_count: Number(row.movement_count),
      quantity_in_base: Number(row.quantity_in_base),
      quantity_out_base: Number(row.quantity_out_base),
      total_value: Number(row.total_value),
    }));
  },
};
