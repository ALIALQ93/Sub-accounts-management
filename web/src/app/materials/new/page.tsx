"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialForm } from "@/modules/materials/components/material-form";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { materialBomApi } from "@/modules/materials/services/material-bom-api";
import { materialApi } from "@/modules/materials/services/material-api";
import { unitApi } from "@/modules/materials/services/unit-api";
import type {
  MaterialBomFormValues,
  MaterialCategory,
  MaterialFormValues,
  MaterialListItem,
  MaterialUnitFormValues,
  UnitCatalogItem,
} from "@/modules/materials/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

const EMPTY_VALUES: MaterialFormValues = {
  material_code: "",
  name_ar: "",
  name_en: "",
  category_id: "",
  material_kind: "normal",
  purchase_price: 0,
  sale_price: 0,
  inventory_account_id: "",
  min_stock: 0,
  max_stock: 0,
  barcode: "",
  manufacturer: "",
  supplier_name: "",
  color: "",
  size: "",
  weight: null,
  notes: "",
  has_expiry_date: false,
  require_expiry_on_inbound: false,
  require_expiry_on_outbound: false,
  has_serial_number: false,
  require_serial_on_inbound: false,
  require_serial_on_outbound: false,
  is_active: true,
};

export default function NewMaterialPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("materials.create");
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
      materialApi.listMaterialCategories(),
      unitApi.listUnits().catch(() => [] as UnitCatalogItem[]),
      materialApi.listMaterials(),
      voucherApi.listAllAccounts(),
    ])
      .then(([categoriesData, unitsData, materialsData, accountsData]) => {
        if (!cancelled) {
          setCategories(categoriesData);
          setCatalogUnits(unitsData);
          setNormalMaterials(materialsData);
          setAccounts(accountsData);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل البيانات.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (
    values: MaterialFormValues,
    units: MaterialUnitFormValues[],
    bom: MaterialBomFormValues[],
  ) => {
    if (!canEdit) return;
    const baseUnit = units.find((unit) => unit.is_base_unit);
    if (!baseUnit) {
      setError("وحدة الأساس مطلوبة.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const material = await materialApi.createMaterial(values, baseUnit);
      for (const unit of units.filter((row) => !row.is_base_unit)) {
        await materialApi.createMaterialUnit(material.id, unit);
      }
      if (values.material_kind === "composite") {
        await materialBomApi.replaceComponents(material.id, bom);
      }
      router.push(`/materials/${material.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء المادة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">مادة جديدة</h1>
      <MaterialsNav />

      {isLoading && (
        <p className="mt-4 text-sm text-slate-600">جاري التحميل...</p>
      )}
      {!isLoading && (
        <div className="mt-4">
          <MaterialForm
            mode="create"
            initialValues={EMPTY_VALUES}
            initialUnits={[]}
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
    </main>
  );
}
