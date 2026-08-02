"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
import type {
  Material,
  MaterialCategory,
  MaterialFormValues,
  MaterialListItem,
  MaterialUnit,
  MaterialUnitFormValues,
} from "@/modules/materials/types";
import { computeFactorToBase } from "@/modules/materials/utils/unit-conversion";
import { parseCompositeMode } from "@/modules/materials/utils/composite-mode";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) throw errorFromSupabase(error);
}

function isMissingTable(error: PostgrestError | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "42703"
  );
}

function isMissingColumn(error: PostgrestError | null, column?: string): boolean {
  if (!error) return false;
  // 42703 = undefined_column, PGRST204 = column missing from PostgREST schema cache
  const isSchemaMiss =
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist/i.test(error.message ?? "") ||
    /Could not find the .+ column/i.test(error.message ?? "");
  if (!isSchemaMiss) return false;
  if (!column) return true;
  return (error.message ?? "").includes(column);
}

/** أعمدة اختيارية قد تكون غير مطبّقة بعد على قاعدة الإنتاج */
const OPTIONAL_MATERIAL_COLUMNS = [
  "composite_mode",
  "material_kind",
  "min_stock",
  "max_stock",
  "barcode",
  "manufacturer",
  "supplier_name",
  "color",
  "size",
  "weight",
  "notes",
  "has_expiry_date",
  "expiry_days",
  "require_expiry_on_inbound",
  "require_expiry_on_outbound",
  "has_serial_number",
  "require_serial_on_inbound",
  "require_serial_on_outbound",
  "purchase_price",
] as const;

/** أعمدة مؤكَّد غيابها في هذه الجلسة — لتجنب إعادة طلبات 400 */
const missingMaterialColumns = new Set<string>();

function rememberMissingMaterialColumns(error: PostgrestError | null): void {
  if (!error) return;
  const fromMessage = error.message?.match(
    /column materials\.(\w+) does not exist/i,
  );
  if (fromMessage?.[1]) {
    missingMaterialColumns.add(fromMessage[1]);
  }
  for (const column of OPTIONAL_MATERIAL_COLUMNS) {
    if (isMissingColumn(error, column)) {
      missingMaterialColumns.add(column);
    }
  }
}

function shouldRetryMaterialSelect(error: PostgrestError | null): boolean {
  if (!error) return false;
  rememberMissingMaterialColumns(error);
  if (isMissingColumn(error)) return true;
  return OPTIONAL_MATERIAL_COLUMNS.some((column) =>
    isMissingColumn(error, column),
  );
}

const MATERIAL_SELECT_CORE =
  "id, material_code, name_ar, name_en, category_id, sale_price, purchase_price, inventory_account_id, is_active";

/** أجزاء اختيارية مستقلة — حتى لا يمنع غياب composite_mode بقية الحقول */
const MATERIAL_OPTIONAL_SELECT_PARTS: { column: string; fragment: string }[] = [
  { column: "material_kind", fragment: "material_kind" },
  { column: "composite_mode", fragment: "composite_mode" },
  { column: "min_stock", fragment: "min_stock" },
  { column: "max_stock", fragment: "max_stock" },
  { column: "barcode", fragment: "barcode" },
  { column: "manufacturer", fragment: "manufacturer" },
  { column: "supplier_name", fragment: "supplier_name" },
  { column: "color", fragment: "color" },
  { column: "size", fragment: "size" },
  { column: "weight", fragment: "weight" },
  { column: "notes", fragment: "notes" },
  { column: "has_expiry_date", fragment: "has_expiry_date" },
  { column: "expiry_days", fragment: "expiry_days" },
  { column: "require_expiry_on_inbound", fragment: "require_expiry_on_inbound" },
  { column: "require_expiry_on_outbound", fragment: "require_expiry_on_outbound" },
  { column: "has_serial_number", fragment: "has_serial_number" },
  { column: "require_serial_on_inbound", fragment: "require_serial_on_inbound" },
  { column: "require_serial_on_outbound", fragment: "require_serial_on_outbound" },
];

