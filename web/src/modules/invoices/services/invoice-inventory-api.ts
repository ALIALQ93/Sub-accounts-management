"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
import { MOVEMENT_KIND_LABELS } from "@/modules/reports/services/inventory-report-api";
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

export interface InvoiceInventoryMovement {
  id: string;
  movement_date: string;
  movement_kind: string;
  movement_kind_label: string;
  material_code: string;
  material_name_ar: string;
  warehouse_code: string;
  branch_code: string;
  quantity_base_delta: number;
  unit_cost: number | null;
  total_cost: number;
}

export const invoiceInventoryApi = {
  async listByInvoiceId(invoiceId: string): Promise<InvoiceInventoryMovement[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("inventory_movements")
      .select(
        `
        id,
        movement_date,
        movement_kind,
        quantity_base_delta,
        unit_cost,
        total_cost,
        materials ( material_code, name_ar ),
        warehouses ( warehouse_code, branches!branch_id ( branch_code ) )
      `,
      )
      .eq("source_type", "invoice")
      .eq("source_id", invoiceId)
      .order("movement_date", { ascending: true });

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);

    return (data ?? []).map((row) => {
      const material = row.materials as
        | { material_code: string; name_ar: string }
        | { material_code: string; name_ar: string }[]
        | null;
      const materialRow = Array.isArray(material) ? material[0] : material;

      const warehouse = row.warehouses as
        | {
            warehouse_code: string;
            branches: { branch_code: string } | { branch_code: string }[] | null;
          }
        | {
            warehouse_code: string;
            branches: { branch_code: string } | { branch_code: string }[] | null;
          }[]
        | null;
      const warehouseRow = Array.isArray(warehouse) ? warehouse[0] : warehouse;
      const branch = warehouseRow?.branches;
      const branchRow = Array.isArray(branch) ? branch[0] : branch;

      const kind = String(row.movement_kind);
      return {
        id: String(row.id),
        movement_date: String(row.movement_date),
        movement_kind: kind,
        movement_kind_label: MOVEMENT_KIND_LABELS[kind] ?? kind,
        material_code: materialRow?.material_code ?? "—",
        material_name_ar: materialRow?.name_ar ?? "—",
        warehouse_code: warehouseRow?.warehouse_code ?? "—",
        branch_code: branchRow?.branch_code ?? "—",
        quantity_base_delta: Number(row.quantity_base_delta),
        unit_cost: row.unit_cost == null ? null : Number(row.unit_cost),
        total_cost: Number(row.total_cost),
      };
    });
  },
};
