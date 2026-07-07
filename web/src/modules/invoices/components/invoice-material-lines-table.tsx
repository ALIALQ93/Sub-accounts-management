"use client";

import { useMemo } from "react";
import type { MaterialOption, MaterialUnitOption } from "@/modules/invoices/types";
import type { InvoiceMaterialLineInput } from "@/modules/invoices/services/invoice-api";
import {
  computeLineNetAmount,
  defaultUnitPrice,
} from "@/modules/invoices/utils/invoice-line-utils";
import { referenceCapForLine } from "@/modules/invoices/utils/reference-line-caps";
import type { WarehouseOption } from "@/modules/invoices/services/invoice-pattern-api";
import {
  SearchSelectField,
  type SearchSelectOption,
} from "@/modules/vouchers/components/search-select-field";
import {
  isExpiryRequiredOnLine,
  isSerialRequiredOnLine,
  showExpiryOnLine,
  showSerialOnLine,
} from "@/modules/materials/utils/material-tracking-utils";

export type DraftMaterialLine = InvoiceMaterialLineInput & {
  clientId: string;
};

export interface MaterialLineAttributeFlags {
  showColor: boolean;
  showSize: boolean;
  showSource: boolean;
  showCaliber: boolean;
}

interface InvoiceMaterialLinesTableProps {
  lines: DraftMaterialLine[];
  materials: MaterialOption[];
  unitsByMaterial: Record<string, MaterialUnitOption[]>;
  warehouses: WarehouseOption[];
  defaultBranchId: string;
  defaultCostCenterId: string;
  defaultWarehouseId: string;
  commercialKind: string;
  readOnly: boolean;
  showQtyReceived?: boolean;
  showLineDiscount?: boolean;
  showLineExtra?: boolean;
  referenceLineCaps?: Record<string, number> | null;
  lineAttributes?: MaterialLineAttributeFlags;
  onChange: (lines: DraftMaterialLine[]) => void;
  onMaterialSelected: (materialId: string) => Promise<MaterialUnitOption[]>;
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100";

function newLine(
  defaults: Pick<
    DraftMaterialLine,
    "branch_id" | "cost_center_id" | "warehouse_id"
  >,
  lineNo: number,
): DraftMaterialLine {
  return {
    clientId: crypto.randomUUID(),
    line_no: lineNo,
    branch_id: defaults.branch_id,
    cost_center_id: defaults.cost_center_id,
    warehouse_id: defaults.warehouse_id,
    material_id: "",
    material_unit_id: "",
    quantity: 1,
    unit_price: 0,
    line_description: null,
  };
}

export function InvoiceMaterialLinesTable({
  lines,
  materials,
  unitsByMaterial,
  warehouses,
  defaultBranchId,
  defaultCostCenterId,
  defaultWarehouseId,
  commercialKind,
  readOnly,
  showQtyReceived = false,
  showLineDiscount = false,
  showLineExtra = false,
  referenceLineCaps = null,
  lineAttributes,
  onChange,
  onMaterialSelected,
}: InvoiceMaterialLinesTableProps) {
  const materialOptions = useMemo<SearchSelectOption[]>(
    () =>
      materials
        .filter((m) => m.is_active)
        .map((m) => ({
          id: m.id,
          label: `${m.material_code} — ${m.name_ar}`,
          searchText: `${m.material_code} ${m.name_ar}`,
        })),
    [materials],
  );

  const materialById = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials],
  );

  const showExpiryColumn = useMemo(
    () => materials.some((material) => showExpiryOnLine(material, commercialKind)),
    [materials, commercialKind],
  );

  const showSerialColumn = useMemo(
    () => materials.some((material) => showSerialOnLine(material, commercialKind)),
    [materials, commercialKind],
  );

  const warehousesForBranch = (branchId: string) =>
    warehouses.filter((w) => w.is_active && w.branch_id === branchId);

  const updateLine = (clientId: string, patch: Partial<DraftMaterialLine>) => {
    onChange(
      lines.map((line) =>
        line.clientId === clientId ? { ...line, ...patch } : line,
      ),
    );
  };

  const addLine = () => {
    onChange([
      ...lines,
      newLine(
        {
          branch_id: defaultBranchId,
          cost_center_id: defaultCostCenterId || null,
          warehouse_id: defaultWarehouseId,
        },
        lines.length + 1,
      ),
    ]);
  };

  const removeLine = (clientId: string) => {
    const next = lines
      .filter((line) => line.clientId !== clientId)
      .map((line, index) => ({ ...line, line_no: index + 1 }));
    onChange(next);
  };

  const handleMaterialChange = async (clientId: string, materialId: string) => {
    const material = materialById.get(materialId);
    if (!material) {
      updateLine(clientId, {
        material_id: materialId,
        material_unit_id: "",
        unit_price: 0,
      });
      return;
    }

    const units = unitsByMaterial[materialId] ?? (await onMaterialSelected(materialId));
    const baseUnit = units.find((u) => u.is_base_unit) ?? units[0];
    if (!baseUnit) {
      window.alert(
        `المادة «${material.name_ar}» بدون وحدة قياس — أكمل بطاقة المادة (وحدة الأساس) قبل استخدامها بالفاتورة.`,
      );
      return;
    }
    const unitPrice = defaultUnitPrice(
      commercialKind,
      material,
      baseUnit.factor_to_base,
    );

    updateLine(clientId, {
      material_id: materialId,
      material_unit_id: baseUnit.id,
      unit_price: unitPrice,
    });
  };

  const handleUnitChange = (clientId: string, unitId: string) => {
    const line = lines.find((l) => l.clientId === clientId);
    if (!line) return;
    const material = materialById.get(line.material_id);
    const unit = (unitsByMaterial[line.material_id] ?? []).find(
      (u) => u.id === unitId,
    );
    if (!material || !unit) {
      updateLine(clientId, { material_unit_id: unitId });
      return;
    }
    updateLine(clientId, {
      material_unit_id: unitId,
      unit_price: defaultUnitPrice(
        commercialKind,
        material,
        unit.factor_to_base,
      ),
    });
  };

  const attrCols = lineAttributes
    ? [
        lineAttributes.showColor,
        lineAttributes.showSize,
        lineAttributes.showSource,
        lineAttributes.showCaliber,
      ].filter(Boolean).length
    : 0;

  const extraCols =
    attrCols +
    (showExpiryColumn ? 1 : 0) +
    (showSerialColumn ? 1 : 0) +
    (showLineDiscount ? 2 : 0) +
    (showLineExtra ? 2 : 0) +
    (showQtyReceived ? 1 : 0) +
    (readOnly ? 0 : 1);

  const total = lines.reduce(
    (sum, line) =>
      sum +
      computeLineNetAmount(
        line.quantity,
        line.unit_price,
        line.discount_percent,
        line.discount_amount,
        line.extra_percent,
        line.extra_amount,
      ),
    0,
  );

  const renderAttrInput = (
    line: DraftMaterialLine,
    field: "color" | "size" | "source" | "caliber",
    label: string,
  ) => (
    <td key={field} className="border border-slate-100 p-2">
      <input
        disabled={readOnly}
        className={inputClass}
        placeholder={label}
        value={line[field] ?? ""}
        onChange={(e) =>
          updateLine(line.clientId, { [field]: e.target.value || null })
        }
      />
    </td>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-right text-slate-700">
              <th className="border border-slate-200 p-2">#</th>
              <th className="border border-slate-200 p-2">المادة</th>
              <th className="border border-slate-200 p-2">الوحدة</th>
              <th className="border border-slate-200 p-2">المستودع</th>
              <th className="border border-slate-200 p-2">الكمية</th>
              <th className="border border-slate-200 p-2">السعر</th>
              <th className="border border-slate-200 p-2">المبلغ</th>
              {lineAttributes?.showColor && (
                <th className="border border-slate-200 p-2">اللون</th>
              )}
              {lineAttributes?.showSize && (
                <th className="border border-slate-200 p-2">المقاس</th>
              )}
              {lineAttributes?.showSource && (
                <th className="border border-slate-200 p-2">المصدر</th>
              )}
              {lineAttributes?.showCaliber && (
                <th className="border border-slate-200 p-2">العيار</th>
              )}
              {showExpiryColumn && (
                <th className="border border-slate-200 p-2">تاريخ الصلاحية</th>
              )}
              {showSerialColumn && (
                <th className="border border-slate-200 p-2">الرقم التسلسلي</th>
              )}
              {showLineDiscount && (
                <>
                  <th className="border border-slate-200 p-2">خصم %</th>
                  <th className="border border-slate-200 p-2">خصم مبلغ</th>
                </>
              )}
              {showLineExtra && (
                <>
                  <th className="border border-slate-200 p-2">إضافي %</th>
                  <th className="border border-slate-200 p-2">إضافي مبلغ</th>
                </>
              )}
              {showQtyReceived && (
                <th className="border border-slate-200 p-2">المستلم</th>
              )}
              {!readOnly && <th className="border border-slate-200 p-2" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const units = unitsByMaterial[line.material_id] ?? [];
              const whOptions = warehousesForBranch(line.branch_id);
              const material = materialById.get(line.material_id);
              const expiryRequired =
                material != null &&
                isExpiryRequiredOnLine(material, commercialKind);
              const serialRequired =
                material != null &&
                isSerialRequiredOnLine(material, commercialKind);
              const amount = computeLineNetAmount(
                line.quantity,
                line.unit_price,
                line.discount_percent,
                line.discount_amount,
                line.extra_percent,
                line.extra_amount,
              );

              return (
                <tr key={line.clientId} className="odd:bg-white even:bg-slate-50/60">
                  <td className="border border-slate-100 p-2">{line.line_no}</td>
                  <td className="border border-slate-100 p-2 min-w-[220px]">
                    <SearchSelectField
                      label="المادة"
                      hideLabel
                      placeholder="اختر مادة..."
                      options={materialOptions}
                      value={line.material_id}
                      onChange={(id) => void handleMaterialChange(line.clientId, id)}
                      disabled={readOnly}
                      modalTitle="اختر مادة"
                    />
                  </td>
                  <td className="border border-slate-100 p-2">
                    <select
                      disabled={readOnly || !line.material_id}
                      className={inputClass}
                      value={line.material_unit_id}
                      onChange={(e) =>
                        handleUnitChange(line.clientId, e.target.value)
                      }
                    >
                      <option value="">—</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name_ar}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-slate-100 p-2">
                    <select
                      disabled={readOnly}
                      className={inputClass}
                      value={line.warehouse_id}
                      onChange={(e) =>
                        updateLine(line.clientId, { warehouse_id: e.target.value })
                      }
                    >
                      <option value="">—</option>
                      {whOptions.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.warehouse_code} — {wh.name_ar}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-slate-100 p-2">
                    <input
                      type="number"
                      min={0.000001}
                      step="any"
                      disabled={readOnly}
                      className={inputClass}
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.clientId, {
                          quantity: Number(e.target.value) || 0,
                        })
                      }
                    />
                    {referenceCapForLine(line, referenceLineCaps) != null && (
                      <p className="mt-0.5 text-xs text-amber-700">
                        حد المرجع: {referenceCapForLine(line, referenceLineCaps)}
                      </p>
                    )}
                  </td>
                  <td className="border border-slate-100 p-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={readOnly}
                      className={inputClass}
                      value={line.unit_price}
                      onChange={(e) =>
                        updateLine(line.clientId, {
                          unit_price: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="border border-slate-100 p-2 font-mono">
                    {amount.toFixed(2)}
                  </td>
                  {lineAttributes?.showColor &&
                    renderAttrInput(line, "color", "اللون")}
                  {lineAttributes?.showSize &&
                    renderAttrInput(line, "size", "المقاس")}
                  {lineAttributes?.showSource &&
                    renderAttrInput(line, "source", "المصدر")}
                  {lineAttributes?.showCaliber &&
                    renderAttrInput(line, "caliber", "العيار")}
                  {showExpiryColumn && (
                    <td className="border border-slate-100 p-2">
                      {showExpiryOnLine(material, commercialKind) ? (
                        <input
                          type="date"
                          disabled={readOnly}
                          required={expiryRequired}
                          className={inputClass}
                          value={line.expiry_date ?? ""}
                          onChange={(e) =>
                            updateLine(line.clientId, {
                              expiry_date: e.target.value || null,
                            })
                          }
                        />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  )}
                  {showSerialColumn && (
                    <td className="border border-slate-100 p-2">
                      {showSerialOnLine(material, commercialKind) ? (
                        <input
                          disabled={readOnly}
                          required={serialRequired}
                          className={`${inputClass} font-mono`}
                          placeholder="SN"
                          value={line.serial_number ?? ""}
                          onChange={(e) =>
                            updateLine(line.clientId, {
                              serial_number: e.target.value || null,
                            })
                          }
                        />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  )}
                  {showLineDiscount && (
                    <>
                      <td className="border border-slate-100 p-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          disabled={readOnly}
                          className={inputClass}
                          value={line.discount_percent ?? ""}
                          onChange={(e) =>
                            updateLine(line.clientId, {
                              discount_percent: e.target.value
                                ? Number(e.target.value)
                                : null,
                              discount_amount: null,
                            })
                          }
                        />
                      </td>
                      <td className="border border-slate-100 p-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={readOnly}
                          className={inputClass}
                          value={
                            line.discount_percent != null && line.discount_percent > 0
                              ? ""
                              : (line.discount_amount ?? "")
                          }
                          onChange={(e) =>
                            updateLine(line.clientId, {
                              discount_amount: e.target.value
                                ? Number(e.target.value)
                                : 0,
                              discount_percent: null,
                            })
                          }
                        />
                      </td>
                    </>
                  )}
                  {showLineExtra && (
                    <>
                      <td className="border border-slate-100 p-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          disabled={readOnly}
                          className={inputClass}
                          value={line.extra_percent ?? ""}
                          onChange={(e) =>
                            updateLine(line.clientId, {
                              extra_percent: e.target.value
                                ? Number(e.target.value)
                                : null,
                              extra_amount: 0,
                            })
                          }
                        />
                      </td>
                      <td className="border border-slate-100 p-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={readOnly}
                          className={inputClass}
                          value={
                            line.extra_percent != null && line.extra_percent > 0
                              ? ""
                              : (line.extra_amount ?? "")
                          }
                          onChange={(e) =>
                            updateLine(line.clientId, {
                              extra_amount: e.target.value
                                ? Number(e.target.value)
                                : 0,
                              extra_percent: null,
                            })
                          }
                        />
                      </td>
                    </>
                  )}
                  {showQtyReceived && (
                    <td className="border border-slate-100 p-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        disabled={readOnly}
                        className={inputClass}
                        value={line.qty_received ?? line.quantity}
                        onChange={(e) =>
                          updateLine(line.clientId, {
                            qty_received: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </td>
                  )}
                  {!readOnly && (
                    <td className="border border-slate-100 p-2">
                      <button
                        type="button"
                        onClick={() => removeLine(line.clientId)}
                        className="text-xs text-red-600"
                      >
                        حذف
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={7 + extraCols}
                  className="border border-slate-100 p-4 text-center text-slate-500"
                >
                  لا توجد أسطر مواد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!readOnly && (
          <button
            type="button"
            onClick={addLine}
            className="rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-800"
          >
            + سطر مادة
          </button>
        )}
        <p className="text-sm text-slate-700">
          إجمالي المواد:{" "}
          <span className="font-mono font-semibold">{total.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
