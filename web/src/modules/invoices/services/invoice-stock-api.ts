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

export interface InventoryLotBalance {
  expiry_date: string | null;
  serial_number: string | null;
  quantity_base: number;
}

function mapLotRow(row: Record<string, unknown>): InventoryLotBalance {
  return {
    expiry_date: row.expiry_date ? String(row.expiry_date) : null,
    serial_number: row.serial_number ? String(row.serial_number) : null,
    quantity_base: Number(row.quantity_base),
  };
}

export const invoiceStockApi = {
  async listLotBalances(params: {
    materialId: string;
    warehouseId: string;
    asOfDate?: string;
  }): Promise<InventoryLotBalance[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("list_inventory_lot_balances", {
      p_material_id: params.materialId,
      p_warehouse_id: params.warehouseId,
      p_as_of_date: params.asOfDate || null,
    });

    if (isMissingRpc(error)) {
      return [];
    }
    throwIfSupabaseError(error);
    return (data ?? []).map((row: Record<string, unknown>) => mapLotRow(row));
  },
};

export function lotBalancesKey(materialId: string, warehouseId: string): string {
  return `${materialId}|${warehouseId}`;
}

/** تجميع المتاح per تاريخ صلاحية (بدون تفصيل تسلسلي) */
export function expiryOptionsFromLots(
  lots: InventoryLotBalance[],
): Array<{ expiry_date: string; quantity_base: number }> {
  const map = new Map<string, number>();
  for (const lot of lots) {
    if (!lot.expiry_date) continue;
    map.set(
      lot.expiry_date,
      (map.get(lot.expiry_date) ?? 0) + lot.quantity_base,
    );
  }
  return [...map.entries()]
    .map(([expiry_date, quantity_base]) => ({ expiry_date, quantity_base }))
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
}

/** دفعات بها رقم تسلسلي متاح */
export function serialOptionsFromLots(
  lots: InventoryLotBalance[],
): InventoryLotBalance[] {
  return lots
    .filter((lot) => lot.serial_number && lot.quantity_base > 0)
    .sort((a, b) => (a.serial_number ?? "").localeCompare(b.serial_number ?? ""));
}
