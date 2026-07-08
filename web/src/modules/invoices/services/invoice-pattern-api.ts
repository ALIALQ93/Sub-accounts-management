"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  InvoiceDirection,
  InvoiceNumberingReset,
  InvoicePattern,
  InvoicePatternConditions,
  InvoicePatternListItem,
  InvoiceSettlementMode,
} from "@/modules/invoices/types";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  DEFAULT_REFERENCE_SETTINGS,
  parseReferenceSettings,
  type InvoiceReferenceSettings,
} from "@/modules/invoices/utils/reference-settings";
import {
  defaultPricingConsumedMode,
  defaultPricingCostMode,
  defaultPricingMaterialMode,
} from "@/modules/invoices/utils/pricing-modes";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

export interface BranchOption {
  id: string;
  branch_code: string;
  name_ar: string;
  is_active: boolean;
}

export interface WarehouseOption {
  id: string;
  warehouse_code: string;
  name_ar: string;
  branch_id: string;
  is_active: boolean;
}

export interface InvoicePatternConditionsFormValues {
  require_party: boolean;
  require_sales_rep: boolean;
  require_cost_center: boolean;
  require_receipt_no: boolean;
  prevent_duplicate_receipt_no: boolean;
  require_payment_terms: boolean;
  require_warehouse: boolean;
  require_color: boolean;
  require_size: boolean;
  require_source: boolean;
  require_caliber: boolean;
}

export interface InvoicePatternFormValues {
  name_ar: string;
  name_en: string;
  direction: InvoiceDirection;
  commercial_kind: string;
  is_return: boolean;
  is_opening_stock: boolean;
  is_active: boolean;
  sort_order: number;
  default_branch_id: string | null;
  default_cost_center_id: string | null;
  default_currency_id: string | null;
  default_warehouse_id: string | null;
  target_warehouse_id: string | null;
  default_creditor_account_id: string | null;
  default_debtor_account_id: string | null;
  default_cost_account_id: string | null;
  default_inventory_account_id: string | null;
  default_discount_account_id: string | null;
  default_extra_account_id: string | null;
  transfer_transit_account_id: string | null;
  paired_input_pattern_id: string | null;
  generate_journal: boolean;
  auto_post: boolean;
  cc_on_goods: boolean;
  cc_on_party: boolean;
  warehouse_movement: boolean;
  default_settlement_mode: InvoiceSettlementMode;
  payment_terms_enabled: boolean;
  default_payment_terms_days: number | null;
  discount_enabled: boolean;
  max_discount_percent: number | null;
  discount_applies_to: "line" | "invoice" | null;
  line_extra_enabled: boolean;
  line_adjustments_affect_material_cost: boolean;
  pricing_material_mode: string | null;
  pricing_cost_mode: string | null;
  pricing_consumed_mode: string | null;
  track_expiry_on_lines: boolean;
  track_serial_on_lines: boolean;
  enforce_stock_availability: boolean;
  load_party_currency: boolean;
  reservation_enabled: boolean;
  reserve_on_save: boolean;
  release_on_cancel: boolean;
  reservation_days: number | null;
  rounding_enabled: boolean;
  rounding_target: "invoice_total" | "line_amount" | "both" | null;
  rounding_mode: "nearest" | "up" | "down" | null;
  rounding_step: number | null;
  numbering_prefix: string;
  numbering_padding: number;
  numbering_include_year: boolean;
  numbering_start: number;
  numbering_reset: InvoiceNumberingReset;
  conditions: InvoicePatternConditionsFormValues;
  reference_settings: InvoiceReferenceSettings;
  allowed_material_ids: string[];
  allowed_category_ids: string[];
}

const LIST_COLUMNS =
  "id, pattern_no, name_ar, name_en, direction, commercial_kind, is_active, sort_order, default_settlement_mode";