function buildMaterialSelect(options?: {
  includeKnownMissing?: boolean;
}): string {
  const includeKnownMissing = options?.includeKnownMissing ?? false;
  const parts = [MATERIAL_SELECT_CORE];
  for (const part of MATERIAL_OPTIONAL_SELECT_PARTS) {
    if (!includeKnownMissing && missingMaterialColumns.has(part.column)) {
      continue;
    }
    parts.push(part.fragment);
  }
  return parts.join(", ");
}

// توافق مع مسارات الحفظ الاحتياطية
const MATERIAL_SELECT_WITH_KIND = `${MATERIAL_SELECT_CORE}, material_kind`;

const UNIT_SELECT_CORE =
  "id, material_id, unit_code, name_ar, name_en, is_base_unit, factor_to_base, is_active, sort_order";

const UNIT_SELECT_WITH_CONVERSION = `${UNIT_SELECT_CORE}, unit_id, conversion_op, conversion_factor`;

const UNIT_SELECT_WITH_PRICES = `${UNIT_SELECT_WITH_CONVERSION}, purchase_price, sale_price, semi_wholesale_price, wholesale_price`;

function mapMaterial(row: Material & { min_stock?: number | null }): Material {
  const mode = row.composite_mode;
  return {
    ...row,
    material_kind: row.material_kind === "composite" ? "composite" : "normal",
    composite_mode: parseCompositeMode(mode, row.material_kind),
    purchase_price: Number(row.purchase_price),
    sale_price: Number(row.sale_price),
    min_stock: Number(row.min_stock ?? 0),
    max_stock: Number(row.max_stock ?? 0),
    barcode: row.barcode ?? null,
    manufacturer: row.manufacturer ?? null,
    supplier_name: row.supplier_name ?? null,
    color: row.color ?? null,
    size: row.size ?? null,
    weight: row.weight == null ? null : Number(row.weight),
    notes: row.notes ?? null,
    has_expiry_date: Boolean(row.has_expiry_date),
    require_expiry_on_inbound: Boolean(row.require_expiry_on_inbound),
    require_expiry_on_outbound: Boolean(row.require_expiry_on_outbound),
    expiry_days:
      row.expiry_days == null || Number.isNaN(Number(row.expiry_days))
        ? null
        : Number(row.expiry_days),
    has_serial_number: Boolean(row.has_serial_number),
    require_serial_on_inbound: Boolean(row.require_serial_on_inbound),
    require_serial_on_outbound: Boolean(row.require_serial_on_outbound),
  };
}

function mapMaterialUnit(row: MaterialUnit): MaterialUnit {
  // معاينة فقط — المرجع عند الحفظ: material_units_sync_conversion (SQL)
  // والصيغة المشتركة: utils/unit-conversion.ts → computeFactorToBase
  const conversionOp = row.conversion_op === "divide" ? "divide" : "multiply";
  const conversionFactor = Number(
    row.conversion_factor ?? (row.is_base_unit ? 1 : row.factor_to_base),
  );
  return {
    ...row,
    unit_id: row.unit_id ?? null,
    conversion_op: conversionOp,
    conversion_factor: conversionFactor,
    factor_to_base: Number(row.factor_to_base),
    purchase_price:
      row.purchase_price == null ? null : Number(row.purchase_price),
    sale_price: row.sale_price == null ? null : Number(row.sale_price),
    semi_wholesale_price:
      row.semi_wholesale_price == null
        ? null
        : Number(row.semi_wholesale_price),
    wholesale_price:
      row.wholesale_price == null ? null : Number(row.wholesale_price),
  };
}

