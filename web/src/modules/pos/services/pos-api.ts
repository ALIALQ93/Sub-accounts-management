"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
import type {
  PosPaymentMethod,
  PosPoint,
  PosPointDetail,
  PosPointFormValues,
} from "@/modules/pos/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) throw errorFromSupabase(error);
}

function mapPoint(row: Record<string, unknown>): PosPoint {
  const branch = row.branches as
    | { branch_code?: string; name_ar?: string }
    | { branch_code?: string; name_ar?: string }[]
    | null;
  const warehouse = row.warehouses as
    | { warehouse_code?: string; name_ar?: string }
    | { warehouse_code?: string; name_ar?: string }[]
    | null;
  const pattern = row.invoice_patterns as
    | { name_ar?: string }
    | { name_ar?: string }[]
    | null;
  const branchRow = Array.isArray(branch) ? branch[0] : branch;
  const warehouseRow = Array.isArray(warehouse) ? warehouse[0] : warehouse;
  const patternRow = Array.isArray(pattern) ? pattern[0] : pattern;

  return {
    id: String(row.id),
    point_code: String(row.point_code),
    name_ar: String(row.name_ar),
    name_en: (row.name_en as string | null) ?? null,
    branch_id: String(row.branch_id),
    warehouse_id: String(row.warehouse_id),
    invoice_pattern_id: String(row.invoice_pattern_id),
    default_customer_id: (row.default_customer_id as string | null) ?? null,
    default_debtor_account_id:
      (row.default_debtor_account_id as string | null) ?? null,
    default_creditor_account_id:
      (row.default_creditor_account_id as string | null) ?? null,
    receipt_header: (row.receipt_header as string | null) ?? null,
    receipt_footer: (row.receipt_footer as string | null) ?? null,
    allow_price_override: Boolean(row.allow_price_override),
    allow_line_discount: Boolean(row.allow_line_discount),
    require_customer: Boolean(row.require_customer),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
    branch_code: branchRow?.branch_code,
    branch_name_ar: branchRow?.name_ar,
    warehouse_code: warehouseRow?.warehouse_code,
    warehouse_name_ar: warehouseRow?.name_ar,
    pattern_name_ar: patternRow?.name_ar,
  };
}

function buildPointPayload(values: PosPointFormValues): Record<string, unknown> {
  return {
    point_code: values.point_code.trim().toUpperCase(),
    name_ar: values.name_ar.trim(),
    name_en: values.name_en.trim() || null,
    branch_id: values.branch_id,
    warehouse_id: values.warehouse_id,
    invoice_pattern_id: values.invoice_pattern_id,
    default_customer_id: values.default_customer_id || null,
    default_debtor_account_id: values.default_debtor_account_id || null,
    default_creditor_account_id: values.default_creditor_account_id || null,
    receipt_header: values.receipt_header.trim() || null,
    receipt_footer: values.receipt_footer.trim() || null,
    allow_price_override: values.allow_price_override,
    allow_line_discount: values.allow_line_discount,
    require_customer: values.require_customer,
    is_active: values.is_active,
    sort_order: values.sort_order,
    updated_at: new Date().toISOString(),
  };
}

async function replaceChildren(
  pointId: string,
  values: PosPointFormValues,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: delPay } = await supabase
    .from("pos_point_payment_methods")
    .delete()
    .eq("pos_point_id", pointId);
  throwIfSupabaseError(delPay);

  const payments = values.payment_methods.filter((row) => row.account_id);
  if (payments.length > 0) {
    const { error } = await supabase.from("pos_point_payment_methods").insert(
      payments.map((row, index) => ({
        pos_point_id: pointId,
        account_id: row.account_id,
        label_ar: row.label_ar.trim() || "دفعة",
        label_en: row.label_en.trim() || null,
        is_default: row.is_default,
        is_active: row.is_active,
        sort_order: index,
      })),
    );
    throwIfSupabaseError(error);
  }

  const { error: delMat } = await supabase
    .from("pos_point_allowed_materials")
    .delete()
    .eq("pos_point_id", pointId);
  throwIfSupabaseError(delMat);
  if (values.allowed_material_ids.length > 0) {
    const { error } = await supabase.from("pos_point_allowed_materials").insert(
      values.allowed_material_ids.map((material_id) => ({
        pos_point_id: pointId,
        material_id,
      })),
    );
    throwIfSupabaseError(error);
  }

  const { error: delCat } = await supabase
    .from("pos_point_allowed_categories")
    .delete()
    .eq("pos_point_id", pointId);
  throwIfSupabaseError(delCat);
  if (values.allowed_category_ids.length > 0) {
    const { error } = await supabase.from("pos_point_allowed_categories").insert(
      values.allowed_category_ids.map((category_id) => ({
        pos_point_id: pointId,
        category_id,
      })),
    );
    throwIfSupabaseError(error);
  }
}

