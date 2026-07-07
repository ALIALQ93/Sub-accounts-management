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

export interface PurchaseLineReportRow {
  invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  commercial_kind: string;
  vendor_name_ar: string;
  material_id: string;
  material_code: string;
  material_name_ar: string;
  warehouse_code: string;
  branch_code: string;
  quantity_base: number;
  unit_price: number;
  discount_amount: number;
  line_amount: number;
}

export interface PurchaseLinesReportParams {
  fromDate?: string;
  toDate?: string;
  vendorId?: string;
  materialId?: string;
  warehouseId?: string;
  branchId?: string;
  includeReturns?: boolean;
}

export const COMMERCIAL_KIND_LABELS: Record<string, string> = {
  purchase: "مشتريات",
  return_purchase: "مرتجع مشتريات",
  opening_stock: "بضاعة أول المدة",
};

function mapRow(row: Record<string, unknown>): PurchaseLineReportRow {
  return {
    invoice_id: String(row.invoice_id),
    invoice_no: String(row.invoice_no),
    invoice_date: String(row.invoice_date),
    commercial_kind: String(row.commercial_kind),
    vendor_name_ar: String(row.vendor_name_ar),
    material_id: String(row.material_id),
    material_code: String(row.material_code),
    material_name_ar: String(row.material_name_ar),
    warehouse_code: String(row.warehouse_code),
    branch_code: String(row.branch_code),
    quantity_base: Number(row.quantity_base),
    unit_price: Number(row.unit_price),
    discount_amount: Number(row.discount_amount),
    line_amount: Number(row.line_amount),
  };
}

export const purchaseLinesReportApi = {
  async listRows(
    params: PurchaseLinesReportParams = {},
  ): Promise<PurchaseLineReportRow[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_purchase_lines_report", {
      p_from_date: params.fromDate || null,
      p_to_date: params.toDate || null,
      p_vendor_id: params.vendorId || null,
      p_material_id: params.materialId || null,
      p_warehouse_id: params.warehouseId || null,
      p_branch_id: params.branchId || null,
      p_include_returns: params.includeReturns !== false,
    });

    if (isMissingRpc(error)) {
      throw new Error(
        "دالة get_purchase_lines_report غير متوفرة — شغّل patch_inventory_phase6.sql.",
      );
    }
    throwIfSupabaseError(error);
    return (data ?? []).map((row: Record<string, unknown>) => mapRow(row));
  },

  summarize(rows: PurchaseLineReportRow[]) {
    return rows.reduce(
      (acc, row) => ({
        line_count: acc.line_count + 1,
        quantity_base: acc.quantity_base + row.quantity_base,
        line_amount: acc.line_amount + row.line_amount,
        discount_amount: acc.discount_amount + row.discount_amount,
      }),
      {
        line_count: 0,
        quantity_base: 0,
        line_amount: 0,
        discount_amount: 0,
      },
    );
  },
};
