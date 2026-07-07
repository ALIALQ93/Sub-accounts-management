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

export type CogsGroupBy = "material" | "invoice";

export interface CogsReportRow {
  group_key: string;
  invoice_id: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  material_id: string | null;
  material_code: string | null;
  material_name_ar: string | null;
  warehouse_code: string | null;
  branch_code: string | null;
  sale_quantity_base: number;
  return_quantity_base: number;
  sales_amount: number;
  cogs_amount: number;
  return_cogs_amount: number;
  net_cogs: number;
}

export interface CogsReportParams {
  fromDate?: string;
  toDate?: string;
  materialId?: string;
  warehouseId?: string;
  branchId?: string;
  groupBy?: CogsGroupBy;
}

function mapRow(row: Record<string, unknown>): CogsReportRow {
  return {
    group_key: String(row.group_key),
    invoice_id: row.invoice_id ? String(row.invoice_id) : null,
    invoice_no: row.invoice_no ? String(row.invoice_no) : null,
    invoice_date: row.invoice_date ? String(row.invoice_date) : null,
    material_id: row.material_id ? String(row.material_id) : null,
    material_code: row.material_code ? String(row.material_code) : null,
    material_name_ar: row.material_name_ar ? String(row.material_name_ar) : null,
    warehouse_code: row.warehouse_code ? String(row.warehouse_code) : null,
    branch_code: row.branch_code ? String(row.branch_code) : null,
    sale_quantity_base: Number(row.sale_quantity_base),
    return_quantity_base: Number(row.return_quantity_base),
    sales_amount: Number(row.sales_amount),
    cogs_amount: Number(row.cogs_amount),
    return_cogs_amount: Number(row.return_cogs_amount),
    net_cogs: Number(row.net_cogs),
  };
}

export const cogsReportApi = {
  async listRows(params: CogsReportParams = {}): Promise<CogsReportRow[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_cogs_report", {
      p_from_date: params.fromDate || null,
      p_to_date: params.toDate || null,
      p_material_id: params.materialId || null,
      p_warehouse_id: params.warehouseId || null,
      p_branch_id: params.branchId || null,
      p_group_by: params.groupBy ?? "material",
    });

    if (isMissingRpc(error)) {
      throw new Error(
        "دالة get_cogs_report غير متوفرة — شغّل patch_inventory_phase4.sql.",
      );
    }
    throwIfSupabaseError(error);
    return (data ?? []).map((row: Record<string, unknown>) => mapRow(row));
  },

  summarize(rows: CogsReportRow[]) {
    return rows.reduce(
      (acc, row) => ({
        sales_amount: acc.sales_amount + row.sales_amount,
        cogs_amount: acc.cogs_amount + row.cogs_amount,
        return_cogs_amount: acc.return_cogs_amount + row.return_cogs_amount,
        net_cogs: acc.net_cogs + row.net_cogs,
        line_count: acc.line_count + 1,
      }),
      {
        sales_amount: 0,
        cogs_amount: 0,
        return_cogs_amount: 0,
        net_cogs: 0,
        line_count: 0,
      },
    );
  },
};
