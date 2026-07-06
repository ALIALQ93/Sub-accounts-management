"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import type { MaterialCategory } from "@/modules/materials/types";
import type {
  MaterialFormValues,
  MaterialUnit,
  MaterialUnitFormValues,
} from "@/modules/materials/types";
import type { Account } from "@/modules/vouchers/types";

interface MaterialFormProps {
  mode: "create" | "edit";
  initialValues: MaterialFormValues;
  initialUnits: MaterialUnit[];
  categories: MaterialCategory[];
  accounts: Account[];
  canEdit: boolean;
  isSaving: boolean;
  error: string;
  onSubmit: (
    values: MaterialFormValues,
    units: MaterialUnitFormValues[],
  ) => void | Promise<void>;
}

const EMPTY_BASE_UNIT: MaterialUnitFormValues = {
  unit_code: "PCS",
  name_ar: "قطعة",
  name_en: "",
  is_base_unit: true,
  factor_to_base: 1,
  is_active: true,
};

function unitToDraft(unit: MaterialUnit): MaterialUnitFormValues {
  return {
    id: unit.id,
    unit_code: unit.unit_code,
    name_ar: unit.name_ar,
    name_en: unit.name_en ?? "",
    is_base_unit: unit.is_base_unit,
    factor_to_base: unit.factor_to_base,
    is_active: unit.is_active,
  };
}

export function MaterialForm({
  mode,
  initialValues,
  initialUnits,
  categories,
  accounts,
  canEdit,
  isSaving,
  error,
  onSubmit,
}: MaterialFormProps) {
  const [values, setValues] = useState(initialValues);
  const [units, setUnits] = useState<MaterialUnitFormValues[]>(
    initialUnits.length > 0
      ? initialUnits.map(unitToDraft)
      : mode === "create"
        ? [EMPTY_BASE_UNIT]
        : [],
  );
  const [localError, setLocalError] = useState("");

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  );

  const updateUnit = (
    index: number,
    patch: Partial<MaterialUnitFormValues>,
  ) => {
    setUnits((current) =>
      current.map((unit, i) => {
        if (i !== index) return unit;
        const next = { ...unit, ...patch };
        if (next.is_base_unit) next.factor_to_base = 1;
        return next;
      }),
    );
  };

  const addUnit = () => {
    setUnits((current) => [
      ...current,
      {
        unit_code: "",
        name_ar: "",
        name_en: "",
        is_base_unit: false,
        factor_to_base: 1,
        is_active: true,
      },
    ]);
  };

  const validate = (): boolean => {
    if (!values.material_code.trim() || !values.name_ar.trim()) {
      setLocalError("رمز المادة والاسم العربي مطلوبان.");
      return false;
    }

    const baseUnits = units.filter((unit) => unit.is_base_unit);
    if (baseUnits.length !== 1) {
      setLocalError("يجب تعريف وحدة أساس واحدة فقط.");
      return false;
    }

    for (const unit of units) {
      if (!unit.unit_code.trim() || !unit.name_ar.trim()) {
        setLocalError("رمز واسم كل وحدة مطلوبان.");
        return false;
      }
      if (!unit.is_base_unit && unit.factor_to_base <= 0) {
        setLocalError("معامل التحويل يجب أن يكون أكبر من صفر.");
        return false;
      }
    }

    setLocalError("");
    return true;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !validate()) return;
    void onSubmit(values, units);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-800">بيانات المادة</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">رمز المادة *</span>
            <input
              value={values.material_code}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  material_code: event.target.value,
                }))
              }
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2 font-mono uppercase"
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">الصنف</span>
            <select
              value={values.category_id}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  category_id: event.target.value,
                }))
              }
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">— بدون —</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category_code} — {category.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium">الاسم العربي *</span>
            <input
              value={values.name_ar}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  name_ar: event.target.value,
                }))
              }
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium">الاسم الإنجليزي</span>
            <input
              value={values.name_en}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  name_en: event.target.value,
                }))
              }
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">سعر الشراء (وحدة أساس)</span>
            <input
              type="number"
              min={0}
              step="0.0001"
              value={values.purchase_price}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  purchase_price: Number(event.target.value),
                }))
              }
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2 font-mono"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">سعر البيع (وحدة أساس)</span>
            <input
              type="number"
              min={0}
              step="0.0001"
              value={values.sale_price}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sale_price: Number(event.target.value),
                }))
              }
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2 font-mono"
            />
          </label>
          <div className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium">حساب المخزون</span>
            <AccountSearchField
              accounts={accounts}
              value={values.inventory_account_id}
              onChange={(accountId) =>
                setValues((current) => ({
                  ...current,
                  inventory_account_id: accountId,
                }))
              }
              disabled={!canEdit || isSaving}
              placeholder="حساب مخزون اختياري"
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  is_active: event.target.checked,
                }))
              }
              disabled={!canEdit || isSaving}
            />
            <span>نشطة</span>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">وحدات القياس</h2>
            <p className="mt-1 text-xs text-slate-500">
              كل مادة لها وحداتها الخاصة — التحويل للأساس: كمية × معامل التحويل.
            </p>
          </div>
          {canEdit && mode === "edit" && (
            <button
              type="button"
              onClick={addUnit}
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            >
              وحدة إضافية
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="text-right text-slate-700">
                <th className="border-b border-slate-200 p-2">الرمز</th>
                <th className="border-b border-slate-200 p-2">الاسم</th>
                <th className="border-b border-slate-200 p-2">أساسية</th>
                <th className="border-b border-slate-200 p-2">معامل التحويل</th>
                <th className="border-b border-slate-200 p-2">نشطة</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit, index) => (
                <tr key={unit.id ?? `draft-${index}`} className="odd:bg-white even:bg-slate-50/60">
                  <td className="border-b border-slate-100 p-2">
                    <input
                      value={unit.unit_code}
                      onChange={(event) =>
                        updateUnit(index, { unit_code: event.target.value })
                      }
                      disabled={!canEdit || isSaving || Boolean(unit.id && unit.is_base_unit)}
                      className="w-full rounded border border-slate-300 px-2 py-1 font-mono uppercase"
                    />
                  </td>
                  <td className="border-b border-slate-100 p-2">
                    <input
                      value={unit.name_ar}
                      onChange={(event) =>
                        updateUnit(index, { name_ar: event.target.value })
                      }
                      disabled={!canEdit || isSaving}
                      className="w-full rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border-b border-slate-100 p-2 text-center">
                    {unit.is_base_unit ? "✓" : "—"}
                  </td>
                  <td className="border-b border-slate-100 p-2">
                    <input
                      type="number"
                      min={0.000001}
                      step="0.000001"
                      value={unit.factor_to_base}
                      onChange={(event) =>
                        updateUnit(index, {
                          factor_to_base: Number(event.target.value),
                        })
                      }
                      disabled={!canEdit || isSaving || unit.is_base_unit}
                      className="w-full rounded border border-slate-300 px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="border-b border-slate-100 p-2 text-center">
                    <input
                      type="checkbox"
                      checked={unit.is_active}
                      onChange={(event) =>
                        updateUnit(index, { is_active: event.target.checked })
                      }
                      disabled={!canEdit || isSaving || unit.is_base_unit}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(error || localError) && (
        <p className="text-sm text-rose-700">{error || localError}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "جاري الحفظ..." : mode === "create" ? "إنشاء المادة" : "حفظ التعديلات"}
          </button>
        )}
        <Link href="/materials" className="rounded-md border border-slate-300 px-4 py-2 text-sm">
          {mode === "create" ? "إلغاء" : "قائمة المواد"}
        </Link>
      </div>
    </form>
  );
}
