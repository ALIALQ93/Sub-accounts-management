"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  Account,
  ApiErrorPayload,
  Customer,
  JournalEntryListItem,
  OpenMovement,
  PostVoucherResponse,
  TrialBalanceRow,
  Vendor,
  VoucherAllocation,
  VoucherDetails,
  VoucherHeader,
  VoucherListItem,
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
  async listVouchers(): Promise<VoucherListItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .order("voucher_date", { ascending: false });
    throwIfSupabaseError(error);
    return (data ?? []) as VoucherListItem[];
  },

  async listAccounts(): Promise<Account[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("id, code, name_ar, is_postable, is_active, parent_id")
      .eq("is_active", true)
      .eq("is_postable", true)
      .order("code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Account[];
  },

  async listOpenMovements(): Promise<OpenMovement[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("journal_entry_lines")
      .select(
        "id, account_id, debit, credit, line_description, journal_entries(entry_no), accounts(code, name_ar)",
      )
      .order("created_at", { ascending: false })
      .limit(150);
    throwIfSupabaseError(error);

    return (data ?? []).map((row) => {
      const debit = Number((row as { debit?: number }).debit ?? 0);
      const credit = Number((row as { credit?: number }).credit ?? 0);
      const journalEntry = (row as { journal_entries?: { entry_no?: string } })
        .journal_entries;
      const account = (row as { accounts?: { code?: string; name_ar?: string } })
        .accounts;

      return {
        target_journal_line_id: (row as { id: string }).id,
        entry_no: journalEntry?.entry_no ?? "N/A",
        account_id: (row as { account_id: string }).account_id,
        account_code: account?.code,
        account_name: account?.name_ar,
        open_amount: Math.abs(debit - credit),
        line_description: (row as { line_description: string | null })
          .line_description,
      } as OpenMovement;
    });
  },

  async listCustomers(): Promise<Customer[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("customer_code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Customer[];
  },

  async createCustomer(payload: Partial<Customer>): Promise<Customer> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Customer;
  },

  async listVendors(): Promise<Vendor[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("vendor_code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Vendor[];
  },

  async createVendor(payload: Partial<Vendor>): Promise<Vendor> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vendors")
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Vendor;
  },

  async listJournalEntries(): Promise<JournalEntryListItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(200);
    throwIfSupabaseError(error);
    return (data ?? []) as JournalEntryListItem[];
  },

  async listTrialBalanceRows(): Promise<TrialBalanceRow[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("journal_entry_lines")
      .select("debit, credit, journal_entries(status), accounts(id, code, name_ar)")
      .limit(5000);
    throwIfSupabaseError(error);

    const grouped = new Map<string, TrialBalanceRow>();

    for (const row of data ?? []) {
      const journalEntry = (row as { journal_entries?: { status?: string } })
        .journal_entries;
      if (journalEntry?.status !== "posted") continue;

      const account = (row as {
        accounts?: { id?: string; code?: string; name_ar?: string };
      }).accounts;

      if (!account?.id) continue;

      const debit = Number((row as { debit?: number }).debit ?? 0);
      const credit = Number((row as { credit?: number }).credit ?? 0);

      if (!grouped.has(account.id)) {
        grouped.set(account.id, {
          account_id: account.id,
          account_code: account.code ?? "",
          account_name: account.name_ar ?? "",
          debit: 0,
          credit: 0,
          balance: 0,
        });
      }

      const entry = grouped.get(account.id)!;
      entry.debit += debit;
      entry.credit += credit;
      entry.balance = entry.debit - entry.credit;
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.account_code.localeCompare(b.account_code),
    );
  },

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
    if (!journal?.entry_no) {
      throw new ApiError({
        code: "POSTING_FAILED",
        message: "تم الترحيل لكن لم يتم العثور على رقم قيد اليومية.",
      });
    }

    return {
      voucher_id: voucher.id,
      status: "posted",
      journal_entry_id: voucher.journal_entry_id,
      journal_entry_no: journal.entry_no,
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
