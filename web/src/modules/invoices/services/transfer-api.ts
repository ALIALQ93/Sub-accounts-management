"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  InventoryTransferDetail,
  InventoryTransferLine,
  InventoryTransferListItem,
  TransferStatus,
} from "@/modules/invoices/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

export interface TransferLineInput {
  line_no: number;
  material_id: string;
  material_unit_id: string;
  qty_ordered: number;
}

export interface TransferSavePayload {
  from_branch_id: string;
  to_branch_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  notes: string | null;
  lines: TransferLineInput[];
}

type TransferListRow = {
  id: string;
  transfer_no: string;
  status: TransferStatus;
  out_invoice_id: string | null;
  in_invoice_id: string | null;
  created_at: string;
  from_branch: { name_ar: string } | { name_ar: string }[] | null;
  to_branch: { name_ar: string } | { name_ar: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function nextTransferNo(): Promise<string> {
  const supabase = getSupabaseClient();
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from("inventory_transfers")
    .select("*", { count: "exact", head: true });
  throwIfSupabaseError(error);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `TR-${year}-${seq}`;
}

export const transferApi = {
  async listTransfers(): Promise<InventoryTransferListItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("inventory_transfers")
      .select(
        `
        id, transfer_no, status, out_invoice_id, in_invoice_id, created_at,
        from_branch:branches!inventory_transfers_from_branch_id_fkey ( name_ar ),
        to_branch:branches!inventory_transfers_to_branch_id_fkey ( name_ar )
      `,
      )
      .order("created_at", { ascending: false });
    throwIfSupabaseError(error);

    return ((data ?? []) as unknown as TransferListRow[]).map((row) => ({
      id: row.id,
      transfer_no: row.transfer_no,
      status: row.status,
      out_invoice_id: row.out_invoice_id,
      in_invoice_id: row.in_invoice_id,
      created_at: row.created_at,
      from_branch_name_ar: firstRelation(row.from_branch)?.name_ar,
      to_branch_name_ar: firstRelation(row.to_branch)?.name_ar,
    }));
  },

  async getTransfer(id: string): Promise<InventoryTransferDetail> {
    const supabase = getSupabaseClient();

    const { data: header, error: headerError } = await supabase
      .from("inventory_transfers")
      .select("*")
      .eq("id", id)
      .single();
    throwIfSupabaseError(headerError);

    const { data: lines, error: linesError } = await supabase
      .from("inventory_transfer_lines")
      .select(
        `
        *,
        materials ( material_code, name_ar ),
        material_units ( name_ar )
      `,
      )
      .eq("transfer_id", id)
      .order("line_no", { ascending: true });
    throwIfSupabaseError(linesError);

    type LineRow = InventoryTransferLine & {
      materials: { material_code: string; name_ar: string } | null;
      material_units: { name_ar: string } | null;
    };

    return {
      ...(header as Omit<InventoryTransferDetail, "lines">),
      lines: ((lines ?? []) as LineRow[]).map((line) => ({
        ...line,
        qty_ordered: Number(line.qty_ordered),
        qty_shipped: Number(line.qty_shipped),
        qty_received: Number(line.qty_received),
        material_code: line.materials?.material_code,
        material_name_ar: line.materials?.name_ar,
        unit_name_ar: line.material_units?.name_ar,
      })),
    };
  },

  async createTransfer(payload: TransferSavePayload): Promise<InventoryTransferDetail> {
    const supabase = getSupabaseClient();
    const transferNo = await nextTransferNo();

    const { data, error } = await supabase
      .from("inventory_transfers")
      .insert({
        transfer_no: transferNo,
        from_branch_id: payload.from_branch_id,
        to_branch_id: payload.to_branch_id,
        from_warehouse_id: payload.from_warehouse_id,
        to_warehouse_id: payload.to_warehouse_id,
        notes: payload.notes?.trim() || null,
        status: "draft",
      })
      .select("*")
      .single();
    throwIfSupabaseError(error);

    const created = data as InventoryTransferDetail;

    if (payload.lines.length > 0) {
      const { error: linesError } = await supabase
        .from("inventory_transfer_lines")
        .insert(
          payload.lines.map((line) => ({
            transfer_id: created.id,
            line_no: line.line_no,
            material_id: line.material_id,
            material_unit_id: line.material_unit_id,
            qty_ordered: line.qty_ordered,
          })),
        );
      throwIfSupabaseError(linesError);
    }

    return this.getTransfer(created.id);
  },
};
