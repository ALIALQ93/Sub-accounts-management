"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import type { VoucherStatus } from "@/modules/vouchers/types";
import {
  buildInvoiceCoverageSummary,
  type InvoiceCoverageSummary,
  type InvoiceSettlementVoucherRow,
} from "@/modules/invoices/utils/invoice-coverage-utils";

function isMissingView(error: PostgrestError | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function isMissingTable(error: PostgrestError | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "42703"
  );
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface InvoiceOpenItem {
  journal_line_id: string;
  entry_no: string;
  entry_date: string;
  account_code?: string;
  account_name?: string;
  cost_center_code?: string;
  cost_center_name?: string;
  open_amount: number;
  open_side: "debit" | "credit" | null;
  due_date: string | null;
  payment_terms_days: number | null;
  is_eligible_for_payment: boolean;
  is_overdue: boolean;
  line_description: string | null;
}

type OpenItemRow = {
  journal_line_id: string;
  entry_no: string;
  entry_date: string;
  account_code: string | null;
  account_name: string | null;
  cost_center_code: string | null;
  cost_center_name: string | null;
  open_amount: number;
  open_side: "debit" | "credit" | null;
  due_date: string | null;
  payment_terms_days: number | null;
  is_eligible_for_payment: boolean;
  is_overdue: boolean;
  line_description: string | null;
};

type JournalLineFallbackRow = {
  id: string;
  debit: number;
  credit: number;
  due_date: string | null;
  payment_terms_days: number | null;
  line_description: string | null;
  journal_entries: { entry_no: string; entry_date: string } | null;
  accounts: { code: string; name_ar: string } | null;
  cost_centers: { code: string; name_ar: string } | null;
};

export const invoiceSettlementApi = {
  async listOpenItemsForInvoice(invoiceId: string): Promise<InvoiceOpenItem[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("open_items_view")
      .select(
        `
        journal_line_id,
        entry_no,
        entry_date,
        account_code,
        account_name,
        cost_center_code,
        cost_center_name,
        open_amount,
        open_side,
        due_date,
        payment_terms_days,
        is_eligible_for_payment,
        is_overdue,
        line_description
      `,
      )
      .eq("source_invoice_id", invoiceId)
      .gt("open_amount", 0)
      .order("entry_date", { ascending: false });

    if (isMissingView(error)) {
      return this.listOpenItemsFallback(invoiceId);
    }

    if (error) throw new Error(error.message);

    return ((data ?? []) as OpenItemRow[]).map((row) => ({
      journal_line_id: row.journal_line_id,
      entry_no: row.entry_no,
      entry_date: row.entry_date,
      account_code: row.account_code ?? undefined,
      account_name: row.account_name ?? undefined,
      cost_center_code: row.cost_center_code ?? undefined,
      cost_center_name: row.cost_center_name ?? undefined,
      open_amount: Number(row.open_amount),
      open_side: row.open_side,
      due_date: row.due_date,
      payment_terms_days:
        row.payment_terms_days != null ? Number(row.payment_terms_days) : null,
      is_eligible_for_payment: Boolean(row.is_eligible_for_payment),
      is_overdue: Boolean(row.is_overdue),
      line_description: row.line_description,
    }));
  },

  async listOpenItemsFallback(invoiceId: string): Promise<InvoiceOpenItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("journal_entry_lines")
      .select(
        `
        id,
        debit,
        credit,
        due_date,
        payment_terms_days,
        line_description,
        journal_entries ( entry_no, entry_date ),
        accounts ( code, name_ar ),
        cost_centers ( code, name_ar )
      `,
      )
      .eq("source_invoice_id", invoiceId);

    if (error?.code === "42703") return [];
    if (error) throw new Error(error.message);

    return ((data ?? []) as unknown as JournalLineFallbackRow[])
      .map((row): InvoiceOpenItem | null => {
        const debit = Number(row.debit ?? 0);
        const credit = Number(row.credit ?? 0);
        const openAmount = Math.abs(debit - credit);
        if (openAmount <= 0) return null;

        const journal = Array.isArray(row.journal_entries)
          ? row.journal_entries[0]
          : row.journal_entries;
        const account = Array.isArray(row.accounts)
          ? row.accounts[0]
          : row.accounts;
        const cc = Array.isArray(row.cost_centers)
          ? row.cost_centers[0]
          : row.cost_centers;

        return {
          journal_line_id: row.id,
          entry_no: journal?.entry_no ?? "—",
          entry_date: journal?.entry_date ?? "",
          account_code: account?.code,
          account_name: account?.name_ar,
          cost_center_code: cc?.code,
          cost_center_name: cc?.name_ar,
          open_amount: openAmount,
          open_side:
            debit > credit ? "debit" : credit > debit ? "credit" : null,
          due_date: row.due_date,
          payment_terms_days:
            row.payment_terms_days != null
              ? Number(row.payment_terms_days)
              : null,
          is_eligible_for_payment: true,
          is_overdue: false,
          line_description: row.line_description,
        };
      })
      .filter((row): row is InvoiceOpenItem => row != null);
  },

  async listJournalLineIdsForInvoice(invoiceId: string): Promise<string[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("journal_entry_lines")
      .select("id")
      .eq("source_invoice_id", invoiceId);

    if (isMissingTable(error)) {
      const openItems = await this.listOpenItemsForInvoice(invoiceId);
      return openItems.map((item) => item.journal_line_id);
    }
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => row.id as string);
  },

  async listSettlementVouchersForInvoice(
    invoiceId: string,
  ): Promise<InvoiceSettlementVoucherRow[]> {
    const lineIds = await this.listJournalLineIdsForInvoice(invoiceId);
    if (lineIds.length === 0) return [];

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_allocations")
      .select(
        `
        applied_amount,
        target_journal_line_id,
        vouchers!inner (
          id,
          voucher_no,
          voucher_type,
          settlement_mode,
          voucher_date,
          status
        )
      `,
      )
      .in("target_journal_line_id", lineIds);

    if (isMissingTable(error)) return [];
    if (error) throw new Error(error.message);

    type AllocationRow = {
      applied_amount: number;
      target_journal_line_id: string;
      vouchers:
        | {
            id: string;
            voucher_no: string;
            voucher_type: string;
            settlement_mode: string;
            voucher_date: string;
            status: string;
          }
        | {
            id: string;
            voucher_no: string;
            voucher_type: string;
            settlement_mode: string;
            voucher_date: string;
            status: string;
          }[]
        | null;
    };

    const grouped = new Map<string, InvoiceSettlementVoucherRow>();

    for (const row of (data ?? []) as unknown as AllocationRow[]) {
      const voucher = firstRelation(row.vouchers);
      if (!voucher || voucher.settlement_mode !== "invoice") continue;
      if (voucher.voucher_type !== "receipt" && voucher.voucher_type !== "payment") {
        continue;
      }

      const amount = Number(row.applied_amount || 0);
      if (amount <= 0) continue;

      const existing = grouped.get(voucher.id);
      if (existing) {
        existing.allocated_amount += amount;
        continue;
      }

      grouped.set(voucher.id, {
        voucher_id: voucher.id,
        voucher_no: voucher.voucher_no,
        voucher_type: voucher.voucher_type as "receipt" | "payment",
        voucher_date: voucher.voucher_date,
        status: voucher.status as VoucherStatus,
        allocated_amount: amount,
      });
    }

    return Array.from(grouped.values()).sort(
      (left, right) =>
        right.voucher_date.localeCompare(left.voucher_date) ||
        right.voucher_no.localeCompare(left.voucher_no),
    );
  },

  async getInvoiceCoverageSummary(
    invoiceId: string,
    openItems?: InvoiceOpenItem[],
  ): Promise<InvoiceCoverageSummary> {
    const [items, vouchers] = await Promise.all([
      openItems ? Promise.resolve(openItems) : this.listOpenItemsForInvoice(invoiceId),
      this.listSettlementVouchersForInvoice(invoiceId),
    ]);

    return buildInvoiceCoverageSummary(items, vouchers);
  },
};

export type {
  InvoiceCoverageSummary,
  InvoiceSettlementVoucherRow,
} from "@/modules/invoices/utils/invoice-coverage-utils";
