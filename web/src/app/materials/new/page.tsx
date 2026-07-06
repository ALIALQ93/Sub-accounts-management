"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialForm } from "@/modules/materials/components/material-form";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { materialApi } from "@/modules/materials/services/material-api";
import type { MaterialCategory, MaterialFormValues, MaterialUnitFormValues } from "@/modules/materials/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

const EMPTY_VALUES: MaterialFormValues = {
  material_code: "",
  name_ar: "",
  name_en: "",
  category_id: "",
  purchase_price: 0,
  sale_price: 0,
  inventory_account_id: "",
  is_active: true,
};

export default function NewMaterialPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("materials.create");
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      materialApi.listMaterialCategories(),
      voucherApi.listAllAccounts(),
    ])
      .then(([categoriesData, accountsData]) => {
        if (!cancelled) {
          setCategories(categoriesData);
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
      router.push(`/materials/${material.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء المادة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl">
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
