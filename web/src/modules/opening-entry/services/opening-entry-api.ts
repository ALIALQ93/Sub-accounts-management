"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import type { VoucherStatus } from "@/modules/vouchers/types";

function isMissingColumn(error: PostgrestError | null): boolean {
  return error?.code === "42703";
}

function isMissingTable(error: PostgrestError | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface OpeningEntryListItem {
  id: string;
  voucher_no: string;
  voucher_date: string;
  status: VoucherStatus;
  branch_id: string | null;
  branch_name_ar: string | null;
  total_debit: number;
  description: string | null;
}

export const openingEntryApi = {
  async listOpeningEntries(): Promise<OpeningEntryListItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vouchers")
      .select(
        `
        id,
        voucher_no,
        voucher_date,
        status,
        branch_id,
        description,
        branches ( name_ar ),
        voucher_lines ( side, amount )
      `,
      )
      .eq("is_opening_entry", true)
      .order("voucher_date", { ascending: false });

    if (isMissingColumn(error) || isMissingTable(error)) {
      return [];
    }
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      voucher_no: string;
      voucher_date: string;
      status: string;
      branch_id: string | null;
      description: string | null;
      branches: { name_ar: string } | { name_ar: string }[] | null;
      voucher_lines: Array<{ side: string; amount: number }> | null;
    };

    return ((data ?? []) as unknown as Row[]).map((row) => {
      const branch = firstRelation(row.branches);
      const lines = row.voucher_lines ?? [];
      const totalDebit = lines
        .filter((line) => line.side === "debit")
        .reduce((sum, line) => sum + Number(line.amount || 0), 0);

      return {
        id: row.id,
        voucher_no: row.voucher_no,
        voucher_date: row.voucher_date,
        status: row.status as VoucherStatus,
        branch_id: row.branch_id,
        branch_name_ar: branch?.name_ar ?? null,
        total_debit: totalDebit,
        description: row.description,
      };
    });
  },

  async hasPostedOpeningForBranchYear(
    branchId: string,
    voucherDate: string,
    excludeVoucherId?: string,
  ): Promise<boolean> {
    if (!branchId || !voucherDate) return false;

    const year = voucherDate.slice(0, 4);
    const supabase = getSupabaseClient();
    let query = supabase
      .from("vouchers")
      .select("id")
      .eq("is_opening_entry", true)
      .eq("branch_id", branchId)
      .eq("status", "posted")
      .gte("voucher_date", `${year}-01-01`)
      .lte("voucher_date", `${year}-12-31`)
      .limit(1);

    if (excludeVoucherId) {
      query = query.neq("id", excludeVoucherId);
    }

    const { data, error } = await query;
    if (isMissingColumn(error) || isMissingTable(error)) return false;
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  },

  async assertCanPostOpeningEntry(params: {
    branchId: string;
    voucherDate: string;
    excludeVoucherId?: string;
  }): Promise<void> {
    const duplicate = await this.hasPostedOpeningForBranchYear(
      params.branchId,
      params.voucherDate,
      params.excludeVoucherId,
    );
    if (duplicate) {
      throw new Error("يوجد قيد افتتاحي مرحّل لهذا الفرع في نفس السنة.");
    }
  },
};