function buildMaterialInsertPayload(
  payload: MaterialFormValues,
): Record<string, unknown> {
  return {
    material_code: payload.material_code.trim().toUpperCase(),
    name_ar: payload.name_ar.trim(),
    name_en: payload.name_en.trim() || null,
    category_id: payload.category_id || null,
    material_kind: payload.material_kind || "normal",
    composite_mode:
      payload.material_kind === "composite"
        ? payload.composite_mode || "kit"
        : null,
    purchase_price: payload.purchase_price,
    sale_price: payload.sale_price,
    inventory_account_id: payload.inventory_account_id || null,
    is_active: payload.is_active,
    min_stock: payload.min_stock,
    max_stock: payload.max_stock,
    barcode: payload.barcode.trim() || null,
    manufacturer: payload.manufacturer.trim() || null,
    supplier_name: payload.supplier_name.trim() || null,
    color: payload.color.trim() || null,
    size: payload.size.trim() || null,
    weight: payload.weight,
    notes: payload.notes.trim() || null,
    has_expiry_date: payload.has_expiry_date,
    require_expiry_on_inbound: payload.require_expiry_on_inbound,
    require_expiry_on_outbound: payload.require_expiry_on_outbound,
    expiry_days: payload.has_expiry_date
      ? payload.expiry_days != null && payload.expiry_days > 0
        ? payload.expiry_days
        : null
      : null,
    has_serial_number: payload.has_serial_number,
    require_serial_on_inbound: payload.require_serial_on_inbound,
    require_serial_on_outbound: payload.require_serial_on_outbound,
  };
}

function stripTrackingMaterialFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  delete next.has_expiry_date;
  delete next.expiry_days;
  delete next.require_expiry_on_inbound;
  delete next.require_expiry_on_outbound;
  delete next.has_serial_number;
  delete next.require_serial_on_inbound;
  delete next.require_serial_on_outbound;
  return next;
}

function stripMaterialKindField(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  delete next.material_kind;
  delete next.composite_mode;
  return next;
}

function stripCompositeModeField(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  delete next.composite_mode;
  return next;
}

function stripExtendedMaterialFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  delete next.max_stock;
  delete next.barcode;
  delete next.manufacturer;
  delete next.supplier_name;
  delete next.color;
  delete next.size;
  delete next.weight;
  delete next.notes;
  return next;
}

function stripMinStockField(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  delete next.min_stock;
  return next;
}

function buildMaterialPatch(
  payload: Partial<MaterialFormValues>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.material_code != null) {
    patch.material_code = payload.material_code.trim().toUpperCase();
  }
  if (payload.name_ar != null) patch.name_ar = payload.name_ar.trim();
  if (payload.name_en != null) patch.name_en = payload.name_en.trim() || null;
  if (payload.category_id != null) patch.category_id = payload.category_id || null;
  if (payload.material_kind != null) patch.material_kind = payload.material_kind;
  if (payload.composite_mode !== undefined) {
    patch.composite_mode =
      payload.material_kind === "normal"
        ? null
        : payload.composite_mode ??
          (payload.material_kind === "composite" ? "kit" : null);
  }
  if (payload.material_kind === "normal") {
    patch.composite_mode = null;
  }
  if (payload.material_kind === "composite" && patch.composite_mode == null) {
    patch.composite_mode = payload.composite_mode || "kit";
  }
  if (payload.purchase_price != null) patch.purchase_price = payload.purchase_price;
  if (payload.sale_price != null) patch.sale_price = payload.sale_price;
  if (payload.inventory_account_id != null) {
    patch.inventory_account_id = payload.inventory_account_id || null;
  }
  if (payload.is_active != null) patch.is_active = payload.is_active;
  if (payload.min_stock != null) patch.min_stock = payload.min_stock;
  if (payload.max_stock != null) patch.max_stock = payload.max_stock;
  if (payload.barcode != null) patch.barcode = payload.barcode.trim() || null;
  if (payload.manufacturer != null) {
    patch.manufacturer = payload.manufacturer.trim() || null;
  }
  if (payload.supplier_name != null) {
    patch.supplier_name = payload.supplier_name.trim() || null;
  }
  if (payload.color != null) patch.color = payload.color.trim() || null;
  if (payload.size != null) patch.size = payload.size.trim() || null;
  if (payload.weight !== undefined) patch.weight = payload.weight;
  if (payload.notes != null) patch.notes = payload.notes.trim() || null;
  if (payload.has_expiry_date != null) {
    patch.has_expiry_date = payload.has_expiry_date;
    if (!payload.has_expiry_date) {
      patch.require_expiry_on_inbound = false;
      patch.require_expiry_on_outbound = false;
      patch.expiry_days = null;
    }
  }
  if (payload.require_expiry_on_inbound != null) {
    patch.require_expiry_on_inbound = payload.require_expiry_on_inbound;
  }
  if (payload.require_expiry_on_outbound != null) {
    patch.require_expiry_on_outbound = payload.require_expiry_on_outbound;
  }
  if (payload.expiry_days !== undefined) {
    patch.expiry_days =
      payload.has_expiry_date === false
        ? null
        : payload.expiry_days != null && payload.expiry_days > 0
          ? payload.expiry_days
          : null;
  }
  if (payload.has_serial_number != null) {
    patch.has_serial_number = payload.has_serial_number;
  }
  if (payload.require_serial_on_inbound != null) {
    patch.require_serial_on_inbound = payload.require_serial_on_inbound;
  }
  if (payload.require_serial_on_outbound != null) {
    patch.require_serial_on_outbound = payload.require_serial_on_outbound;
  }

  return patch;
}

