"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  Account,
  ApiErrorPayload,
  Customer,
  DashboardLastMovement,
  DashboardStats,
  JournalEntryDetails,
  JournalEntryLineDetail,
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

export interface SupabaseConnectionStatus {
  configured: boolean;
  supabaseHost: string;
  accountCount: number | null;
  errorMessage: string | null;
}

export const voucherApi = {
  async checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const keyConfigured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    const configured = Boolean(url && keyConfigured);

    let supabaseHost = "غير مضبوط";
    try {
      if (url) supabaseHost = new URL(url).hostname;
    } catch {
      supabaseHost = "رابط غير صالح";
    }

    if (!configured) {
      return {
        configured: false,
        supabaseHost,
        accountCount: null,
        errorMessage:
          "متغيرات Supabase غير موجودة في build الاستضافة. أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY في Vercel ثم أعد النشر.",
      };
    }

    try {
      const supabase = getSupabaseClient();
      const { count, error } = await supabase
        .from("accounts")
        .select("id", { count: "exact", head: true });

      if (error) {
        return {
          configured: true,
          supabaseHost,
          accountCount: null,
          errorMessage: error.message,
        };
      }

      return {
        configured: true,
        supabaseHost,
        accountCount: count ?? 0,
        errorMessage: null,
      };
    } catch (err) {
      return {
        configured: true,
        supabaseHost,
        accountCount: null,
        errorMessage:
          err instanceof Error ? err.message : "فشل الاتصال بقاعدة البيانات.",
      };
    }
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().slice(0, 10);

    const [
      vouchersCountRes,
      todayJournalsRes,
      linesRes,
      lastVoucherRes,
      lastJournalRes,
    ] = await Promise.all([
      supabase.from("vouchers").select("id", { count: "exact", head: true }),
      supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("entry_date", today),
      supabase
        .from("journal_entry_lines")
        .select("debit, credit, journal_entries!inner(status)")
        .eq("journal_entries.status", "posted")
        .limit(10000),
      supabase
        .from("vouchers")
        .select("id, voucher_no, voucher_date, status, description, created_at")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("journal_entries")
        .select("id, entry_no, entry_date, status, description, created_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    throwIfSupabaseError(vouchersCountRes.error);
    throwIfSupabaseError(todayJournalsRes.error);
    throwIfSupabaseError(linesRes.error);
    throwIfSupabaseError(lastVoucherRes.error);
    throwIfSupabaseError(lastJournalRes.error);

    let totalDebit = 0;
    let totalCredit = 0;
    for (const row of linesRes.data ?? []) {
      totalDebit += Number((row as { debit?: number }).debit ?? 0);
      totalCredit += Number((row as { credit?: number }).credit ?? 0);
    }

    const lastVoucher = lastVoucherRes.data?.[0] as
      | {
          id: string;
          voucher_no: string;
          voucher_date: string;
          status: string;
          description: string | null;
          created_at: string;
        }
      | undefined;
    const lastJournal = lastJournalRes.data?.[0] as
      | {
          id: string;
          entry_no: string;
          entry_date: string;
          status: string;
          description: string | null;
          created_at: string;
        }
      | undefined;

    let lastMovement: DashboardLastMovement | null = null;

    if (lastVoucher && lastJournal) {
      const voucherIsNewer =
        new Date(lastVoucher.created_at).getTime() >=
        new Date(lastJournal.created_at).getTime();
      if (voucherIsNewer) {
        lastMovement = {
          type: "voucher",
          id: lastVoucher.id,
          reference: lastVoucher.voucher_no,
          date: lastVoucher.voucher_date,
          description: lastVoucher.description,
          status: lastVoucher.status,
        };
      } else {
        lastMovement = {
          type: "journal",
          id: lastJournal.id,
          reference: lastJournal.entry_no,
          date: lastJournal.entry_date,
          description: lastJournal.description,
          status: lastJournal.status,
        };
      }
    } else if (lastVoucher) {
      lastMovement = {
        type: "voucher",
        id: lastVoucher.id,
        reference: lastVoucher.voucher_no,
        date: lastVoucher.voucher_date,
        description: lastVoucher.description,
        status: lastVoucher.status,
      };
    } else if (lastJournal) {
      lastMovement = {
        type: "journal",
        id: lastJournal.id,
        reference: lastJournal.entry_no,
        date: lastJournal.entry_date,
        description: lastJournal.description,
        status: lastJournal.status,
      };
    }

    return {
      voucher_count: vouchersCountRes.count ?? 0,
      today_journal_count: todayJournalsRes.count ?? 0,
      total_debit: totalDebit,
      total_credit: totalCredit,
      last_movement: lastMovement,
    };
  },

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
      .select("id, code, name_ar, name_en, is_postable, is_active, parent_id, level")
      .eq("is_active", true)
      .eq("is_postable", true)
      .order("code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Account[];
  },

  async listAllAccounts(): Promise<Account[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("id, code, name_ar, name_en, is_postable, is_active, parent_id, level")
      .order("code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Account[];
  },

  async createAccount(payload: Partial<Account>): Promise<Account> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Account;
  },

  async updateAccount(id: string, payload: Partial<Account>): Promise<Account> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Account;
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

  async updateCustomer(
    id: string,
    payload: Partial<Customer>,
  ): Promise<Customer> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", id)
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

  async updateVendor(id: string, payload: Partial<Vendor>): Promise<Vendor> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vendors")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Vendor;
  },

  async listJournalEntries(
    fromDate?: string,
    toDate?: string,
  ): Promise<JournalEntryListItem[]> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(200);

    if (fromDate) {
      query = query.gte("entry_date", fromDate);
    }
    if (toDate) {
      query = query.lte("entry_date", toDate);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return (data ?? []) as JournalEntryListItem[];
  },

  async getJournalEntryById(id: string): Promise<JournalEntryDetails> {
    const supabase = getSupabaseClient();

    const { data: header, error: headerError } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("id", id)
      .single();
    throwIfSupabaseError(headerError);

    const { data: lines, error: linesError } = await supabase
      .from("journal_entry_lines")
      .select("id, account_id, debit, credit, line_description, accounts(code, name_ar)")
      .eq("journal_entry_id", id)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(linesError);

    const mappedLines: JournalEntryLineDetail[] = (lines ?? []).map((line) => {
      const account = (line as { accounts?: { code?: string; name_ar?: string } })
        .accounts;

      return {
        id: (line as { id: string }).id,
        account_id: (line as { account_id: string }).account_id,
        account_code: account?.code ?? "",
        account_name: account?.name_ar ?? "",
        debit: Number((line as { debit?: number }).debit ?? 0),
        credit: Number((line as { credit?: number }).credit ?? 0),
        line_description: (line as { line_description: string | null })
          .line_description,
      };
    });

    return {
      header: header as JournalEntryListItem,
      lines: mappedLines,
    };
  },

  async listTrialBalanceRows(fromDate?: string, toDate?: string): Promise<TrialBalanceRow[]> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("journal_entry_lines")
      .select(
        "debit, credit, journal_entries!inner(status, entry_date), accounts(id, code, name_ar)",
      )
      .limit(5000);

    if (fromDate) {
      query = query.gte("journal_entries.entry_date", fromDate);
    }
    if (toDate) {
      query = query.lte("journal_entries.entry_date", toDate);
    }

    const { data, error } = await query;
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
    const original = await this.getVoucherById(id);

    if (original.header.status !== "posted") {
      throw new ApiError({
        code: "REVERSAL_NOT_ALLOWED",
        message: "يمكن عكس السندات المرحلة فقط.",
      });
    }

    const suffix = Date.now().toString().slice(-6);
    const rawNo = `RV-${original.header.voucher_no}-${suffix}`;
    const voucherNo = rawNo.length > 40 ? rawNo.slice(0, 40) : rawNo;

    const reversalHeader = await this.createVoucher({
      voucher_no: voucherNo,
      voucher_type: original.header.voucher_type,
      settlement_mode: "account",
      voucher_date: new Date().toISOString().slice(0, 10),
      description: `عكس السند ${original.header.voucher_no}`,
      status: "approved",
      customer_id: original.header.customer_id,
      vendor_id: original.header.vendor_id,
    });

    for (const line of original.lines) {
      await this.addVoucherLine(reversalHeader.id, {
        account_id: line.account_id,
        side: line.side === "debit" ? "credit" : "debit",
        amount: line.amount,
        line_description: line.line_description
          ? `عكس: ${line.line_description}`
          : "عكس سطر",
      });
    }

    await this.postVoucher(reversalHeader.id);
    return { reversed_voucher_id: reversalHeader.id };
  },
};

export { ApiError };