function normalizeOptionalId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function buildPatternPayload(values: InvoicePatternFormValues) {
  return {
    name_ar: values.name_ar.trim(),
    name_en: values.name_en.trim() || null,
    direction: values.direction,
    commercial_kind: values.commercial_kind,
    is_return: values.is_return,
    is_opening_stock: values.is_opening_stock,
    is_active: values.is_active,
    sort_order: values.sort_order,
    default_branch_id: normalizeOptionalId(values.default_branch_id),
    default_cost_center_id: normalizeOptionalId(values.default_cost_center_id),
    default_currency_id: normalizeOptionalId(values.default_currency_id),
    default_warehouse_id: normalizeOptionalId(values.default_warehouse_id),
    target_warehouse_id: normalizeOptionalId(values.target_warehouse_id),
    default_creditor_account_id: normalizeOptionalId(values.default_creditor_account_id),
    default_debtor_account_id: normalizeOptionalId(values.default_debtor_account_id),
    default_cost_account_id: normalizeOptionalId(values.default_cost_account_id),
    default_inventory_account_id: normalizeOptionalId(values.default_inventory_account_id),
    default_discount_account_id: normalizeOptionalId(values.default_discount_account_id),
    default_extra_account_id: normalizeOptionalId(values.default_extra_account_id),
    transfer_transit_account_id: normalizeOptionalId(values.transfer_transit_account_id),
    paired_input_pattern_id: normalizeOptionalId(values.paired_input_pattern_id),
    generate_journal: values.generate_journal,
    auto_post: values.auto_post,
    cc_on_goods: values.cc_on_goods,
    cc_on_party: values.cc_on_party,
    warehouse_movement: values.warehouse_movement,
    default_settlement_mode: values.default_settlement_mode,
    payment_terms_enabled: values.payment_terms_enabled,
    default_payment_terms_days: values.payment_terms_enabled
      ? values.default_payment_terms_days
      : null,
    discount_enabled: values.discount_enabled,
    max_discount_percent: values.discount_enabled ? values.max_discount_percent : null,
    discount_applies_to: values.discount_enabled ? values.discount_applies_to : null,
    line_extra_enabled: values.line_extra_enabled,
    line_adjustments_affect_material_cost: values.line_adjustments_affect_material_cost,
    pricing_material_mode: values.warehouse_movement
      ? values.pricing_material_mode
      : null,
    pricing_cost_mode:
      values.warehouse_movement && values.direction === "input"
        ? values.pricing_cost_mode
        : null,
    pricing_consumed_mode:
      values.warehouse_movement && values.direction === "output"
        ? values.pricing_consumed_mode
        : null,
    track_expiry_on_lines: values.warehouse_movement
      ? values.track_expiry_on_lines
      : false,
    track_serial_on_lines: values.warehouse_movement
      ? values.track_serial_on_lines
      : false,
    enforce_stock_availability: values.enforce_stock_availability,
    load_party_currency: values.load_party_currency,
    reservation_enabled: values.reservation_enabled,
    reserve_on_save: values.reservation_enabled ? values.reserve_on_save : true,
    release_on_cancel: values.reservation_enabled ? values.release_on_cancel : true,
    reservation_days: values.reservation_enabled ? values.reservation_days : null,
    rounding_enabled: values.rounding_enabled,
    rounding_target: values.rounding_enabled ? values.rounding_target : null,
    rounding_mode: values.rounding_enabled ? values.rounding_mode : null,
    rounding_step: values.rounding_enabled ? values.rounding_step : null,
    numbering_prefix: values.numbering_prefix.trim() || "INV",
    numbering_padding: values.numbering_padding,
    numbering_include_year: values.numbering_include_year,
    numbering_start: values.numbering_start,
    numbering_reset: values.numbering_reset,
    reference_settings: values.reference_settings,
  };
}

function buildConditionsPayload(values: InvoicePatternConditionsFormValues) {
  return {
    require_party: values.require_party,
    require_sales_rep: values.require_sales_rep,
    require_cost_center: values.require_cost_center,
    require_receipt_no: values.require_receipt_no,
    prevent_duplicate_receipt_no: values.prevent_duplicate_receipt_no,
    require_payment_terms: values.require_payment_terms,
    require_warehouse: values.require_warehouse,
    require_color: values.require_color,
    require_size: values.require_size,
    require_source: values.require_source,
    require_caliber: values.require_caliber,
  };
}

export const DEFAULT_PATTERN_CONDITIONS: InvoicePatternConditionsFormValues = {
  require_party: false,
  require_sales_rep: false,
  require_cost_center: false,
  require_receipt_no: false,
  prevent_duplicate_receipt_no: false,
  require_payment_terms: false,
  require_warehouse: false,
  require_color: false,
  require_size: false,
  require_source: false,
  require_caliber: false,
};

