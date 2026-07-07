"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
import type {
  InvoiceAccountLine,
  InvoiceDetail,
  InvoiceHeader,
  InvoiceListItem,
  InvoiceMaterialLine,
  InvoiceSettlementMode,
} from "@/modules/invoices/types";
import type { InvoicePattern } from "@/modules/invoices/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) throw errorFromSupabase(error);
}

export interface InvoiceMaterialLineInput {
  id?: string;
  line_no: number;
  branch_id: string;
  cost_center_id: string | null;
  warehouse_id: string;
  material_id: string;
  material_unit_id: string;
  quantity: number;
  unit_price: number;
  line_description: string | null;
  expiry_date?: string | null;
  serial_number?: string | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  extra_percent?: number | null;
  extra_amount?: number | null;
  qty_received?: number | null;
  color?: string | null;
  size?: string | null;
  source?: string | null;
  caliber?: string | null;
}

export interface InvoiceAccountLineInput {
  id?: string;
  line_no: number;
  branch_id: string;
  cost_center_id: string | null;
  account_id: string;
  side: "debit" | "credit";
  amount: number;
  description: string | null;
}

export interface InvoiceSavePayload {
  id?: string;
  pattern_id: string;
  invoice_date: string;
  branch_id: string;
  cost_center_id: string | null;
  customer_id: string | null;
  vendor_id: string | null;
  creditor_account_id: string | null;
  debtor_account_id: string | null;
  cost_account_id: string | null;
  inventory_account_id: string | null;
  discount_account_id?: string | null;
  extra_account_id?: string | null;
  settlement_mode: InvoiceSettlementMode;
  payment_terms_days: number | null;
  currency_id: string | null;
  exchange_rate: number | null;
  receipt_no: string | null;
  sales_rep_id: string | null;
  reference_invoice_id?: string | null;
  invoice_discount_percent?: number | null;
  description: string | null;
  inventory_transfer_id?: string | null;
  transfer_role?: "out" | "in" | null;
  materialLines: InvoiceMaterialLineInput[];
  accountLines: InvoiceAccountLineInput[];
}

type InvoiceListRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  status: InvoiceListItem["status"];
  settlement_mode: InvoiceSettlementMode;
  pattern_id: string;
  created_at: string;
  invoice_patterns:
    | { name_ar: string; commercial_kind: string }
    | { name_ar: string; commercial_kind: string }[]
    | null;
  branches: { name_ar: string } | { name_ar: string }[] | null;
  customers: { name_ar: string } | { name_ar: string }[] | null;
  vendors: { name_ar: string } | { name_ar: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapListRow(row: InvoiceListRow): InvoiceListItem {
  const pattern = firstRelation(row.invoice_patterns);
  const branch = firstRelation(row.branches);
  const customer = firstRelation(row.customers);
  const vendor = firstRelation(row.vendors);
  return {
    id: row.id,
    invoice_no: row.invoice_no,
    invoice_date: row.invoice_date,
    status: row.status,
    settlement_mode: row.settlement_mode,
    pattern_id: row.pattern_id,
    pattern_name_ar: pattern?.name_ar,
    commercial_kind: pattern?.commercial_kind,
    branch_name_ar: branch?.name_ar,
    party_name_ar: customer?.name_ar ?? vendor?.name_ar,
    created_at: row.created_at,
  };
}

function buildHeaderPayload(payload: InvoiceSavePayload) {
  return {
    pattern_id: payload.pattern_id,
    invoice_date: payload.invoice_date,
    branch_id: payload.branch_id,
    cost_center_id: payload.cost_center_id,
    customer_id: payload.customer_id,
    vendor_id: payload.vendor_id,
    creditor_account_id: payload.creditor_account_id,
    debtor_account_id: payload.debtor_account_id,
    cost_account_id: payload.cost_account_id,
    inventory_account_id: payload.inventory_account_id,
    discount_account_id: payload.discount_account_id ?? null,
    extra_account_id: payload.extra_account_id ?? null,
    settlement_mode: payload.settlement_mode,
    payment_terms_days: payload.payment_terms_days,
    currency_id: payload.currency_id,
    exchange_rate: payload.exchange_rate,
    receipt_no: payload.receipt_no?.trim() || null,
    sales_rep_id: payload.sales_rep_id || null,
    reference_invoice_id: payload.reference_invoice_id || null,
    invoice_discount_percent: payload.invoice_discount_percent ?? null,
    description: payload.description?.trim() || null,
    inventory_transfer_id: payload.inventory_transfer_id ?? null,
    transfer_role: payload.transfer_role ?? null,
  };
}

export const invoiceApi = {
  async listInvoices(): Promise<InvoiceListItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        id, invoice_no, invoice_date, status, settlement_mode, pattern_id, created_at,
        invoice_patterns ( name_ar, commercial_kind ),
        branches ( name_ar ),
        customers ( name_ar ),
        vendors ( name_ar )
      `,
      )
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });
    throwIfSupabaseError(error);
    return ((data ?? []) as unknown as InvoiceListRow[]).map(mapListRow);
  },

  async getInvoice(id: string): Promise<InvoiceDetail> {
    const supabase = getSupabaseClient();

    const { data: header, error: headerError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .single();
    throwIfSupabaseError(headerError);

    const invoice = header as InvoiceHeader;

    const [patternResult, materialResult, accountResult] = await Promise.all([
      supabase.from("invoice_patterns").select("*").eq("id", invoice.pattern_id).single(),
      supabase
        .from("invoice_material_lines")
        .select(
          `
          *,
          materials ( material_code, name_ar ),
          material_units ( name_ar ),
          warehouses ( warehouse_code )
        `,
        )
        .eq("invoice_id", id)
        .order("line_no", { ascending: true }),
      supabase
        .from("invoice_account_lines")
        .select(
          `
          *,
          accounts ( code, name_ar )
        `,
        )
        .eq("invoice_id", id)
        .order("line_no", { ascending: true }),
    ]);

    throwIfSupabaseError(patternResult.error);
    throwIfSupabaseError(materialResult.error);
    throwIfSupabaseError(accountResult.error);

    type MaterialRow = InvoiceMaterialLine & {
      materials: { material_code: string; name_ar: string } | null;
      material_units: { name_ar: string } | null;
      warehouses: { warehouse_code: string } | null;
    };

    type AccountRow = InvoiceAccountLine & {
      accounts: { code: string; name_ar: string } | null;
    };

    const materialLines = ((materialResult.data ?? []) as MaterialRow[]).map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      quantity_base: Number(row.quantity_base),
      unit_price: Number(row.unit_price),
      line_amount: Number(row.line_amount),
      discount_percent: row.discount_percent != null ? Number(row.discount_percent) : null,
      discount_amount: Number(row.discount_amount ?? 0),
      extra_percent: row.extra_percent != null ? Number(row.extra_percent) : null,
      extra_amount: Number(row.extra_amount ?? 0),
      material_code: row.materials?.material_code,
      material_name_ar: row.materials?.name_ar,
      unit_name_ar: row.material_units?.name_ar,
      warehouse_code: row.warehouses?.warehouse_code,
    }));

    const accountLines = ((accountResult.data ?? []) as AccountRow[]).map((row) => ({
      ...row,
      amount: Number(row.amount),
      account_code: row.accounts?.code,
      account_name: row.accounts?.name_ar,
    }));

    return {
      header: {
        ...invoice,
        exchange_rate: invoice.exchange_rate ? Number(invoice.exchange_rate) : null,
        invoice_discount_amount: Number(invoice.invoice_discount_amount ?? 0),
        invoice_discount_percent:
          invoice.invoice_discount_percent != null
            ? Number(invoice.invoice_discount_percent)
            : null,
      },
      pattern: patternResult.data as InvoicePattern,
      materialLines,
      accountLines,
    };
  },

  async reserveInvoiceNo(patternId: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("reserve_invoice_no", {
      p_pattern_id: patternId,
    });
    throwIfSupabaseError(error);
    return String(data ?? "");
  },

  async saveInvoice(payload: InvoiceSavePayload): Promise<InvoiceHeader> {
    const supabase = getSupabaseClient();

    if (payload.id) {
      const { data, error } = await supabase
        .from("invoices")
        .update(buildHeaderPayload(payload))
        .eq("id", payload.id)
        .select("*")
        .single();
      throwIfSupabaseError(error);

      await this.replaceLines(payload.id, payload.materialLines, payload.accountLines);
      await this.syncReservations(payload.id);
      return data as InvoiceHeader;
    }

    const invoiceNo = await this.reserveInvoiceNo(payload.pattern_id);
    const { data, error } = await supabase
      .from("invoices")
      .insert({
        ...buildHeaderPayload(payload),
        invoice_no: invoiceNo,
        status: "draft",
      })
      .select("*")
      .single();
    throwIfSupabaseError(error);

    const created = data as InvoiceHeader;
    await this.replaceLines(created.id, payload.materialLines, payload.accountLines);
    await this.syncReservations(created.id);
    return created;
  },

  async syncReservations(invoiceId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("sync_invoice_reservations", {
      p_invoice_id: invoiceId,
    });
    if (error?.code === "PGRST202") return;
    throwIfSupabaseError(error);
  },

  async replaceLines(
    invoiceId: string,
    materialLines: InvoiceMaterialLineInput[],
    accountLines: InvoiceAccountLineInput[],
  ): Promise<void> {
    const supabase = getSupabaseClient();

    const { error: deleteMaterialError } = await supabase
      .from("invoice_material_lines")
      .delete()
      .eq("invoice_id", invoiceId);
    throwIfSupabaseError(deleteMaterialError);

    const { error: deleteAccountError } = await supabase
      .from("invoice_account_lines")
      .delete()
      .eq("invoice_id", invoiceId);
    throwIfSupabaseError(deleteAccountError);

    if (materialLines.length > 0) {
      const { error } = await supabase.from("invoice_material_lines").insert(
        materialLines.map((line) => ({
          invoice_id: invoiceId,
          line_no: line.line_no,
          branch_id: line.branch_id,
          cost_center_id: line.cost_center_id,
          warehouse_id: line.warehouse_id,
          material_id: line.material_id,
          material_unit_id: line.material_unit_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          line_description: line.line_description,
          qty_received: line.qty_received ?? null,
          color: line.color?.trim() || null,
          size: line.size?.trim() || null,
          source: line.source?.trim() || null,
          caliber: line.caliber?.trim() || null,
          expiry_date: line.expiry_date || null,
          serial_number: line.serial_number?.trim() || null,
          discount_percent: line.discount_percent ?? null,
          discount_amount: line.discount_amount ?? 0,
          extra_percent: line.extra_percent ?? null,
          extra_amount: line.extra_amount ?? 0,
        })),
      );
      throwIfSupabaseError(error);
    }

    if (accountLines.length > 0) {
      const { error } = await supabase.from("invoice_account_lines").insert(
        accountLines.map((line) => ({
          invoice_id: invoiceId,
          line_no: line.line_no,
          branch_id: line.branch_id,
          cost_center_id: line.cost_center_id,
          account_id: line.account_id,
          side: line.side,
          amount: line.amount,
          description: line.description,
        })),
      );
      throwIfSupabaseError(error);
    }
  },

  async postInvoice(id: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("post_invoice", {
      p_invoice_id: id,
    });
    throwIfSupabaseError(error);
    const journalId = String(data ?? "");
    const { error: releaseError } = await supabase.rpc(
      "release_invoice_reservations",
      { p_invoice_id: id, p_status: "fulfilled" },
    );
    if (releaseError?.code !== "PGRST202") {
      throwIfSupabaseError(releaseError);
    }
    return journalId;
  },

  async isReceiptNoTaken(
    receiptNo: string,
    excludeInvoiceId?: string,
  ): Promise<boolean> {
    const trimmed = receiptNo.trim();
    if (!trimmed) return false;

    const supabase = getSupabaseClient();
    let query = supabase
      .from("invoices")
      .select("id")
      .eq("receipt_no", trimmed)
      .limit(1);

    if (excludeInvoiceId) {
      query = query.neq("id", excludeInvoiceId);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return (data ?? []).length > 0;
  },
};
