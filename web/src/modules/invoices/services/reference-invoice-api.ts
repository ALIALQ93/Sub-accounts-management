"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { InvoiceDetail } from "@/modules/invoices/types";
import type { InvoiceReferenceSettings } from "@/modules/invoices/utils/reference-settings";
import { referenceKindForPattern } from "@/modules/invoices/utils/reference-settings";
import type { DraftMaterialLine } from "@/modules/invoices/components/invoice-material-lines-table";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

function isMissingRpc(error: PostgrestError | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42P01";
}

function isMissingColumn(error: PostgrestError | null): boolean {
  return error?.code === "42703" || Boolean(error?.message?.includes("reference_closed"));
}

export interface ReferenceInvoiceOption {
  id: string;
  invoice_no: string;
  invoice_date: string;
  status: string;
  reference_closed_at?: string | null;
  party_name_ar?: string;
  pattern_name_ar?: string;
}

export interface LoadedReferenceAccountLine {
  line_no: number;
  branch_id: string;
  cost_center_id: string | null;
  account_id: string;
  side: "debit" | "credit";
  amount: number;
  description: string | null;
}

export interface LoadedReferenceData {
  referenceInvoiceId: string;
  customerId: string;
  vendorId: string;
  branchId: string;
  costCenterId: string;
  settlementMode: "credit" | "cash";
  paymentTermsDays: number | null;
  currencyId: string;
  discountAccountId: string;
  extraAccountId: string;
  invoiceDiscountPercent: number | null;
  receiptNo: string;
  invoiceDate: string;
  materialLines: DraftMaterialLine[];
  materialIds: string[];
  accountLines: LoadedReferenceAccountLine[];
}

type ListRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  status: string;
  reference_closed_at: string | null;
  pattern_id: string;
  customer_id: string | null;
  vendor_id: string | null;
  invoice_patterns:
    | { name_ar: string; commercial_kind: string }
    | { name_ar: string; commercial_kind: string }[]
    | null;
  customers: { name_ar: string } | { name_ar: string }[] | null;
  vendors: { name_ar: string } | { name_ar: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapReferenceMaterialLine(
  line: InvoiceDetail["materialLines"][number],
  index: number,
  settings: InvoiceReferenceSettings,
  defaults: { branchId: string; costCenterId: string; warehouseId: string },
): DraftMaterialLine {
  let unitPrice = settings.load_unit_price ? line.unit_price : 0;
  let discountPercent = line.discount_percent ?? null;
  let discountAmount = line.discount_amount ?? null;
  let extraPercent = line.extra_percent ?? null;
  let extraAmount = line.extra_amount ?? null;

  if (!settings.load_discount_extra) {
    discountPercent = null;
    discountAmount = null;
    extraPercent = null;
    extraAmount = null;
  }

  if (
    settings.load_net_unit_price &&
    settings.load_unit_price &&
    line.quantity > 0
  ) {
    unitPrice = Math.round((line.line_amount / line.quantity) * 10000) / 10000;
    discountPercent = null;
    discountAmount = null;
    extraPercent = null;
    extraAmount = null;
  }

  return {
    clientId: `ref-${line.id}-${index}`,
    line_no: index + 1,
    branch_id: settings.load_cost_center ? line.branch_id : defaults.branchId,
    cost_center_id: settings.load_cost_center
      ? line.cost_center_id
      : defaults.costCenterId || null,
    warehouse_id: settings.load_warehouse ? line.warehouse_id : defaults.warehouseId,
    material_id: line.material_id,
    material_unit_id: line.material_unit_id,
    quantity: line.quantity,
    unit_price: unitPrice,
    line_description: line.line_description,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    extra_percent: extraPercent,
    extra_amount: extraAmount,
    expiry_date: settings.load_expiry_date ? (line.expiry_date ?? null) : null,
    serial_number: settings.load_serial_number
      ? (line.serial_number?.trim() || null)
      : null,
    color: line.color ?? null,
    size: line.size ?? null,
    source: line.source ?? null,
    caliber: line.caliber ?? null,
  };
}

function mapReferenceAccountLines(
  detail: InvoiceDetail,
  settings: InvoiceReferenceSettings,
  defaults: { branchId: string; costCenterId: string },
): LoadedReferenceAccountLine[] {
  if (!settings.load_discount_extra) return [];

  return detail.accountLines.map((line, index) => ({
    line_no: index + 1,
    branch_id: settings.load_cost_center ? line.branch_id : defaults.branchId,
    cost_center_id: settings.load_cost_center
      ? line.cost_center_id
      : defaults.costCenterId || null,
    account_id: line.account_id,
    side: line.side,
    amount: line.amount,
    description: line.description,
  }));
}

function buildHeaderFields(
  detail: InvoiceDetail,
  settings: InvoiceReferenceSettings,
  defaults: { branchId: string; costCenterId: string },
): Omit<
  LoadedReferenceData,
  "materialLines" | "materialIds" | "accountLines" | "referenceInvoiceId"
> {
  const { header } = detail;

  return {
    customerId: settings.load_party ? (header.customer_id ?? "") : "",
    vendorId: settings.load_party ? (header.vendor_id ?? "") : "",
    branchId: settings.load_cost_center ? header.branch_id : defaults.branchId,
    costCenterId: settings.load_cost_center
      ? (header.cost_center_id ?? "")
      : defaults.costCenterId,
    settlementMode: settings.load_payment_terms
      ? header.settlement_mode
      : "credit",
    paymentTermsDays: settings.load_payment_terms
      ? header.payment_terms_days
      : null,
    currencyId: header.currency_id ?? "",
    discountAccountId: settings.load_discount_extra
      ? (header.discount_account_id ?? "")
      : "",
    extraAccountId: settings.load_discount_extra
      ? (header.extra_account_id ?? "")
      : "",
    invoiceDiscountPercent: settings.load_discount_extra
      ? (header.invoice_discount_percent ?? null)
      : null,
    receiptNo: settings.load_receipt_no ? (header.receipt_no ?? "") : "",
    invoiceDate: settings.load_invoice_date ? header.invoice_date : "",
  };
}

export const referenceInvoiceApi = {
  async listCandidates(options: {
    commercialKind: string;
    excludeInvoiceId?: string;
    settings: InvoiceReferenceSettings;
  }): Promise<ReferenceInvoiceOption[]> {
    const supabase = getSupabaseClient();
    const refKind = referenceKindForPattern(options.commercialKind);

    let query = supabase
      .from("invoices")
      .select(
        `
        id, invoice_no, invoice_date, status, reference_closed_at, pattern_id, customer_id, vendor_id,
        invoice_patterns ( name_ar, commercial_kind ),
        customers ( name_ar ),
        vendors ( name_ar )
      `,
      )
      .eq("status", "posted")
      .order("invoice_date", { ascending: false })
      .limit(100);

    if (options.excludeInvoiceId) {
      query = query.neq("id", options.excludeInvoiceId);
    }

    if (
      options.settings.max_reference_age_days != null &&
      options.settings.max_reference_age_days > 0
    ) {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - options.settings.max_reference_age_days);
      query = query.gte("invoice_date", minDate.toISOString().split("T")[0]);
    }

    const { data, error } = await query;

    if (isMissingColumn(error)) {
      const fallback = await supabase
        .from("invoices")
        .select(
          `
          id, invoice_no, invoice_date, status, pattern_id, customer_id, vendor_id,
          invoice_patterns ( name_ar, commercial_kind ),
          customers ( name_ar ),
          vendors ( name_ar )
        `,
        )
        .eq("status", "posted")
        .order("invoice_date", { ascending: false })
        .limit(100);
      throwIfSupabaseError(fallback.error);
      return ((fallback.data ?? []) as unknown as ListRow[])
        .filter((row) => {
          if (!refKind) return true;
          const pattern = firstRelation(row.invoice_patterns);
          return pattern?.commercial_kind === refKind;
        })
        .map((row) => {
          const pattern = firstRelation(row.invoice_patterns);
          const customer = firstRelation(row.customers);
          const vendor = firstRelation(row.vendors);
          return {
            id: row.id,
            invoice_no: row.invoice_no,
            invoice_date: row.invoice_date,
            status: row.status,
            pattern_name_ar: pattern?.name_ar,
            party_name_ar: customer?.name_ar ?? vendor?.name_ar,
          };
        });
    }

    throwIfSupabaseError(error);

    return ((data ?? []) as unknown as ListRow[])
      .filter((row) => {
        if (!refKind) return true;
        const pattern = firstRelation(row.invoice_patterns);
        return pattern?.commercial_kind === refKind;
      })
      .filter((row) => {
        if (!options.settings.hide_closed_references) return true;
        return !row.reference_closed_at;
      })
      .map((row) => {
        const pattern = firstRelation(row.invoice_patterns);
        const customer = firstRelation(row.customers);
        const vendor = firstRelation(row.vendors);
        return {
          id: row.id,
          invoice_no: row.invoice_no,
          invoice_date: row.invoice_date,
          status: row.status,
          reference_closed_at: row.reference_closed_at,
          pattern_name_ar: pattern?.name_ar,
          party_name_ar: customer?.name_ar ?? vendor?.name_ar,
        };
      });
  },

  async closeReference(invoiceId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("close_invoice_reference", {
      p_invoice_id: invoiceId,
    });

    if (isMissingRpc(error)) {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ reference_closed_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .eq("status", "posted")
        .is("reference_closed_at", null);

      if (isMissingColumn(updateError)) return;
      throwIfSupabaseError(updateError);
      return;
    }

    throwIfSupabaseError(error);
  },

  buildLoadedData(
    detail: InvoiceDetail,
    settings: InvoiceReferenceSettings,
    defaults: {
      branchId: string;
      costCenterId: string;
      warehouseId: string;
    },
    partialOnly: boolean,
  ): LoadedReferenceData {
    const { header, materialLines } = detail;
    const linesToCopy = partialOnly ? [] : materialLines;
    const headerFields = buildHeaderFields(detail, settings, defaults);

    const draftLines: DraftMaterialLine[] = linesToCopy.map((line, index) =>
      mapReferenceMaterialLine(line, index, settings, defaults),
    );

    return {
      referenceInvoiceId: header.id,
      ...headerFields,
      materialLines: settings.load_material_lines ? draftLines : [],
      materialIds: [...new Set(draftLines.map((l) => l.material_id))],
      accountLines: mapReferenceAccountLines(detail, settings, defaults),
    };
  },

  buildLoadedDataFromSelection(
    detail: InvoiceDetail,
    settings: InvoiceReferenceSettings,
    defaults: {
      branchId: string;
      costCenterId: string;
      warehouseId: string;
    },
    selection: Array<{ line: InvoiceDetail["materialLines"][number]; quantity: number }>,
  ): LoadedReferenceData {
    const headerData = this.buildLoadedData(
      { ...detail, materialLines: [] },
      settings,
      defaults,
      true,
    );

    const draftLines: DraftMaterialLine[] = selection.map(({ line, quantity }, index) => {
      const mapped = mapReferenceMaterialLine(line, index, settings, defaults);
      return { ...mapped, quantity };
    });

    return {
      ...headerData,
      materialLines: settings.load_material_lines ? draftLines : [],
      materialIds: [...new Set(draftLines.map((l) => l.material_id))],
    };
  },
};
