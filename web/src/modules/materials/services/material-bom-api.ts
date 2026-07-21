"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { errorFromSupabase } from "@/lib/supabase/format-db-error";
import type {
  MaterialBomComponent,
  MaterialBomFormValues,
} from "@/modules/materials/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) throw errorFromSupabase(error);
}

type BomRow = MaterialBomComponent & {
  component?: {
    material_code?: string;
    name_ar?: string;
  } | null;
  unit?: {
    unit_code?: string;
    name_ar?: string;
  } | null;
};

function mapBom(row: BomRow): MaterialBomComponent {
  return {
    id: row.id,
    parent_material_id: row.parent_material_id,
    component_material_id: row.component_material_id,
    quantity: Number(row.quantity),
    component_unit_id: row.component_unit_id,
    quantity_base: Number(row.quantity_base),
    sort_order: Number(row.sort_order ?? 0),
    notes: row.notes ?? null,
    component_code: row.component?.material_code,
    component_name_ar: row.component?.name_ar,
    unit_code: row.unit?.unit_code ?? null,
    unit_name_ar: row.unit?.name_ar ?? null,
  };
}

export const materialBomApi = {
  async listComponents(parentMaterialId: string): Promise<MaterialBomComponent[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("material_bom_components")
      .select(
        `
        id, parent_material_id, component_material_id, quantity,
        component_unit_id, quantity_base, sort_order, notes,
        component:materials!material_bom_components_component_material_id_fkey (
          material_code, name_ar
        ),
        unit:material_units!material_bom_components_component_unit_id_fkey (
          unit_code, name_ar
        )
      `,
      )
      .eq("parent_material_id", parentMaterialId)
      .order("sort_order", { ascending: true });

    if (error) {
      // fallback without embeds if FK names differ
      const plain = await supabase
        .from("material_bom_components")
        .select(
          "id, parent_material_id, component_material_id, quantity, component_unit_id, quantity_base, sort_order, notes",
        )
        .eq("parent_material_id", parentMaterialId)
        .order("sort_order", { ascending: true });
      throwIfSupabaseError(plain.error);
      return ((plain.data ?? []) as BomRow[]).map(mapBom);
    }

    return ((data ?? []) as unknown as BomRow[]).map(mapBom);
  },

  async replaceComponents(
    parentMaterialId: string,
    rows: MaterialBomFormValues[],
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error: delError } = await supabase
      .from("material_bom_components")
      .delete()
      .eq("parent_material_id", parentMaterialId);
    throwIfSupabaseError(delError);

    if (rows.length === 0) return;

    const payload = rows.map((row, index) => ({
      parent_material_id: parentMaterialId,
      component_material_id: row.component_material_id,
      quantity: row.quantity,
      component_unit_id: row.component_unit_id || null,
      quantity_base: row.quantity,
      sort_order: index,
      notes: row.notes.trim() || null,
    }));

    const { error } = await supabase.from("material_bom_components").insert(payload);
    throwIfSupabaseError(error);
  },
};
