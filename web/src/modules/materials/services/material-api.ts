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

function isMissingColumn(error: PostgrestError | null, column: string): boolean {
  return error?.code === "42703" && (error.message ?? "").includes(column);
}

const MATERIAL_SELECT_CORE =
  "id, material_code, name_ar, name_en, category_id, sale_price, purchase_price, inventory_account_id, is_active";

const MATERIAL_SELECT_WITH_MIN = `${MATERIAL_SELECT_CORE}, min_stock`;

const MATERIAL_SELECT_EXTENDED = `${MATERIAL_SELECT_WITH_MIN}, max_stock, barcode, manufacturer, supplier_name, color, size, weight, notes`;

const MATERIAL_SELECT_TRACKING = `${MATERIAL_SELECT_EXTENDED}, has_expiry_date, expiry_days, require_expiry_on_inbound, require_expiry_on_outbound, has_serial_number, require_serial_on_inbound, require_serial_on_outbound`;

const UNIT_SELECT_CORE =
  "id, material_id, unit_code, name_ar, name_en, is_base_unit, factor_to_base, is_active, sort_order";

const UNIT_SELECT_WITH_PRICES = `${UNIT_SELECT_CORE}, purchase_price, sale_price, semi_wholesale_price, wholesale_price`;

function mapMaterial(row: Material & { min_stock?: number | null }): Material {
  return {
    ...row,
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
    expiry_days: row.expiry_days == null ? null : Number(row.expiry_days),
    require_expiry_on_inbound: Boolean(row.require_expiry_on_inbound),
    require_expiry_on_outbound: Boolean(row.require_expiry_on_outbound),
    has_serial_number: Boolean(row.has_serial_number),
    require_serial_on_inbound: Boolean(row.require_serial_on_inbound),
    require_serial_on_outbound: Boolean(row.require_serial_on_outbound),
  };
}

function mapMaterialUnit(row: MaterialUnit): MaterialUnit {
  return {
    ...row,
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
    expiry_days: payload.has_expiry_date ? payload.expiry_days : null,
    require_expiry_on_inbound: payload.require_expiry_on_inbound,
    require_expiry_on_outbound: payload.require_expiry_on_outbound,
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
    patch.expiry_days = payload.has_expiry_date ? payload.expiry_days : null;
  } else if (payload.expiry_days !== undefined) {
    patch.expiry_days = payload.expiry_days;
  }
  if (payload.require_expiry_on_inbound != null) {
    patch.require_expiry_on_inbound = payload.require_expiry_on_inbound;
  }
  if (payload.require_expiry_on_outbound != null) {
    patch.require_expiry_on_outbound = payload.require_expiry_on_outbound;
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
  return {
    material_id: materialId,
    unit_code: payload.unit_code.trim().toUpperCase(),
    name_ar: payload.name_ar.trim(),
    name_en: payload.name_en.trim() || null,
    is_base_unit: payload.is_base_unit,
    factor_to_base: payload.is_base_unit ? 1 : payload.factor_to_base,
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

function buildUnitPatch(
  payload: Partial<MaterialUnitFormValues>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.unit_code != null) {
    patch.unit_code = payload.unit_code.trim().toUpperCase();
  }
  if (payload.name_ar != null) patch.name_ar = payload.name_ar.trim();
  if (payload.name_en != null) patch.name_en = payload.name_en.trim() || null;
  if (payload.is_active != null) patch.is_active = payload.is_active;
  if (payload.factor_to_base != null && !payload.is_base_unit) {
    patch.factor_to_base = payload.factor_to_base;
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
    { select: MATERIAL_SELECT_TRACKING, payload },
    {
      select: MATERIAL_SELECT_EXTENDED,
      payload: stripTrackingMaterialFields(payload),
    },
    { select: MATERIAL_SELECT_WITH_MIN, payload: stripExtendedMaterialFields(stripTrackingMaterialFields(payload)) },
    { select: MATERIAL_SELECT_CORE, payload: stripMinStockField(stripExtendedMaterialFields(stripTrackingMaterialFields(payload))) },
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
    if (
      !isMissingColumn(result.error, "min_stock") &&
      !isMissingColumn(result.error, "max_stock") &&
      !isMissingColumn(result.error, "barcode") &&
      !isMissingColumn(result.error, "purchase_price")
    ) {
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
    { select: UNIT_SELECT_CORE, payload: stripUnitPriceFields(payload) },
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
    const attempts = [
      `${MATERIAL_SELECT_TRACKING}, material_categories ( category_code, name_ar )`,
      `${MATERIAL_SELECT_EXTENDED}, material_categories ( category_code, name_ar )`,
      `${MATERIAL_SELECT_WITH_MIN}, material_categories ( category_code, name_ar )`,
      `${MATERIAL_SELECT_CORE}, material_categories ( category_code, name_ar )`,
    ];

    let rows: Record<string, unknown>[] | null = null;
    let error: PostgrestError | null = null;

    for (const select of attempts) {
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
      if (
        !isMissingColumn(result.error, "min_stock") &&
        !isMissingColumn(result.error, "max_stock") &&
      !isMissingColumn(result.error, "barcode") &&
      !isMissingColumn(result.error, "has_expiry_date")
    ) {
        break;
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
      const material = mapMaterial(row as unknown as Material);
      return {
        ...material,
        category_code: categoryRow?.category_code ?? null,
        category_name_ar: categoryRow?.name_ar ?? null,
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
    const attempts = [
      MATERIAL_SELECT_TRACKING,
      MATERIAL_SELECT_EXTENDED,
      MATERIAL_SELECT_WITH_MIN,
      MATERIAL_SELECT_CORE,
    ];

    let row: Record<string, unknown> | null = null;
    let error: PostgrestError | null = null;

    for (const select of attempts) {
      const result = await selectMaterialById(id, select);
      if (!result.error) {
        row = result.row;
        error = null;
        break;
      }
      error = result.error;
      if (
        !isMissingColumn(result.error, "min_stock") &&
        !isMissingColumn(result.error, "max_stock") &&
      !isMissingColumn(result.error, "barcode") &&
      !isMissingColumn(result.error, "has_expiry_date")
    ) {
        break;
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
    const insertPayload = buildMaterialInsertPayload(payload);
    const material = await mutateMaterialRow("insert", insertPayload);

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
    const attempts = [UNIT_SELECT_WITH_PRICES, UNIT_SELECT_CORE];

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
      if (!isMissingColumn(result.error, "purchase_price")) break;
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
};
