"use client";

import { useMemo } from "react";
import type { MaterialOption, MaterialUnitOption } from "@/modules/invoices/types";
import type { InvoiceMaterialLineInput } from "@/modules/invoices/services/invoice-api";
import {
  computeLineNetAmount,
  resolveMaterialUnitPrice,
} from "@/modules/invoices/utils/invoice-line-utils";
import { lineQuantityBase, stockBalanceKey } from "@/modules/invoices/utils/validate-outbound-stock";
import {
  expiryOptionsFromLots,
  lotBalancesKey,
  serialOptionsFromLots,
  type InventoryLotBalance,
} from "@/modules/invoices/services/invoice-stock-api";
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
  isOutboundStockMovement,
} from "@/modules/materials/utils/material-tracking-utils";
import { materialBomApi } from "@/modules/materials/services/material-bom-api";
import type { ManufacturingLineRole } from "@/modules/invoices/types";

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
  pricingMaterialMode?: string | null;
  readOnly: boolean;
  showQtyReceived?: boolean;
  showLineDiscount?: boolean;
  showLineExtra?: boolean;
  lineTracking?: { track_expiry_on_lines: boolean; track_serial_on_lines: boolean };
  stockBalanceByKey?: Record<string, number>;
  lotsByMwKey?: Record<string, InventoryLotBalance[]>;
  showOutboundStock?: boolean;
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
  manufacturingRole?: ManufacturingLineRole | null,
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
    manufacturing_role: manufacturingRole ?? null,
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
  pricingMaterialMode = null,
  readOnly,
  showQtyReceived = false,
  showLineDiscount = false,
  showLineExtra = false,
  lineTracking = { track_expiry_on_lines: true, track_serial_on_lines: true },
  stockBalanceByKey = {},
  lotsByMwKey = {},
  showOutboundStock = false,
  referenceLineCaps = null,
  lineAttributes,
  onChange,
  onMaterialSelected,
}: InvoiceMaterialLinesTableProps) {
  const isDualRoleKind =
    commercialKind === "manufacturing" || commercialKind === "disassembly";
  const isDisassembly = commercialKind === "disassembly";
  const isManufacturing = commercialKind === "manufacturing";

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

  const produceMaterialOptions = useMemo<SearchSelectOption[]>(
    () =>
      materials
        .filter((m) => {
          if (!m.is_active || m.material_kind !== "composite") return false;
          if (isManufacturing) {
            const mode = m.composite_mode ?? "kit";
            return mode === "finished" || mode === "disassemblable";
          }
          return true;
        })
        .map((m) => ({
          id: m.id,
          label: `${m.material_code} — ${m.name_ar}`,
          searchText: `${m.material_code} ${m.name_ar}`,
        })),
    [materials, isManufacturing],
  );

  const disassemblyConsumeOptions = useMemo<SearchSelectOption[]>(
    () =>
      materials
        .filter(
          (m) =>
            m.is_active &&
            m.material_kind === "composite" &&
            (m.composite_mode ?? "kit") === "disassemblable",
        )
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
    () =>
      lineTracking.track_expiry_on_lines &&
      materials.some((material) =>
        showExpiryOnLine(material, commercialKind, lineTracking),
      ),
    [materials, commercialKind, lineTracking],
  );

  const showSerialColumn = useMemo(
    () =>
      lineTracking.track_serial_on_lines &&
      materials.some((material) =>
        showSerialOnLine(material, commercialKind, lineTracking),
      ),
    [materials, commercialKind, lineTracking],
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

  const addLine = (role?: ManufacturingLineRole) => {
    onChange([
      ...lines,
      newLine(
        {
          branch_id: defaultBranchId,
          cost_center_id: defaultCostCenterId || null,
          warehouse_id: defaultWarehouseId,
        },
        lines.length + 1,
        isDualRoleKind ? (role ?? "consume") : null,
      ),
    ]);
  };

  const loadBomComponents = async () => {
    if (isDisassembly) {
      const consumeLines = lines.filter(
        (l) =>
          l.manufacturing_role === "consume" && l.material_id && l.quantity > 0,
      );
      if (consumeLines.length === 0) {
        window.alert(
          "أضف سطر استهلاك (منتج قابل للتفكيك) أولاً ثم حمّل المكوّنات.",
        );
        return;
      }

      const produceByMaterial = new Map<
        string,
        { quantity: number; unitId: string | null }
      >();

      for (const consume of consumeLines) {
        const unitsForProduce =
          unitsByMaterial[consume.material_id] ??
          (await onMaterialSelected(consume.material_id));
        const produceUnit = unitsForProduce.find(
          (u) => u.id === consume.material_unit_id,
        );
        const produceFactor = produceUnit?.factor_to_base ?? 1;
        const produceQtyBase = consume.quantity * produceFactor;

        const components = await materialBomApi.listComponents(
          consume.material_id,
        );
        if (components.length === 0) {
          const mat = materialById.get(consume.material_id);
          window.alert(
            `المادة «${mat?.name_ar ?? consume.material_id}» بلا مكوّنات في بطاقة التجميع.`,
          );
          continue;
        }
        for (const component of components) {
          const qty = component.quantity * produceQtyBase;
          const prev = produceByMaterial.get(component.component_material_id);
          if (prev) {
            prev.quantity += qty;
          } else {
            produceByMaterial.set(component.component_material_id, {
              quantity: qty,
              unitId: component.component_unit_id,
            });
          }
        }
      }

      if (produceByMaterial.size === 0) return;

      const keepConsume = lines.filter((l) => l.manufacturing_role === "consume");
      const next: DraftMaterialLine[] = [...keepConsume];
      let lineNo = next.length + 1;

      for (const [materialId, info] of produceByMaterial) {
        const units =
          unitsByMaterial[materialId] ?? (await onMaterialSelected(materialId));
        const unit =
          (info.unitId ? units.find((u) => u.id === info.unitId) : undefined) ??
          units.find((u) => u.is_base_unit) ??
          units[0];
        if (!unit) continue;
        const material = materialById.get(materialId);
        next.push({
          ...newLine(
            {
              branch_id: defaultBranchId,
              cost_center_id: defaultCostCenterId || null,
              warehouse_id: defaultWarehouseId,
            },
            lineNo,
            "produce",
          ),
          material_id: materialId,
          material_unit_id: unit.id,
          quantity: Math.round(info.quantity * 1_000_000) / 1_000_000,
          qty_damaged: 0,
          unit_price: material
            ? resolveMaterialUnitPrice(
                pricingMaterialMode,
                material,
                unit,
                commercialKind,
              )
            : 0,
        });
        lineNo += 1;
      }

      onChange(next.map((line, index) => ({ ...line, line_no: index + 1 })));
      return;
    }

    const produceLines = lines.filter(
      (l) => l.manufacturing_role === "produce" && l.material_id && l.quantity > 0,
    );
    if (produceLines.length === 0) {
      window.alert("أضف سطر إنتاج (مادة تجميعية) أولاً ثم حمّل المكوّنات.");
      return;
    }

    const consumeByMaterial = new Map<
      string,
      { quantity: number; unitId: string | null }
    >();

    for (const produce of produceLines) {
      const unitsForProduce =
        unitsByMaterial[produce.material_id] ??
        (await onMaterialSelected(produce.material_id));
      const produceUnit = unitsForProduce.find(
        (u) => u.id === produce.material_unit_id,
      );
      const produceFactor = produceUnit?.factor_to_base ?? 1;
      const produceQtyBase = produce.quantity * produceFactor;

      const components = await materialBomApi.listComponents(produce.material_id);
      if (components.length === 0) {
        const mat = materialById.get(produce.material_id);
        window.alert(
          `المادة «${mat?.name_ar ?? produce.material_id}» بلا مكوّنات في بطاقة التجميع.`,
        );
        continue;
      }
      for (const component of components) {
        const qty = component.quantity * produceQtyBase;
        const prev = consumeByMaterial.get(component.component_material_id);
        if (prev) {
          prev.quantity += qty;
        } else {
          consumeByMaterial.set(component.component_material_id, {
            quantity: qty,
            unitId: component.component_unit_id,
          });
        }
      }
    }

    if (consumeByMaterial.size === 0) return;

    const keepProduce = lines.filter((l) => l.manufacturing_role === "produce");
    const next: DraftMaterialLine[] = [...keepProduce];
    let lineNo = next.length + 1;

    for (const [materialId, info] of consumeByMaterial) {
      const units =
        unitsByMaterial[materialId] ?? (await onMaterialSelected(materialId));
      const unit =
        (info.unitId
          ? units.find((u) => u.id === info.unitId)
          : undefined) ??
        units.find((u) => u.is_base_unit) ??
        units[0];
      if (!unit) continue;
      const material = materialById.get(materialId);
      next.push({
        ...newLine(
          {
            branch_id: defaultBranchId,
            cost_center_id: defaultCostCenterId || null,
            warehouse_id: defaultWarehouseId,
          },
          lineNo,
          "consume",
        ),
        material_id: materialId,
        material_unit_id: unit.id,
        quantity: Math.round(info.quantity * 1_000_000) / 1_000_000,
        unit_price: material
          ? resolveMaterialUnitPrice(
              pricingMaterialMode,
              material,
              unit,
              commercialKind,
            )
          : 0,
      });
      lineNo += 1;
    }

    onChange(next.map((line, index) => ({ ...line, line_no: index + 1 })));
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
    const unitPrice = resolveMaterialUnitPrice(
      pricingMaterialMode,
      material,
      baseUnit,
      commercialKind,
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
      unit_price: resolveMaterialUnitPrice(
        pricingMaterialMode,
        material,
        unit,
        commercialKind,
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
    (isDualRoleKind ? 1 : 0) +
    (isDisassembly ? 1 : 0) +
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
              {isDualRoleKind && (
                <th className="border border-slate-200 p-2">الدور</th>
              )}
              <th className="border border-slate-200 p-2">المادة</th>
              <th className="border border-slate-200 p-2">الوحدة</th>
              <th className="border border-slate-200 p-2">المستودع</th>
              <th className="border border-slate-200 p-2">الكمية</th>
              {isDisassembly && (
                <th className="border border-slate-200 p-2">تالف</th>
              )}
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
                <th className="border border-slate-200 p-2">تاريخ انتهاء الصلاحية</th>
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
                isExpiryRequiredOnLine(
                  material,
                  commercialKind,
                  line.manufacturing_role,
                );
              const serialRequired =
                material != null &&
                isSerialRequiredOnLine(
                  material,
                  commercialKind,
                  line.manufacturing_role,
                );
              const amount = computeLineNetAmount(
                line.quantity,
                line.unit_price,
                line.discount_percent,
                line.discount_amount,
                line.extra_percent,
                line.extra_amount,
              );
              const stockKey =
                line.material_id && line.warehouse_id
                  ? stockBalanceKey(line.material_id, line.warehouse_id)
                  : null;
              const availableStock =
                stockKey != null ? (stockBalanceByKey[stockKey] ?? 0) : null;
              const lineQtyBase = showOutboundStock
                ? lineQuantityBase(line, unitsByMaterial)
                : 0;
              const stockInsufficient =
                showOutboundStock &&
                availableStock != null &&
                lineQtyBase > availableStock + 0.000001 &&
                (!isDualRoleKind || line.manufacturing_role === "consume");
              const outbound = isOutboundStockMovement(
                commercialKind,
                line.manufacturing_role,
              );
              const mwLotKey =
                line.material_id && line.warehouse_id
                  ? lotBalancesKey(line.material_id, line.warehouse_id)
                  : null;
              const lineLots = mwLotKey ? (lotsByMwKey[mwLotKey] ?? []) : [];
              const expiryOpts =
                outbound && material?.has_expiry_date
                  ? expiryOptionsFromLots(lineLots)
                  : [];
              const serialOpts =
                outbound && material?.has_serial_number
                  ? serialOptionsFromLots(lineLots)
                  : [];
              const selectedExpiryQty =
                line.expiry_date && outbound
                  ? expiryOpts.find((o) => o.expiry_date === line.expiry_date)
                      ?.quantity_base
                  : null;
              const selectedSerialLot =
                line.serial_number && outbound
                  ? serialOpts.find((o) => o.serial_number === line.serial_number)
                  : null;

              const materialSelectOptions = isDisassembly
                ? line.manufacturing_role === "consume"
                  ? disassemblyConsumeOptions
                  : materialOptions
                : line.manufacturing_role === "produce"
                  ? produceMaterialOptions
                  : materialOptions;

              return (
                <tr key={line.clientId} className="odd:bg-white even:bg-slate-50/60">
                  <td className="border border-slate-100 p-2">{line.line_no}</td>
                  {isDualRoleKind && (
                    <td className="border border-slate-100 p-2 min-w-[110px]">
                      <select
                        disabled={readOnly}
                        className={inputClass}
                        value={line.manufacturing_role ?? "consume"}
                        onChange={(e) =>
                          updateLine(line.clientId, {
                            manufacturing_role: e.target.value as ManufacturingLineRole,
                            material_id: "",
                            material_unit_id: "",
                            unit_price: 0,
                            qty_damaged: isDisassembly ? 0 : null,
                          })
                        }
                      >
                        <option value="consume">
                          {isDisassembly ? "منتج للتفكيك" : "استهلاك"}
                        </option>
                        <option value="produce">
                          {isDisassembly ? "مكوّن مسترد" : "إنتاج"}
                        </option>
                      </select>
                    </td>
                  )}
                  <td className="border border-slate-100 p-2 min-w-[220px]">
                    <SearchSelectField
                      label="المادة"
                      hideLabel
                      placeholder="اختر مادة..."
                      options={materialSelectOptions}
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
                    {showOutboundStock &&
                      line.material_id &&
                      line.warehouse_id &&
                      availableStock != null && (
                        <p
                          className={`mt-0.5 text-xs ${
                            stockInsufficient ? "text-red-700" : "text-slate-500"
                          }`}
                        >
                          المتاح: {availableStock.toFixed(4)}
                          {stockInsufficient && " — يتجاوز الرصيد"}
                        </p>
                      )}
                  </td>
                  {isDisassembly && (
                    <td className="border border-slate-100 p-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        disabled={
                          readOnly || line.manufacturing_role !== "produce"
                        }
                        className={inputClass}
                        title="كمية تالفة لا تُعاد للمخزون"
                        value={
                          line.manufacturing_role === "produce"
                            ? (line.qty_damaged ?? 0)
                            : ""
                        }
                        onChange={(e) =>
                          updateLine(line.clientId, {
                            qty_damaged: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                  )}
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
                      {showExpiryOnLine(
                        material,
                        commercialKind,
                        lineTracking,
                        line.manufacturing_role,
                      ) ? (
                        outbound && material?.has_expiry_date && expiryOpts.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            <select
                              disabled={readOnly}
                              required={expiryRequired}
                              className={inputClass}
                              value={line.expiry_date ?? ""}
                              onChange={(e) =>
                                updateLine(line.clientId, {
                                  expiry_date: e.target.value || null,
                                })
                              }
                            >
                              <option value="">— اختر دفعة —</option>
                              {expiryOpts.map((opt) => (
                                <option key={opt.expiry_date} value={opt.expiry_date}>
                                  {opt.expiry_date} ({opt.quantity_base.toFixed(2)})
                                </option>
                              ))}
                            </select>
                            {selectedExpiryQty != null && (
                              <span className="text-xs text-slate-500">
                                متاح للدفعة: {selectedExpiryQty.toFixed(4)}
                              </span>
                            )}
                          </div>
                        ) : (
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
                        )
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  )}
                  {showSerialColumn && (
                    <td className="border border-slate-100 p-2">
                      {showSerialOnLine(
                        material,
                        commercialKind,
                        lineTracking,
                        line.manufacturing_role,
                      ) ? (
                        outbound &&
                        material?.has_serial_number &&
                        serialOpts.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            <select
                              disabled={readOnly}
                              required={serialRequired}
                              className={`${inputClass} font-mono`}
                              value={line.serial_number ?? ""}
                              onChange={(e) => {
                                const serial = e.target.value || null;
                                const lot = serialOpts.find(
                                  (row) => row.serial_number === serial,
                                );
                                updateLine(line.clientId, {
                                  serial_number: serial,
                                  expiry_date:
                                    lot?.expiry_date ?? line.expiry_date ?? null,
                                });
                              }}
                            >
                              <option value="">— اختر —</option>
                              {serialOpts.map((opt) => (
                                <option
                                  key={opt.serial_number ?? ""}
                                  value={opt.serial_number ?? ""}
                                >
                                  {opt.serial_number} ({opt.quantity_base.toFixed(2)})
                                </option>
                              ))}
                            </select>
                            {selectedSerialLot && (
                              <span className="text-xs text-slate-500">
                                {selectedSerialLot.expiry_date
                                  ? `صلاحية: ${selectedSerialLot.expiry_date}`
                                  : "بدون تاريخ صلاحية"}
                              </span>
                            )}
                          </div>
                        ) : (
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
                        )
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
          <div className="flex flex-wrap gap-2">
            {isDualRoleKind ? (
              <>
                <button
                  type="button"
                  onClick={() => addLine("consume")}
                  className="rounded-md border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-900"
                >
                  {isDisassembly ? "+ منتج للتفكيك" : "+ سطر استهلاك"}
                </button>
                <button
                  type="button"
                  onClick={() => addLine("produce")}
                  className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-900"
                >
                  {isDisassembly ? "+ مكوّن مسترد" : "+ سطر إنتاج"}
                </button>
                <button
                  type="button"
                  onClick={() => void loadBomComponents()}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800"
                >
                  تحميل مكوّنات من البطاقة
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => addLine()}
                className="rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-800"
              >
                + سطر مادة
              </button>
            )}
          </div>
        )}
        <p className="text-sm text-slate-700">
          إجمالي المواد:{" "}
          <span className="font-mono font-semibold">{total.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