export const invoicePatternApi = {
  async listInvoicePatterns(): Promise<InvoicePatternListItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoice_patterns")
      .select(LIST_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("pattern_no", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as InvoicePatternListItem[];
  },

  async getInvoicePattern(id: string): Promise<InvoicePattern> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoice_patterns")
      .select("*")
      .eq("id", id)
      .single();
    throwIfSupabaseError(error);
    return data as InvoicePattern;
  },

  async createInvoicePattern(
    values: InvoicePatternFormValues,
  ): Promise<InvoicePattern> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoice_patterns")
      .insert(buildPatternPayload(values))
      .select("*")
      .single();
    throwIfSupabaseError(error);
    await this.upsertPatternConditions(data.id, values.conditions);
    await this.replaceAllowedMaterials(data.id, values.allowed_material_ids);
    await this.replaceAllowedCategories(data.id, values.allowed_category_ids);
    return data as InvoicePattern;
  },

  async updateInvoicePattern(
    id: string,
    values: InvoicePatternFormValues,
  ): Promise<InvoicePattern> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoice_patterns")
      .update(buildPatternPayload(values))
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    await this.upsertPatternConditions(id, values.conditions);
    await this.replaceAllowedMaterials(id, values.allowed_material_ids);
    await this.replaceAllowedCategories(id, values.allowed_category_ids);
    return data as InvoicePattern;
  },

  async listAllowedMaterialIds(patternId: string): Promise<string[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoice_pattern_allowed_materials")
      .select("material_id")
      .eq("pattern_id", patternId);
    throwIfSupabaseError(error);
    return (data ?? []).map((row) => row.material_id as string);
  },

  async listAllowedCategoryIds(patternId: string): Promise<string[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoice_pattern_allowed_categories")
      .select("category_id")
      .eq("pattern_id", patternId);
    throwIfSupabaseError(error);
    return (data ?? []).map((row) => row.category_id as string);
  },

  async replaceAllowedMaterials(
    patternId: string,
    materialIds: string[],
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase
      .from("invoice_pattern_allowed_materials")
      .delete()
      .eq("pattern_id", patternId);
    throwIfSupabaseError(deleteError);

    if (materialIds.length === 0) return;

    const { error } = await supabase.from("invoice_pattern_allowed_materials").insert(
      materialIds.map((material_id) => ({ pattern_id: patternId, material_id })),
    );
    throwIfSupabaseError(error);
  },

  async replaceAllowedCategories(
    patternId: string,
    categoryIds: string[],
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase
      .from("invoice_pattern_allowed_categories")
      .delete()
      .eq("pattern_id", patternId);
    throwIfSupabaseError(deleteError);

    if (categoryIds.length === 0) return;

    const { error } = await supabase.from("invoice_pattern_allowed_categories").insert(
      categoryIds.map((category_id) => ({ pattern_id: patternId, category_id })),
    );
    throwIfSupabaseError(error);
  },

  async getPatternConditions(
    patternId: string,
  ): Promise<InvoicePatternConditions | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoice_pattern_conditions")
      .select("*")
      .eq("pattern_id", patternId)
      .maybeSingle();
    throwIfSupabaseError(error);
    return (data as InvoicePatternConditions | null) ?? null;
  },

  async upsertPatternConditions(
    patternId: string,
    values: InvoicePatternConditionsFormValues,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("invoice_pattern_conditions")
      .upsert({
        pattern_id: patternId,
        ...buildConditionsPayload(values),
        updated_at: new Date().toISOString(),
      });
    throwIfSupabaseError(error);
  },

  async peekInvoiceNo(patternId: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("peek_invoice_no", {
      p_pattern_id: patternId,
    });
    throwIfSupabaseError(error);
    return String(data ?? "");
  },

  async listBranches(): Promise<BranchOption[]> {
    const { branchApi } = await import("@/modules/branches/services/branch-api");
    return branchApi.listBranchOptions();
  },

  async listWarehouses(): Promise<WarehouseOption[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("warehouses")
      .select("id, warehouse_code, name_ar, branch_id, is_active")
      .order("warehouse_code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as WarehouseOption[];
  },
};