function buildUnitInsertPayload(
  materialId: string,
  payload: MaterialUnitFormValues,
): Record<string, unknown> {
  const conversionOp = payload.is_base_unit
    ? "multiply"
    : payload.conversion_op || "multiply";
  const conversionFactor = payload.is_base_unit
    ? 1
    : payload.conversion_factor || payload.factor_to_base || 1;
  return {
    material_id: materialId,
    unit_id: payload.unit_id || null,
    unit_code: payload.unit_code.trim().toUpperCase(),
    name_ar: payload.name_ar.trim(),
    name_en: payload.name_en.trim() || null,
    is_base_unit: payload.is_base_unit,
    conversion_op: conversionOp,
    conversion_factor: conversionFactor,
    // معاينة فقط — التريغر SQL يعيد الحساب بنفس الصيغة (computeFactorToBase)
    factor_to_base: computeFactorToBase(
      payload.is_base_unit,
      conversionOp,
      conversionFactor,
    ),
    is_active: payload.is_active,
    purchase_price: payload.purchase_price,
    sale_price: payload.sale_price,
    semi_wholesale_price: payload.semi_wholesale_price,
    wholesale_price: payload.wholesale_price,
  };
}

function stripUnitPriceFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  delete next.purchase_price;
  delete next.sale_price;
  delete next.semi_wholesale_price;
  delete next.wholesale_price;
  return next;
}

function stripUnitConversionFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  delete next.unit_id;
  delete next.conversion_op;
  delete next.conversion_factor;
  return next;
}

function buildUnitPatch(
  payload: Partial<MaterialUnitFormValues>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.unit_id !== undefined) patch.unit_id = payload.unit_id || null;
  if (payload.unit_code != null) {
    patch.unit_code = payload.unit_code.trim().toUpperCase();
  }
  if (payload.name_ar != null) patch.name_ar = payload.name_ar.trim();
  if (payload.name_en != null) patch.name_en = payload.name_en.trim() || null;
  if (payload.is_active != null) patch.is_active = payload.is_active;
  if (payload.conversion_op != null && !payload.is_base_unit) {
    patch.conversion_op = payload.conversion_op;
  }
  if (payload.conversion_factor != null && !payload.is_base_unit) {
    patch.conversion_factor = payload.conversion_factor;
  }
  if (
    !payload.is_base_unit &&
    (payload.conversion_op != null || payload.conversion_factor != null)
  ) {
    const op =
      payload.conversion_op === "divide" ? "divide" : "multiply";
    const factor =
      payload.conversion_factor ?? payload.factor_to_base ?? 1;
    patch.factor_to_base = computeFactorToBase(false, op, factor);
  } else if (payload.factor_to_base != null && !payload.is_base_unit) {
    patch.factor_to_base = payload.factor_to_base;
  }
  if (payload.is_base_unit) {
    patch.conversion_op = "multiply";
    patch.conversion_factor = 1;
    patch.factor_to_base = 1;
  }
  if (payload.purchase_price !== undefined) {
    patch.purchase_price = payload.purchase_price;
  }
  if (payload.sale_price !== undefined) patch.sale_price = payload.sale_price;
  if (payload.semi_wholesale_price !== undefined) {
    patch.semi_wholesale_price = payload.semi_wholesale_price;
  }
  if (payload.wholesale_price !== undefined) {
    patch.wholesale_price = payload.wholesale_price;
  }

  return patch;
}

