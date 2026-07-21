"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialForm } from "@/modules/materials/components/material-form";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { materialBomApi } from "@/modules/materials/services/material-bom-api";
import { materialApi } from "@/modules/materials/services/material-api";
import { unitApi } from "@/modules/materials/services/unit-api";
import type {
  Material,
  MaterialBomFormValues,
  MaterialCategory,
  MaterialFormValues,
  MaterialListItem,
  MaterialUnit,
  MaterialUnitFormValues,
  UnitCatalogItem,
} from "@/modules/materials/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

function toFormValues(material: Material): MaterialFormValues {
  return {
    material_code: material.material_code,
    name_ar: material.name_ar,
    name_en: material.name_en ?? "",
    category_id: material.category_id ?? "",
    material_kind: material.material_kind ?? "normal",
    purchase_price: material.purchase_price,
    sale_price: material.sale_price,
    inventory_account_id: material.inventory_account_id ?? "",
    min_stock: material.min_stock,
    max_stock: material.max_stock,
    barcode: material.barcode ?? "",
    manufacturer: material.manufacturer ?? "",
    supplier_name: material.supplier_name ?? "",
    color: material.color ?? "",
    size: material.size ?? "",
    weight: material.weight,
    notes: material.notes ?? "",
    has_expiry_date: material.has_expiry_date,
    require_expiry_on_inbound: material.require_expiry_on_inbound,
    require_expiry_on_outbound: material.require_expiry_on_outbound,
    has_serial_number: material.has_serial_number,
    require_serial_on_inbound: material.require_serial_on_inbound,
    require_serial_on_outbound: material.require_serial_on_outbound,
    is_active: material.is_active,
  };
}

export default function EditMaterialPage() {
  const params = useParams<{ id: string }>();
  const materialId = params.id;
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("materials.edit");
  const [material, setMaterial] = useState<Material | null>(null);
  const [units, setUnits] = useState<MaterialUnit[]>([]);
  const [bomRows, setBomRows] = useState<MaterialBomFormValues[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [catalogUnits, setCatalogUnits] = useState<UnitCatalogItem[]>([]);
  const [normalMaterials, setNormalMaterials] = useState<MaterialListItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      materialApi.getMaterialById(materialId),
      materialApi.listMaterialUnits(materialId),
      materialBomApi.listComponents(materialId).catch(() => []),
      materialApi.listMaterialCategories(),
      unitApi.listUnits().catch(() => [] as UnitCatalogItem[]),
      materialApi.listMaterials(),
      voucherApi.listAllAccounts(),
    ])
      .then(
        ([
          materialData,
          unitsData,
          bomData,
          categoriesData,
          unitsCatalog,
          materialsData,
          accountsData,
        ]) => {
          if (!cancelled) {
            setMaterial(materialData);
            setUnits(unitsData);
            setBomRows(
              bomData.map((row) => ({
                id: row.id,
                component_material_id: row.component_material_id,
                quantity: row.quantity,
                component_unit_id: row.component_unit_id ?? "",
                notes: row.notes ?? "",
              })),
            );
            setCategories(categoriesData);
            setCatalogUnits(unitsCatalog);
            setNormalMaterials(materialsData);
            setAccounts(accountsData);
            if (!materialData) {
              setError("المادة غير موجودة.");
            }
          }
        },
      )
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل المادة.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const onSubmit = async (
    values: MaterialFormValues,
    unitDrafts: MaterialUnitFormValues[],
    bom: MaterialBomFormValues[],
  ) => {
    if (!canEdit || !material) return;

    setIsSaving(true);
    setError("");
    try {
      if (values.material_kind === "normal") {
        await materialBomApi.replaceComponents(material.id, []);
      }

      await materialApi.updateMaterial(material.id, values);

      for (const draft of unitDrafts) {
        if (draft.id) {
          await materialApi.updateMaterialUnit(draft.id, draft);
        } else if (!draft.is_base_unit) {
          await materialApi.createMaterialUnit(material.id, draft);
        }
      }

      if (values.material_kind === "composite") {
        // يجب أن يكون النوع تجميعي قبل إدراج المكوّنات
        await materialBomApi.replaceComponents(material.id, bom);
      }

      const [updatedMaterial, updatedUnits, updatedBom] = await Promise.all([
        materialApi.getMaterialById(material.id),
        materialApi.listMaterialUnits(material.id),
        materialBomApi.listComponents(material.id).catch(() => []),
      ]);
      setMaterial(updatedMaterial);
      setUnits(updatedUnits);
      setBomRows(
        updatedBom.map((row) => ({
          id: row.id,
          component_material_id: row.component_material_id,
          quantity: row.quantity,
          component_unit_id: row.component_unit_id ?? "",
          notes: row.notes ?? "",
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ المادة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">بطاقة مادة</h1>
      {material && (
        <p className="mb-4 font-mono text-sm text-slate-500">
          {material.material_code} — {material.name_ar}
          {material.material_kind === "composite" ? " (تجميعية)" : ""}
        </p>
      )}
      <MaterialsNav />

      {isLoading && (
        <p className="mt-4 text-sm text-slate-600">جاري التحميل...</p>
      )}
      {!isLoading && material && (
        <div className="mt-4">
          <MaterialForm
            mode="edit"
            materialId={material.id}
            initialValues={toFormValues(material)}
            initialUnits={units}
            initialBom={bomRows}
            categories={categories}
            catalogUnits={catalogUnits}
            normalMaterials={normalMaterials}
            accounts={accounts}
            canEdit={canEdit}
            isSaving={isSaving}
            error={error}
            onSubmit={onSubmit}
          />
        </div>
      )}
      {!isLoading && !material && error && (
        <p className="mt-4 text-sm text-rose-700">{error}</p>
      )}
    </main>
  );
}
