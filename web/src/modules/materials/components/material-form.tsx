"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { MaterialOverviewPanel } from "@/modules/materials/components/material-overview-panel";
import { MaterialSearchField } from "@/modules/materials/components/material-search-field";
import { UnitFormModal } from "@/modules/materials/components/unit-form-modal";
import { materialApi } from "@/modules/materials/services/material-api";
import { unitApi } from "@/modules/materials/services/unit-api";
import { computeFactorToBase } from "@/modules/materials/utils/unit-conversion";
import type {
  MaterialBomFormValues,
  MaterialCategory,
  MaterialFormValues,
  MaterialListItem,
  MaterialUnit,
  MaterialUnitFormValues,
  UnitCatalogFormValues,
  UnitCatalogItem,
} from "@/modules/materials/types";
import type { Account } from "@/modules/vouchers/types";

type MaterialCardTab =
  | "specifications"
  | "units-prices"
  | "bom"
  | "tracking"
  | "accounts"
  | "limits"
  | "overview";

interface MaterialFormProps {
  mode: "create" | "edit";
  materialId?: string;
  initialValues: MaterialFormValues;
  initialUnits: MaterialUnit[];
  initialBom?: MaterialBomFormValues[];
  categories: MaterialCategory[];
  catalogUnits: UnitCatalogItem[];
  normalMaterials: MaterialListItem[];
  accounts: Account[];
  canEdit: boolean;
  isSaving: boolean;
  error: string;
  onSubmit: (
    values: MaterialFormValues,
    units: MaterialUnitFormValues[],
    bom: MaterialBomFormValues[],
  ) => void | Promise<void>;
}

function makeEmptyBaseUnit(
  catalog?: UnitCatalogItem | null,
): MaterialUnitFormValues {
  return {
    unit_id: catalog?.id ?? "",
    unit_code: catalog?.unit_code ?? "",
    name_ar: catalog?.name_ar ?? "",
    name_en: catalog?.name_en ?? "",
    is_base_unit: true,
    conversion_op: "multiply",
    conversion_factor: 1,
    factor_to_base: 1,
    purchase_price: 0,
    sale_price: 0,
    semi_wholesale_price: null,
    wholesale_price: null,
    is_active: true,
  };
}