export function patternToFormValues(
  pattern: InvoicePattern,
  conditions?: InvoicePatternConditions | null,
  allowedMaterialIds: string[] = [],
  allowedCategoryIds: string[] = [],
): InvoicePatternFormValues {
  return {
    name_ar: pattern.name_ar,
    name_en: pattern.name_en ?? "",
    direction: pattern.direction,
    commercial_kind: pattern.commercial_kind,
    is_return: pattern.is_return,
    is_opening_stock: pattern.is_opening_stock,
    is_active: pattern.is_active,
    sort_order: pattern.sort_order,
    default_branch_id: pattern.default_branch_id,
    default_cost_center_id: pattern.default_cost_center_id,
    default_currency_id: pattern.default_currency_id,
    default_warehouse_id: pattern.default_warehouse_id,
    target_warehouse_id: pattern.target_warehouse_id,
    default_creditor_account_id: pattern.default_creditor_account_id,
    default_debtor_account_id: pattern.default_debtor_account_id,
    default_cost_account_id: pattern.default_cost_account_id,
    default_inventory_account_id: pattern.default_inventory_account_id,
    default_discount_account_id: pattern.default_discount_account_id ?? null,
    default_extra_account_id: pattern.default_extra_account_id ?? null,
    transfer_transit_account_id: pattern.transfer_transit_account_id,
    paired_input_pattern_id: pattern.paired_input_pattern_id,
    generate_journal: pattern.generate_journal,
    auto_post: pattern.auto_post,
    cc_on_goods: pattern.cc_on_goods,
    cc_on_party: pattern.cc_on_party,
    warehouse_movement: pattern.warehouse_movement,
    default_settlement_mode: pattern.default_settlement_mode,
    payment_terms_enabled: pattern.payment_terms_enabled,
    default_payment_terms_days: pattern.default_payment_terms_days,
    discount_enabled: pattern.discount_enabled ?? false,
    max_discount_percent: pattern.max_discount_percent,
    discount_applies_to: pattern.discount_applies_to,
    line_extra_enabled: pattern.line_extra_enabled ?? false,
    line_adjustments_affect_material_cost:
      pattern.line_adjustments_affect_material_cost ?? true,
    pricing_material_mode:
      pattern.pricing_material_mode ??
      defaultPricingMaterialMode(pattern.commercial_kind),
    pricing_cost_mode:
      pattern.pricing_cost_mode ??
      (pattern.direction === "input" ? defaultPricingCostMode() : null),
    pricing_consumed_mode:
      pattern.pricing_consumed_mode ??
      (pattern.direction === "output" ? defaultPricingConsumedMode() : null),
    track_expiry_on_lines: pattern.track_expiry_on_lines ?? true,
    track_serial_on_lines: pattern.track_serial_on_lines ?? true,
    enforce_stock_availability: pattern.enforce_stock_availability ?? true,
    load_party_currency: pattern.load_party_currency ?? false,
    reservation_enabled: pattern.reservation_enabled ?? false,
    reserve_on_save: pattern.reserve_on_save ?? true,
    release_on_cancel: pattern.release_on_cancel ?? true,
    reservation_days: pattern.reservation_days,
    rounding_enabled: pattern.rounding_enabled ?? false,
    rounding_target: pattern.rounding_target,
    rounding_mode: pattern.rounding_mode,
    rounding_step: pattern.rounding_step,
    numbering_prefix: pattern.numbering_prefix,
    numbering_padding: pattern.numbering_padding,
    numbering_include_year: pattern.numbering_include_year,
    numbering_start: pattern.numbering_start,
    numbering_reset: pattern.numbering_reset,
    reference_settings: parseReferenceSettings(pattern.reference_settings),
    conditions: conditions
      ? {
          require_party: conditions.require_party,
          require_sales_rep: conditions.require_sales_rep,
          require_cost_center: conditions.require_cost_center,
          require_receipt_no: conditions.require_receipt_no,
          prevent_duplicate_receipt_no: conditions.prevent_duplicate_receipt_no,
          require_payment_terms: conditions.require_payment_terms,
          require_warehouse: conditions.require_warehouse,
          require_color: conditions.require_color,
          require_size: conditions.require_size,
          require_source: conditions.require_source,
          require_caliber: conditions.require_caliber,
        }
      : { ...DEFAULT_PATTERN_CONDITIONS },
    allowed_material_ids: allowedMaterialIds,
    allowed_category_ids: allowedCategoryIds,
  };
}

export const DEFAULT_INVOICE_PATTERN_FORM: InvoicePatternFormValues = {
  name_ar: "",
  name_en: "",
  direction: "output",
  commercial_kind: "sale",
  is_return: false,
  is_opening_stock: false,
  is_active: true,
  sort_order: 0,
  default_branch_id: null,
  default_cost_center_id: null,
  default_currency_id: null,
  default_warehouse_id: null,
  target_warehouse_id: null,
  default_creditor_account_id: null,
  default_debtor_account_id: null,
  default_cost_account_id: null,
  default_inventory_account_id: null,
  default_discount_account_id: null,
  default_extra_account_id: null,
  transfer_transit_account_id: null,
  paired_input_pattern_id: null,
  generate_journal: true,
  auto_post: false,
  cc_on_goods: false,
  cc_on_party: false,
  warehouse_movement: true,
  default_settlement_mode: "credit",
  payment_terms_enabled: false,
  default_payment_terms_days: 30,
  discount_enabled: false,
  max_discount_percent: null,
  discount_applies_to: "line",
  line_extra_enabled: false,
  line_adjustments_affect_material_cost: true,
  pricing_material_mode: "sale",
  pricing_cost_mode: null,
  pricing_consumed_mode: "weighted_avg",
  track_expiry_on_lines: true,
  track_serial_on_lines: true,
  enforce_stock_availability: true,
  load_party_currency: false,
  reservation_enabled: false,
  reserve_on_save: true,
  release_on_cancel: true,
  reservation_days: 7,
  rounding_enabled: false,
  rounding_target: "invoice_total",
  rounding_mode: "nearest",
  rounding_step: null,
  numbering_prefix: "INV",
  numbering_padding: 4,
  numbering_include_year: true,
  numbering_start: 1,
  numbering_reset: "yearly",
  reference_settings: { ...DEFAULT_REFERENCE_SETTINGS },
  conditions: { ...DEFAULT_PATTERN_CONDITIONS },
  allowed_material_ids: [],
  allowed_category_ids: [],
};