async function selectMaterialById(
  id: string,
  select: string,
): Promise<{ row: Record<string, unknown> | null; error: PostgrestError | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("materials")
    .select(select)
    .eq("id", id)
    .maybeSingle();
  return { row: data as Record<string, unknown> | null, error };
}

async function mutateMaterialRow(
  operation: "insert" | "update",
  payload: Record<string, unknown>,
  id?: string,
): Promise<Material> {
  const supabase = getSupabaseClient();
  const attempts: { select: string; payload: Record<string, unknown> }[] = [
    { select: buildMaterialSelect({ includeKnownMissing: true }), payload },
    {
      select: buildMaterialSelect(),
      payload: missingMaterialColumns.has("composite_mode")
        ? stripCompositeModeField(payload)
        : payload,
    },
    {
      select: MATERIAL_SELECT_WITH_KIND,
      payload: stripMinStockField(
        stripExtendedMaterialFields(
          stripTrackingMaterialFields(stripCompositeModeField(payload)),
        ),
      ),
    },
    {
      select: MATERIAL_SELECT_CORE,
      payload: stripMaterialKindField(
        stripMinStockField(
          stripExtendedMaterialFields(
            stripTrackingMaterialFields(stripCompositeModeField(payload)),
          ),
        ),
      ),
    },
  ];

  let lastError: PostgrestError | null = null;
  for (const attempt of attempts) {
    const result =
      operation === "insert"
        ? await supabase
            .from("materials")
            .insert(attempt.payload)
            .select(attempt.select)
            .single()
        : await supabase
            .from("materials")
            .update(attempt.payload)
            .eq("id", id!)
            .select(attempt.select)
            .single();

    if (!result.error) {
      return mapMaterial(result.data as unknown as Material);
    }

    lastError = result.error;
    if (!shouldRetryMaterialSelect(result.error)) {
      break;
    }
  }

  throwIfSupabaseError(lastError);
  throw new Error("فشل حفظ المادة.");
}

async function mutateUnitRow(
  operation: "insert" | "update",
  payload: Record<string, unknown>,
  unitId?: string,
): Promise<MaterialUnit> {
  const supabase = getSupabaseClient();
  const attempts = [
    { select: UNIT_SELECT_WITH_PRICES, payload },
    {
      select: UNIT_SELECT_WITH_CONVERSION,
      payload: stripUnitPriceFields(payload),
    },
    {
      select: UNIT_SELECT_CORE,
      payload: stripUnitConversionFields(stripUnitPriceFields(payload)),
    },
  ];

  let lastError: PostgrestError | null = null;
  for (const attempt of attempts) {
    const result =
      operation === "insert"
        ? await supabase
            .from("material_units")
            .insert(attempt.payload)
            .select(attempt.select)
            .single()
        : await supabase
            .from("material_units")
            .update(attempt.payload)
            .eq("id", unitId!)
            .select(attempt.select)
            .single();

    if (!result.error) {
      return mapMaterialUnit(result.data as unknown as MaterialUnit);
    }

    lastError = result.error;
    if (!isMissingColumn(result.error, "purchase_price")) break;
  }

  throwIfSupabaseError(lastError);
  throw new Error("فشل حفظ وحدة المادة.");
}

