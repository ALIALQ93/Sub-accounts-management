"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { MaterialOverviewPanel } from "@/modules/materials/components/material-overview-panel";
import type { MaterialCategory } from "@/modules/materials/types";
import type {
  MaterialFormValues,
  MaterialUnit,
  MaterialUnitFormValues,
} from "@/modules/materials/types";
import type { Account } from "@/modules/vouchers/types";

type MaterialCardTab =
  | "specifications"
  | "units-prices"
  | "tracking"
  | "accounts"
  | "limits"
  | "overview";

interface MaterialFormProps {
  mode: "create" | "edit";
  materialId?: string;
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
  purchase_price: 0,
  sale_price: 0,
  semi_wholesale_price: null,
  wholesale_price: null,
  is_active: true,
};

function unitToDraft(
  unit: MaterialUnit,
  material: Pick<MaterialFormValues, "purchase_price" | "sale_price">,
): MaterialUnitFormValues {
  return {
    id: unit.id,
    unit_code: unit.unit_code,
    name_ar: unit.name_ar,
    name_en: unit.name_en ?? "",
    is_base_unit: unit.is_base_unit,
    factor_to_base: unit.factor_to_base,
    purchase_price:
      unit.purchase_price ??
      (unit.is_base_unit ? material.purchase_price : null),
    sale_price:
      unit.sale_price ?? (unit.is_base_unit ? material.sale_price : null),
    semi_wholesale_price: unit.semi_wholesale_price,
    wholesale_price: unit.wholesale_price,
    is_active: unit.is_active,
  };
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md px-3 py-2 text-right text-sm font-medium transition ${
        active
          ? "bg-blue-900 text-white shadow-sm"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

export function MaterialForm({
  mode,
  materialId,
  initialValues,
  initialUnits,
  categories,
  accounts,
  canEdit,
  isSaving,
  error,
  onSubmit,
}: MaterialFormProps) {
  const [activeTab, setActiveTab] = useState<MaterialCardTab>("specifications");
  const [values, setValues] = useState(initialValues);
  const [units, setUnits] = useState<MaterialUnitFormValues[]>(
    initialUnits.length > 0
      ? initialUnits.map((unit) => unitToDraft(unit, initialValues))
      : mode === "create"
        ? [EMPTY_BASE_UNIT]
        : [],
  );
  const [localError, setLocalError] = useState("");

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  );

  const tabs: { id: MaterialCardTab; label: string }[] = [
    { id: "specifications", label: "مواصفات المادة" },
    { id: "units-prices", label: "الوحدات والأسعار" },
    { id: "tracking", label: "تتبع المادة" },
    { id: "accounts", label: "الحسابات" },
    { id: "limits", label: "الحد الأدنى والأعلى" },
  ];
  if (mode === "edit" && materialId) {
    tabs.push({ id: "overview", label: "لمحة عن المادة" });
  }

  const updateUnit = (
    index: number,
    patch: Partial<MaterialUnitFormValues>,
  ) => {
    setUnits((current) => {
      const next = current.map((unit, i) => {
        if (i !== index) return unit;
        const updated = { ...unit, ...patch };
        if (updated.is_base_unit) updated.factor_to_base = 1;
        return updated;
      });

      const updatedUnit = next[index];
      if (
        updatedUnit?.is_base_unit &&
        (patch.purchase_price != null || patch.sale_price != null)
      ) {
        setValues((currentValues) => ({
          ...currentValues,
          purchase_price:
            patch.purchase_price != null
              ? patch.purchase_price
              : currentValues.purchase_price,
          sale_price:
            patch.sale_price != null
              ? patch.sale_price
              : currentValues.sale_price,
        }));
      }

      return next;
    });
  };

  const syncBaseUnitPrices = (
    purchasePrice: number,
    salePrice: number,
  ) => {
    setUnits((current) =>
      current.map((unit) =>
        unit.is_base_unit
          ? { ...unit, purchase_price: purchasePrice, sale_price: salePrice }
          : unit,
      ),
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
        purchase_price: null,
        sale_price: null,
        semi_wholesale_price: null,
        wholesale_price: null,
        is_active: true,
      },
    ]);
  };

  const validate = (): boolean => {
    if (!values.material_code.trim() || !values.name_ar.trim()) {
      setLocalError("رمز المادة والاسم العربي مطلوبان.");
      setActiveTab("specifications");
      return false;
    }

    const baseUnits = units.filter((unit) => unit.is_base_unit);
    if (baseUnits.length !== 1) {
      setLocalError("يجب تعريف وحدة أساس واحدة فقط.");
      setActiveTab("units-prices");
      return false;
    }

    for (const unit of units) {
      if (!unit.unit_code.trim() || !unit.name_ar.trim()) {
        setLocalError("رمز واسم كل وحدة مطلوبان.");
        setActiveTab("units-prices");
        return false;
      }
      if (!unit.is_base_unit && unit.factor_to_base <= 0) {
        setLocalError("معامل التحويل يجب أن يكون أكبر من صفر.");
        setActiveTab("units-prices");
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
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-800">بطاقة مادة</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={!values.is_active}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  is_active: !event.target.checked,
                }))
              }
              disabled={!canEdit || isSaving}
            />
            <span>غير فعالة</span>
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium">الاسم اللاتيني</span>
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
              dir="ltr"
            />
          </label>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            أقسام المادة
          </p>
          <nav className="flex flex-col gap-1">
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </TabButton>
            ))}
          </nav>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {activeTab === "specifications" && (
            <div className="grid gap-3 md:grid-cols-2">
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
              <label className="grid gap-1 text-sm">
                <span className="font-medium">الشركة المصنعة</span>
                <input
                  value={values.manufacturer}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      manufacturer: event.target.value,
                    }))
                  }
                  disabled={!canEdit || isSaving}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">المورد</span>
                <input
                  value={values.supplier_name}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      supplier_name: event.target.value,
                    }))
                  }
                  disabled={!canEdit || isSaving}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">اللون</span>
                <input
                  value={values.color}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      color: event.target.value,
                    }))
                  }
                  disabled={!canEdit || isSaving}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">الحجم</span>
                <input
                  value={values.size}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      size: event.target.value,
                    }))
                  }
                  disabled={!canEdit || isSaving}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">الوزن</span>
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={values.weight ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      weight:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    }))
                  }
                  disabled={!canEdit || isSaving}
                  className="rounded-md border border-slate-300 px-3 py-2 font-mono"
                />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="font-medium">الملاحظات</span>
                <textarea
                  value={values.notes}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  disabled={!canEdit || isSaving}
                  rows={4}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          )}

          {activeTab === "units-prices" && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">سعر الشراء (وحدة أساس)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={values.purchase_price}
                    onChange={(event) => {
                      const purchasePrice = Number(event.target.value);
                      setValues((current) => ({
                        ...current,
                        purchase_price: purchasePrice,
                      }));
                      syncBaseUnitPrices(purchasePrice, values.sale_price);
                    }}
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
                    onChange={(event) => {
                      const salePrice = Number(event.target.value);
                      setValues((current) => ({
                        ...current,
                        sale_price: salePrice,
                      }));
                      syncBaseUnitPrices(values.purchase_price, salePrice);
                    }}
                    disabled={!canEdit || isSaving}
                    className="rounded-md border border-slate-300 px-3 py-2 font-mono"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">جدول الوحدات</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    التعادل: كم وحدة أساس في كل وحدة فرعية.
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
                <table className="w-full min-w-[960px] border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-right text-slate-700">
                      <th className="border-b border-slate-200 p-2">الرمز</th>
                      <th className="border-b border-slate-200 p-2">الوحدة</th>
                      <th className="border-b border-slate-200 p-2">التعادل</th>
                      <th className="border-b border-slate-200 p-2">الشراء</th>
                      <th className="border-b border-slate-200 p-2">المبيع</th>
                      <th className="border-b border-slate-200 p-2">نصف جملة</th>
                      <th className="border-b border-slate-200 p-2">جملة</th>
                      <th className="border-b border-slate-200 p-2">نشطة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit, index) => (
                      <tr
                        key={unit.id ?? `draft-${index}`}
                        className="odd:bg-white even:bg-slate-50/60"
                      >
                        <td className="border-b border-slate-100 p-2">
                          <input
                            value={unit.unit_code}
                            onChange={(event) =>
                              updateUnit(index, { unit_code: event.target.value })
                            }
                            disabled={
                              !canEdit ||
                              isSaving ||
                              Boolean(unit.id && unit.is_base_unit)
                            }
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
                        {(
                          [
                            "purchase_price",
                            "sale_price",
                            "semi_wholesale_price",
                            "wholesale_price",
                          ] as const
                        ).map((field) => (
                          <td key={field} className="border-b border-slate-100 p-2">
                            <input
                              type="number"
                              min={0}
                              step="0.0001"
                              value={unit[field] ?? ""}
                              onChange={(event) =>
                                updateUnit(index, {
                                  [field]:
                                    event.target.value === ""
                                      ? null
                                      : Number(event.target.value),
                                })
                              }
                              disabled={!canEdit || isSaving}
                              className="w-full rounded border border-slate-300 px-2 py-1 font-mono"
                            />
                          </td>
                        ))}
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
            </div>
          )}

          {activeTab === "tracking" && (
            <div className="grid max-w-2xl gap-4">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">باركود</span>
                <input
                  value={values.barcode}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      barcode: event.target.value,
                    }))
                  }
                  disabled={!canEdit || isSaving}
                  className="rounded-md border border-slate-300 px-3 py-2 font-mono"
                  dir="ltr"
                />
              </label>

              <fieldset className="rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-sm font-bold text-slate-800">
                  تاريخ الصلاحية
                </legend>
                <div className="mt-2 grid gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.has_expiry_date}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          has_expiry_date: event.target.checked,
                          require_expiry_on_inbound: event.target.checked
                            ? current.require_expiry_on_inbound
                            : false,
                          require_expiry_on_outbound: event.target.checked
                            ? current.require_expiry_on_outbound
                            : false,
                        }))
                      }
                      disabled={!canEdit || isSaving}
                    />
                    <span>المادة تتتبع تاريخ الصلاحية</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.require_expiry_on_inbound}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          require_expiry_on_inbound: event.target.checked,
                        }))
                      }
                      disabled={!canEdit || isSaving || !values.has_expiry_date}
                    />
                    <span>إجبار تاريخ انتهاء الصلاحية عند الإدخال (في الفاتورة)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.require_expiry_on_outbound}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          require_expiry_on_outbound: event.target.checked,
                        }))
                      }
                      disabled={!canEdit || isSaving || !values.has_expiry_date}
                    />
                    <span>إجبار تاريخ انتهاء الصلاحية عند الإخراج (في الفاتورة)</span>
                  </label>
                  <p className="text-xs text-slate-500">
                    الإعدادات هنا — التاريخ الفعلي يُدخل يدوياً في كل سطر فاتورة (مشتريات،
                    مبيعات، …) وليس بحساب بعدد أيام من البطاقة.
                  </p>
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-sm font-bold text-slate-800">
                  الرقم التسلسلي
                </legend>
                <div className="mt-2 grid gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.has_serial_number}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          has_serial_number: event.target.checked,
                          require_serial_on_inbound: event.target.checked
                            ? current.require_serial_on_inbound
                            : false,
                          require_serial_on_outbound: event.target.checked
                            ? current.require_serial_on_outbound
                            : false,
                        }))
                      }
                      disabled={!canEdit || isSaving}
                    />
                    <span>تتبع برقم تسلسلي</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.require_serial_on_inbound}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          require_serial_on_inbound: event.target.checked,
                        }))
                      }
                      disabled={!canEdit || isSaving || !values.has_serial_number}
                    />
                    <span>إجبار الرقم التسلسلي عند الإدخال</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.require_serial_on_outbound}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          require_serial_on_outbound: event.target.checked,
                        }))
                      }
                      disabled={!canEdit || isSaving || !values.has_serial_number}
                    />
                    <span>إجبار الرقم التسلسلي عند الإخراج</span>
                  </label>
                </div>
              </fieldset>
            </div>
          )}

          {activeTab === "accounts" && (
            <div className="grid max-w-xl gap-3">
              <div className="grid gap-1 text-sm">
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
                <span className="text-xs text-slate-500">
                  يُستخدم عند ترحيل حركات المخزون إلى القيود المحاسبية.
                </span>
              </div>
            </div>
          )}

          {activeTab === "limits" && (
            <div className="grid max-w-xl gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">الحد الأدنى للمادة (وحدة أساس)</span>
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={values.min_stock}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      min_stock: Number(event.target.value),
                    }))
                  }
                  disabled={!canEdit || isSaving}
                  className="rounded-md border border-slate-300 px-3 py-2 font-mono"
                />
                <span className="text-xs text-slate-500">
                  يُستخدم في تقرير النواقص — صفر يعني الاعتماد على الحد العام.
                </span>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">الحد الأعلى للمادة (وحدة أساس)</span>
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={values.max_stock}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      max_stock: Number(event.target.value),
                    }))
                  }
                  disabled={!canEdit || isSaving}
                  className="rounded-md border border-slate-300 px-3 py-2 font-mono"
                />
              </label>
            </div>
          )}

          {activeTab === "overview" && materialId && (
            <MaterialOverviewPanel
              materialId={materialId}
              minStock={values.min_stock}
              maxStock={values.max_stock}
            />
          )}
        </section>
      </div>

      {(error || localError) && (
        <p className="text-sm text-rose-700">{error || localError}</p>
      )}

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {canEdit && (
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "جاري الحفظ..." : mode === "create" ? "إنشاء المادة" : "حفظ"}
          </button>
        )}
        <Link href="/materials" className="rounded-md border border-slate-300 px-4 py-2 text-sm">
          {mode === "create" ? "إلغاء" : "قائمة المواد"}
        </Link>
      </div>
    </form>
  );
}
