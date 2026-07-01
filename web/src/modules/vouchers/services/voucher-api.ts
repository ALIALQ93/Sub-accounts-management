"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ApiErrorPayload,
  PostVoucherResponse,
  VoucherAllocation,
  VoucherDetails,
  VoucherHeader,
  VoucherLine,
} from "@/modules/vouchers/types";
import type { PostgrestError } from "@supabase/supabase-js";

class ApiError extends Error {
  code: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.code = payload.code;
    this.name = "ApiError";
  }
}

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new ApiError({
      code: error.code || "SUPABASE_ERROR",
      message: error.message || "حدث خطأ غير متوقع من قاعدة البيانات.",
    });
  }
}

export const voucherApi = {
  async getVoucherById(id: string): Promise<VoucherDetails> {
    const supabase = getSupabaseClient();

    const { data: header, error: headerError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("id", id)
      .single();
    throwIfSupabaseError(headerError);

    const { data: lines, error: linesError } = await supabase
      .from("voucher_lines")
      .select("*")
      .eq("voucher_id", id)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(linesError);

    const { data: allocations, error: allocationsError } = await supabase
      .from("voucher_allocations")
      .select("*")
      .eq("voucher_id", id)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(allocationsError);

    return {
      header: header as VoucherHeader,
      lines: (lines ?? []) as VoucherLine[],
      allocations: (allocations ?? []) as VoucherAllocation[],
    };
  },

  async createVoucher(payload: Partial<VoucherHeader>): Promise<VoucherHeader> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vouchers")
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherHeader;
  },

  async updateVoucher(
    id: string,
    payload: Partial<VoucherHeader>,
  ): Promise<VoucherHeader> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vouchers")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherHeader;
  },

  async addVoucherLine(
    id: string,
    payload: Partial<VoucherLine>,
  ): Promise<VoucherLine> {
    const supabase = getSupabaseClient();
    const insertPayload = { ...payload, voucher_id: id };
    const { data, error } = await supabase
      .from("voucher_lines")
      .insert(insertPayload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherLine;
  },

  async updateVoucherLine(
    id: string,
    lineId: string,
    payload: Partial<VoucherLine>,
  ): Promise<VoucherLine> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_lines")
      .update(payload)
      .eq("id", lineId)
      .eq("voucher_id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherLine;
  },

  async deleteVoucherLine(id: string, lineId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("voucher_lines")
      .delete()
      .eq("id", lineId)
      .eq("voucher_id", id);
    throwIfSupabaseError(error);
  },

  async addAllocation(
    id: string,
    payload: Partial<VoucherAllocation>,
  ): Promise<VoucherAllocation> {
    const supabase = getSupabaseClient();
    const insertPayload = { ...payload, voucher_id: id };
    const { data, error } = await supabase
      .from("voucher_allocations")
      .insert(insertPayload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherAllocation;
  },

  async updateAllocation(
    id: string,
    allocationId: string,
    payload: Partial<VoucherAllocation>,
  ): Promise<VoucherAllocation> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_allocations")
      .update(payload)
      .eq("id", allocationId)
      .eq("voucher_id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherAllocation;
  },

  async deleteAllocation(id: string, allocationId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("voucher_allocations")
      .delete()
      .eq("id", allocationId)
      .eq("voucher_id", id);
    throwIfSupabaseError(error);
  },

  async postVoucher(id: string): Promise<PostVoucherResponse> {
    const supabase = getSupabaseClient();

    const { data: voucher, error } = await supabase
      .from("vouchers")
      .update({ status: "posted" })
      .eq("id", id)
      .select("id, status, journal_entry_id, voucher_no")
      .single();
    throwIfSupabaseError(error);

    if (!voucher?.journal_entry_id) {
      throw new ApiError({
        code: "POSTING_FAILED",
        message: "تم تحديث الحالة لكن لم يتم ربط قيد اليومية.",
      });
    }

    const { data: journal, error: journalError } = await supabase
      .from("journal_entries")
      .select("entry_no")
      .eq("id", voucher.journal_entry_id)
      .single();
    throwIfSupabaseError(journalError);

    return {
      voucher_id: voucher.id,
      status: "posted",
      journal_entry_id: voucher.journal_entry_id,
      journal_entry_no: journal.entry_no as string,
    };
  },

  async reverseVoucher(id: string): Promise<{ reversed_voucher_id: string }> {
    throw new ApiError({
      code: "NOT_IMPLEMENTED",
      message: `عكس السند ${id} لم يُنفذ بعد في طبقة الواجهة.`,
    });
  },
};

export { ApiError };