export const materialApi = {
  async listMaterials(): Promise<MaterialListItem[]> {
    const supabase = getSupabaseClient();
    const withRels = (select: string) =>
      `${select}, material_categories ( category_code, name_ar ), material_units ( id, is_base_unit )`;

    let rows: Record<string, unknown>[] | null = null;
    let error: PostgrestError | null = null;
    let previousSelect: string | null = null;

    for (let i = 0; i < 6; i++) {
      const base =
        i === 0
          ? buildMaterialSelect({ includeKnownMissing: true })
          : buildMaterialSelect();
      const select = withRels(base);
      if (select === previousSelect) break;
      previousSelect = select;

      const result = await supabase
        .from("materials")
        .select(select)
        .order("material_code", { ascending: true });
      if (!result.error) {
        rows = result.data as unknown as Record<string, unknown>[];
        error = null;
        break;
      }
      error = result.error;
      if (!shouldRetryMaterialSelect(result.error)) {
        break;
      }
    }

    if (error && shouldRetryMaterialSelect(error)) {
      for (const select of [
        withRels(MATERIAL_SELECT_CORE),
        `${MATERIAL_SELECT_CORE}, material_categories ( category_code, name_ar )`,
      ]) {
        const result = await supabase
          .from("materials")
          .select(select)
          .order("material_code", { ascending: true });
        if (!result.error) {
          rows = result.data as unknown as Record<string, unknown>[];
          error = null;
          break;
        }
        error = result.error;
        if (!shouldRetryMaterialSelect(result.error)) break;
      }
    }

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);

    return (rows ?? []).map((row) => {
      const category = row.material_categories as
        | { category_code: string; name_ar: string }
        | { category_code: string; name_ar: string }[]
        | null;
      const categoryRow = Array.isArray(category) ? category[0] : category;
      const units = row.material_units as
        | { id: string; is_base_unit: boolean }[]
        | null
        | undefined;
      const material = mapMaterial(row as unknown as Material);
      const hasBaseUnit =
        units == null
          ? undefined
          : units.some((unit) => unit.is_base_unit);
      return {
        ...material,
        category_code: categoryRow?.category_code ?? null,
        category_name_ar: categoryRow?.name_ar ?? null,
        has_base_unit: hasBaseUnit,
      };
    });
  },

  async listMaterialCategories(): Promise<MaterialCategory[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("material_categories")
      .select("id, category_code, name_ar, name_en, parent_id, is_active")
      .order("category_code", { ascending: true });

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);
    return (data ?? []) as MaterialCategory[];
  },

  async getMaterialById(id: string): Promise<Material | null> {
    let row: Record<string, unknown> | null = null;
    let error: PostgrestError | null = null;
    let previousSelect: string | null = null;

    for (let i = 0; i < 6; i++) {
      const select =
        i === 0
          ? buildMaterialSelect({ includeKnownMissing: true })
          : buildMaterialSelect();
      if (select === previousSelect) break;
      previousSelect = select;

      const result = await selectMaterialById(id, select);
      if (!result.error) {
        row = result.row;
        error = null;
        break;
      }
      error = result.error;
      if (!shouldRetryMaterialSelect(result.error)) {
        break;
      }
    }

    if (error && shouldRetryMaterialSelect(error)) {
      const result = await selectMaterialById(id, MATERIAL_SELECT_CORE);
      if (!result.error) {
        row = result.row;
        error = null;
      } else {
        error = result.error;
      }
    }

    if (isMissingTable(error)) return null;
    throwIfSupabaseError(error);
    return row ? mapMaterial(row as unknown as Material) : null;
  },

  async createMaterial(
    payload: MaterialFormValues,
    baseUnit: MaterialUnitFormValues,
  ): Promise<Material> {
    const supabase = getSupabaseClient();
    const materialPayload = buildMaterialInsertPayload(payload);
    const unitPayload = {
      unit_id: baseUnit.unit_id || null,
      unit_code: baseUnit.unit_code,
      name_ar: baseUnit.name_ar,
      name_en: baseUnit.name_en,
      is_active: baseUnit.is_active,
      purchase_price: baseUnit.purchase_price ?? payload.purchase_price,
      sale_price: baseUnit.sale_price ?? payload.sale_price,
      semi_wholesale_price: baseUnit.semi_wholesale_price,
      wholesale_price: baseUnit.wholesale_price,
    };

    const { data: rpcId, error: rpcError } = await supabase.rpc(
      "create_material_with_base_unit",
      {
        p_material: materialPayload,
        p_base_unit: unitPayload,
      },
    );

    if (!rpcError && rpcId) {
      const created = await this.getMaterialById(String(rpcId));
      if (created) return created;
    }

    if (rpcError && !isMissingTable(rpcError)) {
      // دالة موجودة لكن فشل التحقق — لا نسقط إلى المسار غير الذرّي
      if (rpcError.code !== "PGRST202" && rpcError.code !== "42883") {
        throwIfSupabaseError(rpcError);
      }
    }

    // مسار احتياطي لقواعد قديمة بدون الـ RPC
    const material = await mutateMaterialRow("insert", materialPayload);
    try {
      await this.createMaterialUnit(material.id, {
        ...baseUnit,
        is_base_unit: true,
        factor_to_base: 1,
        purchase_price: baseUnit.purchase_price ?? payload.purchase_price,
        sale_price: baseUnit.sale_price ?? payload.sale_price,
      });
    } catch (unitError) {
      await supabase.from("materials").delete().eq("id", material.id);
      throw unitError;
    }
    return material;
  },

  async updateMaterial(id: string, payload: Partial<MaterialFormValues>): Promise<Material> {
    const patch = buildMaterialPatch(payload);
    return mutateMaterialRow("update", patch, id);
  },

  async listMaterialUnits(materialId: string): Promise<MaterialUnit[]> {
    const supabase = getSupabaseClient();
    const attempts = [
      UNIT_SELECT_WITH_PRICES,
      UNIT_SELECT_WITH_CONVERSION,
      UNIT_SELECT_CORE,
    ];

    let rows: MaterialUnit[] | null = null;
    let error: PostgrestError | null = null;

    for (const select of attempts) {
      const result = await supabase
        .from("material_units")
        .select(select)
        .eq("material_id", materialId)
        .order("is_base_unit", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("unit_code", { ascending: true });

      if (!result.error) {
        rows = result.data as unknown as MaterialUnit[];
        error = null;
        break;
      }
      error = result.error;
      if (
        !isMissingColumn(result.error, "purchase_price") &&
        !isMissingColumn(result.error, "conversion_op") &&
        !isMissingColumn(result.error, "unit_id")
      ) {
        break;
      }
    }

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);
    return (rows ?? []).map(mapMaterialUnit);
  },

  async createMaterialUnit(
    materialId: string,
    payload: MaterialUnitFormValues,
  ): Promise<MaterialUnit> {
    const insertPayload = buildUnitInsertPayload(materialId, payload);
    return mutateUnitRow("insert", insertPayload);
  },

  async updateMaterialUnit(
    unitId: string,
    payload: Partial<MaterialUnitFormValues>,
  ): Promise<MaterialUnit> {
    const patch = buildUnitPatch(payload);
    return mutateUnitRow("update", patch, unitId);
  },

  async suggestNextMaterialCode(categoryId?: string | null): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("suggest_next_material_code", {
      p_category_id: categoryId || null,
    });
    if (!error && data) return String(data);

    const prefix = "MAT";
    const { data: rows } = await supabase
      .from("materials")
      .select("material_code")
      .ilike("material_code", `${prefix}%`)
      .order("material_code", { ascending: false })
      .limit(1);
    const last = rows?.[0]?.material_code as string | undefined;
    const match = last?.match(/(\d+)$/);
    const next = (match ? Number(match[1]) : 0) + 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  },

  /** مواد بلا وحدة أساس — RPC صيانة (تدقيق #9) */
  async listMaterialIdsMissingBaseUnit(): Promise<string[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(
      "list_material_ids_missing_base_unit",
    );
    if (error) {
      if (isMissingTable(error) || error.code === "PGRST202") return [];
      throwIfSupabaseError(error);
      return [];
    }
    return ((data ?? []) as { material_id: string }[]).map(
      (row) => row.material_id,
    );
  },
};
