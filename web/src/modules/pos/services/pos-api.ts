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

const POS_POINT_COLUMNS = `
  id, point_code, name_ar, name_en, branch_id, warehouse_id,
  invoice_pattern_id, default_customer_id, default_debtor_account_id,
  default_creditor_account_id, receipt_header, receipt_footer,
  allow_price_override, allow_line_discount, require_customer,
  is_active, sort_order
`;

function mapPointRow(
  row: Record<string, unknown>,
  extras?: {
    branch_code?: string;
    branch_name_ar?: string;
    warehouse_code?: string;
    warehouse_name_ar?: string;
    pattern_name_ar?: string;
  },
): PosPoint {
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
    branch_code: extras?.branch_code,
    branch_name_ar: extras?.branch_name_ar,
    warehouse_code: extras?.warehouse_code,
    warehouse_name_ar: extras?.warehouse_name_ar,
    pattern_name_ar: extras?.pattern_name_ar,
  };
}

async function enrichPoints(
  rows: Record<string, unknown>[],
): Promise<PosPoint[]> {
  if (rows.length === 0) return [];

  const supabase = getSupabaseClient();
  const branchIds = [
    ...new Set(rows.map((row) => String(row.branch_id)).filter(Boolean)),
  ];
  const warehouseIds = [
    ...new Set(rows.map((row) => String(row.warehouse_id)).filter(Boolean)),
  ];
  const patternIds = [
    ...new Set(
      rows.map((row) => String(row.invoice_pattern_id)).filter(Boolean),
    ),
  ];

  const [branchesRes, warehousesRes, patternsRes] = await Promise.all([
    branchIds.length
      ? supabase
          .from("branches")
          .select("id, branch_code, name_ar")
          .in("id", branchIds)
      : Promise.resolve({ data: [], error: null }),
    warehouseIds.length
      ? supabase
          .from("warehouses")
          .select("id, warehouse_code, name_ar")
          .in("id", warehouseIds)
      : Promise.resolve({ data: [], error: null }),
    patternIds.length
      ? supabase
          .from("invoice_patterns")
          .select("id, name_ar")
          .in("id", patternIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  throwIfSupabaseError(branchesRes.error);
  throwIfSupabaseError(warehousesRes.error);
  throwIfSupabaseError(patternsRes.error);

  const branchById = new Map(
    ((branchesRes.data ?? []) as { id: string; branch_code: string; name_ar: string }[]).map(
      (row) => [row.id, row],
    ),
  );
  const warehouseById = new Map(
    (
      (warehousesRes.data ?? []) as {
        id: string;
        warehouse_code: string;
        name_ar: string;
      }[]
    ).map((row) => [row.id, row]),
  );
  const patternById = new Map(
    ((patternsRes.data ?? []) as { id: string; name_ar: string }[]).map(
      (row) => [row.id, row],
    ),
  );

  return rows.map((row) => {
    const branch = branchById.get(String(row.branch_id));
    const warehouse = warehouseById.get(String(row.warehouse_id));
    const pattern = patternById.get(String(row.invoice_pattern_id));
    return mapPointRow(row, {
      branch_code: branch?.branch_code,
      branch_name_ar: branch?.name_ar,
      warehouse_code: warehouse?.warehouse_code,
      warehouse_name_ar: warehouse?.name_ar,
      pattern_name_ar: pattern?.name_ar,
    });
  });
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
    let hasDefault = false;
    const { error } = await supabase.from("pos_point_payment_methods").insert(
      payments.map((row, index) => {
        const isDefault = row.is_default && !hasDefault;
        if (isDefault) hasDefault = true;
        return {
          pos_point_id: pointId,
          account_id: row.account_id,
          label_ar: row.label_ar.trim() || "دفعة",
          label_en: row.label_en.trim() || null,
          is_default: isDefault,
          is_active: row.is_active,
          sort_order: index,
        };
      }),
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
      .select(POS_POINT_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("point_code", { ascending: true });

    if (error?.code === "42P01" || error?.code === "PGRST205") return [];
    throwIfSupabaseError(error);
    return enrichPoints((data ?? []) as Record<string, unknown>[]);
  },

  async getPointDetail(id: string): Promise<PosPointDetail | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("pos_points")
      .select(POS_POINT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error?.code === "42P01" || error?.code === "PGRST205") return null;
    throwIfSupabaseError(error);
    if (!data) return null;

    const [point] = await enrichPoints([data as Record<string, unknown>]);

    const [payments, materials, categories] = await Promise.all([
      supabase
        .from("pos_point_payment_methods")
        .select(
          `
          id, pos_point_id, account_id, label_ar, label_en,
          is_default, is_active, sort_order,
          account:accounts!pos_point_payment_methods_account_id_fkey ( account_code, name_ar )
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

    let paymentRows = payments.data as Record<string, unknown>[] | null;
    if (payments.error) {
      // بدون embed إن فشل التلميح
      const plainPay = await supabase
        .from("pos_point_payment_methods")
        .select(
          "id, pos_point_id, account_id, label_ar, label_en, is_default, is_active, sort_order",
        )
        .eq("pos_point_id", id)
        .order("sort_order", { ascending: true });
      throwIfSupabaseError(plainPay.error);
      paymentRows = (plainPay.data ?? []) as Record<string, unknown>[];
    } else {
      throwIfSupabaseError(payments.error);
    }

    throwIfSupabaseError(materials.error);
    throwIfSupabaseError(categories.error);

    const accountIds = [
      ...new Set(
        (paymentRows ?? [])
          .map((row) => String(row.account_id))
          .filter(Boolean),
      ),
    ];
    const accountById = new Map<
      string,
      { account_code?: string; name_ar?: string }
    >();
    if (accountIds.length > 0) {
      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id, account_code, name_ar")
        .in("id", accountIds);
      throwIfSupabaseError(accountsError);
      for (const account of (accounts ?? []) as {
        id: string;
        account_code: string;
        name_ar: string;
      }[]) {
        accountById.set(account.id, account);
      }
    }

    const payment_methods: PosPaymentMethod[] = (paymentRows ?? []).map(
      (row) => {
        const embedded = (row.account ?? row.accounts) as
          | { account_code?: string; name_ar?: string }
          | { account_code?: string; name_ar?: string }[]
          | null
          | undefined;
        const embeddedRow = Array.isArray(embedded) ? embedded[0] : embedded;
        const account =
          embeddedRow ?? accountById.get(String(row.account_id)) ?? undefined;
        return {
          id: String(row.id),
          pos_point_id: String(row.pos_point_id),
          account_id: String(row.account_id),
          label_ar: String(row.label_ar),
          label_en: (row.label_en as string | null) ?? null,
          is_default: Boolean(row.is_default),
          is_active: Boolean(row.is_active),
          sort_order: Number(row.sort_order ?? 0),
          account_code: account?.account_code,
          account_name_ar: account?.name_ar,
        };
      },
    );

    return {
      ...point,
      payment_methods,
      allowed_material_ids: (
        (materials.data ?? []) as { material_id: string }[]
      ).map((row) => row.material_id),
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