export const posApi = {
  async listPoints(): Promise<PosPoint[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("pos_points")
      .select(
        `
        id, point_code, name_ar, name_en, branch_id, warehouse_id,
        invoice_pattern_id, default_customer_id, default_debtor_account_id,
        default_creditor_account_id, receipt_header, receipt_footer,
        allow_price_override, allow_line_discount, require_customer,
        is_active, sort_order,
        branches ( branch_code, name_ar ),
        warehouses ( warehouse_code, name_ar ),
        invoice_patterns ( name_ar )
      `,
      )
      .order("sort_order", { ascending: true })
      .order("point_code", { ascending: true });

    if (error?.code === "42P01" || error?.code === "PGRST205") return [];
    throwIfSupabaseError(error);
    return ((data ?? []) as Record<string, unknown>[]).map(mapPoint);
  },

  async getPointDetail(id: string): Promise<PosPointDetail | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("pos_points")
      .select(
        `
        id, point_code, name_ar, name_en, branch_id, warehouse_id,
        invoice_pattern_id, default_customer_id, default_debtor_account_id,
        default_creditor_account_id, receipt_header, receipt_footer,
        allow_price_override, allow_line_discount, require_customer,
        is_active, sort_order,
        branches ( branch_code, name_ar ),
        warehouses ( warehouse_code, name_ar ),
        invoice_patterns ( name_ar )
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error?.code === "42P01" || error?.code === "PGRST205") return null;
    throwIfSupabaseError(error);
    if (!data) return null;

    const point = mapPoint(data as Record<string, unknown>);

    const [payments, materials, categories] = await Promise.all([
      supabase
        .from("pos_point_payment_methods")
        .select(
          `
          id, pos_point_id, account_id, label_ar, label_en,
          is_default, is_active, sort_order,
          accounts ( account_code, name_ar )
        `,
        )
        .eq("pos_point_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("pos_point_allowed_materials")
        .select("material_id")
        .eq("pos_point_id", id),
      supabase
        .from("pos_point_allowed_categories")
        .select("category_id")
        .eq("pos_point_id", id),
    ]);

    throwIfSupabaseError(payments.error);
    throwIfSupabaseError(materials.error);
    throwIfSupabaseError(categories.error);

    const payment_methods: PosPaymentMethod[] = (
      (payments.data ?? []) as Record<string, unknown>[]
    ).map((row) => {
      const account = row.accounts as
        | { account_code?: string; name_ar?: string }
        | { account_code?: string; name_ar?: string }[]
        | null;
      const accountRow = Array.isArray(account) ? account[0] : account;
      return {
        id: String(row.id),
        pos_point_id: String(row.pos_point_id),
        account_id: String(row.account_id),
        label_ar: String(row.label_ar),
        label_en: (row.label_en as string | null) ?? null,
        is_default: Boolean(row.is_default),
        is_active: Boolean(row.is_active),
        sort_order: Number(row.sort_order ?? 0),
        account_code: accountRow?.account_code,
        account_name_ar: accountRow?.name_ar,
      };
    });

    return {
      ...point,
      payment_methods,
      allowed_material_ids: ((materials.data ?? []) as { material_id: string }[]).map(
        (row) => row.material_id,
      ),
      allowed_category_ids: (
        (categories.data ?? []) as { category_id: string }[]
      ).map((row) => row.category_id),
    };
  },

  async createPoint(values: PosPointFormValues): Promise<PosPointDetail> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("pos_points")
      .insert(buildPointPayload(values))
      .select("id")
      .single();
    throwIfSupabaseError(error);
    const id = String((data as { id: string }).id);
    await replaceChildren(id, values);
    const detail = await this.getPointDetail(id);
    if (!detail) throw new Error("فشل تحميل نقطة البيع بعد الإنشاء.");
    return detail;
  },

  async updatePoint(
    id: string,
    values: PosPointFormValues,
  ): Promise<PosPointDetail> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("pos_points")
      .update(buildPointPayload(values))
      .eq("id", id);
    throwIfSupabaseError(error);
    await replaceChildren(id, values);
    const detail = await this.getPointDetail(id);
    if (!detail) throw new Error("فشل تحميل نقطة البيع بعد الحفظ.");
    return detail;
  },
};