function unitToDraft(
  unit: MaterialUnit,
  material: Pick<MaterialFormValues, "purchase_price" | "sale_price">,
): MaterialUnitFormValues {
  return {
    id: unit.id,
    unit_id: unit.unit_id ?? "",
    unit_code: unit.unit_code,
    name_ar: unit.name_ar,
    name_en: unit.name_en ?? "",
    is_base_unit: unit.is_base_unit,
    conversion_op: unit.conversion_op ?? "multiply",
    conversion_factor: unit.conversion_factor ?? unit.factor_to_base ?? 1,
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
  initialBom = [],
  categories,
  catalogUnits,
  normalMaterials,
  accounts,
  canEdit,
  isSaving,
  error,
  onSubmit,
}: MaterialFormProps) {
  const [activeTab, setActiveTab] = useState<MaterialCardTab>("specifications");
  const [values, setValues] = useState(initialValues);
  const [localCatalog, setLocalCatalog] = useState(catalogUnits);
  const [units, setUnits] = useState<MaterialUnitFormValues[]>(() =>
    initialUnits.length > 0
      ? initialUnits.map((unit) => unitToDraft(unit, initialValues))
      : mode === "create"
        ? [
            makeEmptyBaseUnit(
              catalogUnits.find((u) => u.unit_code === "PCS") ??
                catalogUnits.find((u) => u.is_active) ??
                null,
            ),
          ]
        : [],
  );
  const [bomRows, setBomRows] = useState<MaterialBomFormValues[]>(initialBom);
  const [componentUnitsByMaterial, setComponentUnitsByMaterial] = useState<
    Record<string, MaterialUnit[]>
  >({});
  const [localError, setLocalError] = useState("");
  const [codeTouched, setCodeTouched] = useState(mode === "edit");
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitModalTargetIndex, setUnitModalTargetIndex] = useState<
    number | null
  >(null);
  const [unitModalSaving, setUnitModalSaving] = useState(false);
  const [unitModalError, setUnitModalError] = useState("");
  const suggestingCode = useRef(false);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  );
  const activeCatalogUnits = useMemo(
    () => localCatalog.filter((unit) => unit.is_active),
    [localCatalog],
  );
  const bomCandidates = useMemo(
    () =>
      normalMaterials.filter(
        (material) =>
          material.is_active &&
          material.material_kind !== "composite" &&
          material.id !== materialId,
      ),
    [normalMaterials, materialId],
  );

  useEffect(() => {
    setLocalCatalog(catalogUnits);
  }, [catalogUnits]);

  useEffect(() => {
    if (mode !== "create") return;
    setUnits((current) => {
      if (current.length === 0) return current;
      const base = current.find((unit) => unit.is_base_unit) ?? current[0];
      if (base.unit_id) return current;
      const pick =
        localCatalog.find((u) => u.unit_code === "PCS" && u.is_active) ??
        localCatalog.find((u) => u.is_active);
      if (!pick) return current;
      return current.map((unit) =>
        unit.is_base_unit
          ? {
              ...unit,
              unit_id: pick.id,
              unit_code: pick.unit_code,
              name_ar: pick.name_ar,
              name_en: pick.name_en ?? "",
            }
          : unit,
      );
    });
  }, [localCatalog, mode]);

  useEffect(() => {
    const ids = [
      ...new Set(
        bomRows
          .map((row) => row.component_material_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (ids.length === 0) return;
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        if (componentUnitsByMaterial[id]) return null;
        const list = await materialApi.listMaterialUnits(id);
        return { id, list };
      }),
    ).then((results) => {
      if (cancelled) return;
      setComponentUnitsByMaterial((current) => {
        const next = { ...current };
        for (const result of results) {
          if (result) next[result.id] = result.list;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // فقط عند تغيّر مكوّنات BOM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomRows.map((r) => r.component_material_id).join("|")]);

  const tabs: { id: MaterialCardTab; label: string }[] = [
    { id: "specifications", label: "مواصفات المادة" },
    { id: "units-prices", label: "الوحدات والأسعار" },
  ];
  if (values.material_kind === "composite") {
    tabs.push({ id: "bom", label: "مكوّنات التجميع" });
  }
  tabs.push(
    { id: "tracking", label: "تتبع المادة" },
    { id: "accounts", label: "الحسابات" },
    { id: "limits", label: "الحد الأدنى والأعلى" },
  );
  if (mode === "edit" && materialId) {
    tabs.push({ id: "overview", label: "لمحة عن المادة" });
  }

  useEffect(() => {
    if (mode !== "create" || codeTouched || suggestingCode.current) return;
    suggestingCode.current = true;
    void materialApi
      .suggestNextMaterialCode(values.category_id || null)
      .then((code) => {
        setValues((current) =>
          codeTouched ? current : { ...current, material_code: code },
        );
      })
      .finally(() => {
        suggestingCode.current = false;
      });
  }, [mode, values.category_id, codeTouched]);

  const applyCatalogUnit = (index: number, unitId: string) => {
    const catalog = localCatalog.find((row) => row.id === unitId);
    if (!catalog) return;
    updateUnit(index, {
      unit_id: unitId,
      unit_code: catalog.unit_code,
      name_ar: catalog.name_ar,
      name_en: catalog.name_en ?? "",
    });
  };

  const updateUnit = (
    index: number,
    patch: Partial<MaterialUnitFormValues>,
  ) => {
    setUnits((current) => {
      const next = current.map((unit, i) => {
        if (i !== index) return unit;
        const updated = { ...unit, ...patch };
        if (updated.is_base_unit) {
          updated.conversion_op = "multiply";
          updated.conversion_factor = 1;
          updated.factor_to_base = 1;
        } else {
          updated.factor_to_base = computeFactorToBase(
            false,
            updated.conversion_op,
            updated.conversion_factor,
          );
        }
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
              ? Number(patch.purchase_price)
              : currentValues.purchase_price,
          sale_price:
            patch.sale_price != null
              ? Number(patch.sale_price)
              : currentValues.sale_price,
        }));
      }

      return next;
    });
  };

  const addUnit = () => {
    const first = activeCatalogUnits[0];
    if (!first) {
      setUnitModalTargetIndex(units.length);
      setUnitModalError("");
      setUnitModalOpen(true);
      return;
    }
    setUnits((current) => [
      ...current,
      {
        unit_id: first.id,
        unit_code: first.unit_code,
        name_ar: first.name_ar,
        name_en: first.name_en ?? "",
        is_base_unit: false,
        conversion_op: "multiply",
        conversion_factor: 1,
        factor_to_base: 1,
        purchase_price: null,
        sale_price: null,
        semi_wholesale_price: null,
        wholesale_price: null,
        is_active: true,
      },
    ]);
  };

  const openNewUnitModal = (targetIndex: number) => {
    setUnitModalTargetIndex(targetIndex);
    setUnitModalError("");
    setUnitModalOpen(true);
  };

  const handleCreateCatalogUnit = async (form: UnitCatalogFormValues) => {
    const code = form.unit_code.trim().toUpperCase();
    const nameAr = form.name_ar.trim();
    if (!code || !nameAr) {
      setUnitModalError("رمز الوحدة والاسم العربي مطلوبان.");
      return;
    }
    const duplicate = localCatalog.find(
      (unit) =>
        unit.unit_code.toUpperCase() === code ||
        unit.name_ar.trim() === nameAr,
    );
    if (duplicate) {
      setUnitModalError(
        `الوحدة موجودة مسبقاً: ${duplicate.unit_code} — ${duplicate.name_ar}`,
      );
      return;
    }

    setUnitModalSaving(true);
    setUnitModalError("");
    try {
      const created = await unitApi.createUnit({
        ...form,
        unit_code: code,
        name_ar: nameAr,
      });
      setLocalCatalog((current) =>
        [...current, created].sort((a, b) =>
          a.unit_code.localeCompare(b.unit_code),
        ),
      );
      if (unitModalTargetIndex != null) {
        if (unitModalTargetIndex >= units.length) {
          setUnits((current) => [
            ...current,
            {
              unit_id: created.id,
              unit_code: created.unit_code,
              name_ar: created.name_ar,
              name_en: created.name_en ?? "",
              is_base_unit: current.length === 0,
              conversion_op: "multiply",
              conversion_factor: 1,
              factor_to_base: 1,
              purchase_price: current.length === 0 ? 0 : null,
              sale_price: current.length === 0 ? 0 : null,
              semi_wholesale_price: null,
              wholesale_price: null,
              is_active: true,
            },
          ]);
        } else {
          updateUnit(unitModalTargetIndex, {
            unit_id: created.id,
            unit_code: created.unit_code,
            name_ar: created.name_ar,
            name_en: created.name_en ?? "",
          });
        }
      }
      setUnitModalOpen(false);
      setUnitModalTargetIndex(null);
    } catch (err) {
      setUnitModalError(
        err instanceof Error ? err.message : "فشل إنشاء الوحدة.",
      );
    } finally {
      setUnitModalSaving(false);
    }
  };

  const ensureComponentUnits = async (materialId: string) => {
    if (!materialId || componentUnitsByMaterial[materialId]) {
      return componentUnitsByMaterial[materialId] ?? [];
    }
    const list = await materialApi.listMaterialUnits(materialId);
    setComponentUnitsByMaterial((current) => ({
      ...current,
      [materialId]: list,
    }));
    return list;
  };

  const selectBomMaterial = async (index: number, materialId: string) => {
    const list = materialId ? await ensureComponentUnits(materialId) : [];
    const base = list.find((unit) => unit.is_base_unit) ?? list[0];
    setBomRows((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              component_material_id: materialId,
              component_unit_id: base?.id ?? "",
            }
          : item,
      ),
    );
  };

  const addBomRow = () => {
    setBomRows((current) => [
      ...current,
      {
        component_material_id: "",
        quantity: 1,
        component_unit_id: "",
        notes: "",
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
      if (!unit.unit_id || !unit.unit_code.trim() || !unit.name_ar.trim()) {
        setLocalError("اختر وحدة من الكتالوج لكل سطر (أو أضف وحدة جديدة).");
        setActiveTab("units-prices");
        return false;
      }
      if (!unit.is_base_unit && unit.conversion_factor <= 0) {
        setLocalError("معامل التحويل يجب أن يكون أكبر من صفر.");
        setActiveTab("units-prices");
        return false;
      }
    }

    const usedUnitIds = units.map((unit) => unit.unit_id).filter(Boolean);
    if (new Set(usedUnitIds).size !== usedUnitIds.length) {
      setLocalError("لا يمكن تكرار نفس الوحدة على أكثر من سطر.");
      setActiveTab("units-prices");
      return false;
    }

    if (values.material_kind === "composite") {
      if (bomRows.length === 0) {
        setLocalError("المادة التجميعية تحتاج مكوّناً واحداً على الأقل.");
        setActiveTab("bom");
        return false;
      }
      for (const row of bomRows) {
        if (
          !row.component_material_id ||
          !row.component_unit_id ||
          row.quantity <= 0
        ) {
          setLocalError(
            "كل مكوّن يحتاج مادة ووحدة قياس وكمية أكبر من صفر.",
          );
          setActiveTab("bom");
          return false;
        }
      }
    }

    setLocalError("");
    return true;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !validate()) return;
    const baseUnit = units.find((unit) => unit.is_base_unit);
    const payload: MaterialFormValues = {
      ...values,
      purchase_price: Number(baseUnit?.purchase_price ?? 0),
      sale_price: Number(baseUnit?.sale_price ?? 0),
    };
    void onSubmit(payload, units, bomRows);
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
              onChange={(event) => {
                setCodeTouched(true);
                setValues((current) => ({
                  ...current,
                  material_code: event.target.value,
                }));
              }}
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2 font-mono uppercase"
              required
            />
            {mode === "create" && (
              <span className="text-xs text-slate-500">
                يُقترح تلقائياً من رمز الصنف — يمكن تعديله.
              </span>
            )}
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
          <label className="grid gap-1 text-sm">
            <span className="font-medium">نوع المادة</span>
            <select
              value={values.material_kind}
              onChange={(event) => {
                const kind = event.target.value as "normal" | "composite";
                setValues((current) => ({ ...current, material_kind: kind }));
                if (kind === "normal") setBomRows([]);
                if (kind === "composite" && activeTab === "bom") {
                  /* keep */
                } else if (kind !== "composite" && activeTab === "bom") {
                  setActiveTab("specifications");
                }
              }}
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="normal">عادية</option>
              <option value="composite">تجميعية</option>
            </select>
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
                  onChange={(event) => {
                    const categoryId = event.target.value;
                    if (mode === "create") setCodeTouched(false);
                    setValues((current) => ({
                      ...current,
                      category_id: categoryId,
                    }));
                  }}
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
              {values.material_kind === "composite" && (
                <p className="md:col-span-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  عند استخدام المادة التجميعية في الفواتير يُستهلك مخزون المواد
                  العادية وفق كميات المكوّنات — لا يُخزَّن رصيد للمادة التجميعية
                  نفسها.
                </p>
              )}
            </div>
          )}

          {activeTab === "units-prices" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">جدول الوحدات</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    الصف الأول هو الوحدة الأساسية — أسعار الشراء/البيع تُحدَّد على
                    سطرها. الوحدات الفرعية بمعامل ضرب أو قسمة.
                  </p>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openNewUnitModal(units.length)}
                      disabled={isSaving}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                    >
                      وحدة جديدة في الكتالوج
                    </button>
                    <button
                      type="button"
                      onClick={addUnit}
                      disabled={isSaving}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                    >
                      وحدة إضافية للمادة
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-right text-slate-700">
                      <th className="border-b border-slate-200 p-2">الوحدة</th>
                      <th className="border-b border-slate-200 p-2">أساس؟</th>
                      <th className="border-b border-slate-200 p-2">العملية</th>
                      <th className="border-b border-slate-200 p-2">المعامل</th>
                      <th className="border-b border-slate-200 p-2">= أساس</th>
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
                          <div className="flex gap-1">
                            <select
                              value={unit.unit_id}
                              onChange={(event) =>
                                applyCatalogUnit(index, event.target.value)
                              }
                              disabled={
                                !canEdit ||
                                isSaving ||
                                Boolean(unit.id && unit.is_base_unit)
                              }
                              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1"
                            >
                              <option value="">— اختر وحدة —</option>
                              {activeCatalogUnits.map((catalog) => (
                                <option key={catalog.id} value={catalog.id}>
                                  {catalog.unit_code} — {catalog.name_ar}
                                </option>
                              ))}
                            </select>
                            {canEdit && (
                              <button
                                type="button"
                                title="إضافة وحدة جديدة"
                                onClick={() => openNewUnitModal(index)}
                                disabled={isSaving}
                                className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="border-b border-slate-100 p-2 text-center text-xs">
                          {unit.is_base_unit ? "أساس" : "فرعية"}
                        </td>
                        <td className="border-b border-slate-100 p-2">
                          <select
                            value={unit.conversion_op}
                            onChange={(event) =>
                              updateUnit(index, {
                                conversion_op: event.target.value as
                                  | "multiply"
                                  | "divide",
                              })
                            }
                            disabled={
                              !canEdit || isSaving || unit.is_base_unit
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1"
                          >
                            <option value="multiply">ضرب ×</option>
                            <option value="divide">قسمة ÷</option>
                          </select>
                        </td>
                        <td className="border-b border-slate-100 p-2">
                          <input
                            type="number"
                            min={0.000001}
                            step="0.000001"
                            value={unit.conversion_factor}
                            onChange={(event) =>
                              updateUnit(index, {
                                conversion_factor: Number(event.target.value),
                              })
                            }
                            disabled={
                              !canEdit || isSaving || unit.is_base_unit
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 font-mono"
                          />
                        </td>
                        <td className="border-b border-slate-100 p-2 font-mono text-xs text-slate-600">
                          {unit.factor_to_base.toFixed(6)}
                        </td>
                        {(
                          [
                            "purchase_price",
                            "sale_price",
                            "semi_wholesale_price",
                            "wholesale_price",
                          ] as const
                        ).map((field) => (
                          <td
                            key={field}
                            className="border-b border-slate-100 p-2"
                          >
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
                              updateUnit(index, {
                                is_active: event.target.checked,
                              })
                            }
                            disabled={
                              !canEdit || isSaving || unit.is_base_unit
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                مثال: أساس=قطعة، علبة بضرب 12 → 1 علبة = 12 قطعة. أساس=كيلو، غرام
                بقسمة 1000 → 1 غرام = 0.001 كيلو.
              </p>
            </div>
          )}

          {activeTab === "bom" && values.material_kind === "composite" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    مكوّنات التجميع
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    الكمية بوحدة المكوّن المختارة لكل وحدة أساس واحدة من هذه المادة
                    التجميعية.
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addBomRow}
                    disabled={isSaving}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                  >
                    إضافة مكوّن
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-right text-slate-700">
                      <th className="border-b border-slate-200 p-2">المادة العادية</th>
                      <th className="border-b border-slate-200 p-2">الكمية</th>
                      <th className="border-b border-slate-200 p-2">وحدة الاستهلاك</th>
                      <th className="border-b border-slate-200 p-2">ملاحظات</th>
                      <th className="border-b border-slate-200 p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {bomRows.map((row, index) => {
                      const componentUnits =
                        componentUnitsByMaterial[row.component_material_id] ??
                        [];
                      return (
                        <tr key={row.id ?? `bom-${index}`}>
                          <td className="border-b border-slate-100 p-2 min-w-[220px]">
                            <MaterialSearchField
                              label="المادة"
                              hideLabel
                              materials={bomCandidates}
                              value={row.component_material_id}
                              onChange={(materialId) => {
                                void selectBomMaterial(index, materialId);
                              }}
                              disabled={!canEdit || isSaving}
                              required
                            />
                          </td>
                          <td className="border-b border-slate-100 p-2">
                            <input
                              type="number"
                              min={0.000001}
                              step="0.000001"
                              value={row.quantity}
                              onChange={(event) =>
                                setBomRows((current) =>
                                  current.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          quantity: Number(event.target.value),
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={!canEdit || isSaving}
                              className="w-full rounded border border-slate-300 px-2 py-1 font-mono"
                            />
                          </td>
                          <td className="border-b border-slate-100 p-2">
                            <select
                              value={row.component_unit_id}
                              onChange={(event) =>
                                setBomRows((current) =>
                                  current.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          component_unit_id: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={
                                !canEdit ||
                                isSaving ||
                                !row.component_material_id
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1"
                            >
                              <option value="">— اختر وحدة —</option>
                              {componentUnits.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.unit_code} — {unit.name_ar}
                                  {unit.is_base_unit ? " (أساس)" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border-b border-slate-100 p-2">
                            <input
                              value={row.notes}
                              onChange={(event) =>
                                setBomRows((current) =>
                                  current.map((item, i) =>
                                    i === index
                                      ? { ...item, notes: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              disabled={!canEdit || isSaving}
                              className="w-full rounded border border-slate-300 px-2 py-1"
                            />
                          </td>
                          <td className="border-b border-slate-100 p-2">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() =>
                                  setBomRows((current) =>
                                    current.filter((_, i) => i !== index),
                                  )
                                }
                                className="text-xs text-rose-700"
                              >
                                حذف
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
                    <span>إجبار تاريخ انتهاء الصلاحية عند الإدخال</span>
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
                    <span>إجبار تاريخ انتهاء الصلاحية عند الإخراج</span>
                  </label>
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
                      disabled={
                        !canEdit || isSaving || !values.has_serial_number
                      }
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
                      disabled={
                        !canEdit || isSaving || !values.has_serial_number
                      }
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
              </div>
            </div>
          )}

          {activeTab === "limits" && (
            <div className="grid max-w-xl gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">الحد الأدنى (وحدة أساس)</span>
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
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">الحد الأعلى (وحدة أساس)</span>
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
            {isSaving
              ? "جاري الحفظ..."
              : mode === "create"
                ? "إنشاء المادة"
                : "حفظ"}
          </button>
        )}
        <Link
          href="/materials"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm"
        >
          {mode === "create" ? "إلغاء" : "قائمة المواد"}
        </Link>
      </div>

      <UnitFormModal
        open={unitModalOpen}
        mode="create"
        isSaving={unitModalSaving}
        error={unitModalError}
        onClose={() => {
          if (unitModalSaving) return;
          setUnitModalOpen(false);
          setUnitModalTargetIndex(null);
          setUnitModalError("");
        }}
        onSubmit={(formValues) => {
          void handleCreateCatalogUnit(formValues);
        }}
      />
    </form>
  );
}
