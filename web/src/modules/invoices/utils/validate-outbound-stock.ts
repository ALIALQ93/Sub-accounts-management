import type { DraftMaterialLine } from "@/modules/invoices/components/invoice-material-lines-table";
import type { MaterialOption, MaterialUnitOption } from "@/modules/invoices/types";
import type { InventoryLotBalance } from "@/modules/invoices/services/invoice-stock-api";
import {
  expiryOptionsFromLots,
  lotBalancesKey,
} from "@/modules/invoices/services/invoice-stock-api";
import { isOutboundStockMovement } from "@/modules/materials/utils/material-tracking-utils";

export function stockBalanceKey(materialId: string, warehouseId: string): string {
  return `${materialId}|${warehouseId}`;
}

export function expiryLotKey(
  materialId: string,
  warehouseId: string,
  expiryDate: string,
): string {
  return `${materialId}|${warehouseId}|exp|${expiryDate}`;
}

export function serialLotKey(
  materialId: string,
  warehouseId: string,
  serialNumber: string,
): string {
  return `${materialId}|${warehouseId}|sn|${serialNumber.trim().toLowerCase()}`;
}

export function lineQuantityBase(
  line: Pick<DraftMaterialLine, "quantity" | "material_id" | "material_unit_id">,
  unitsByMaterial: Record<string, MaterialUnitOption[]>,
): number {
  if (!line.material_id || !line.material_unit_id) return 0;
  const unit = (unitsByMaterial[line.material_id] ?? []).find(
    (row) => row.id === line.material_unit_id,
  );
  const factor = unit?.factor_to_base ?? 1;
  return Math.round(line.quantity * factor * 1000000) / 1000000;
}

export function buildExpiryBalanceMap(
  lotsByMwKey: Record<string, InventoryLotBalance[]>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [mwKey, lots] of Object.entries(lotsByMwKey)) {
    const [materialId, warehouseId] = mwKey.split("|");
    for (const opt of expiryOptionsFromLots(lots)) {
      map[expiryLotKey(materialId, warehouseId, opt.expiry_date)] = opt.quantity_base;
    }
  }
  return map;
}

export function buildSerialBalanceMap(
  lotsByMwKey: Record<string, InventoryLotBalance[]>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [mwKey, lots] of Object.entries(lotsByMwKey)) {
    const [materialId, warehouseId] = mwKey.split("|");
    for (const lot of lots) {
      if (!lot.serial_number) continue;
      map[serialLotKey(materialId, warehouseId, lot.serial_number)] =
        lot.quantity_base;
    }
  }
  return map;
}

export function validateOutboundStockLines(params: {
  commercialKind: string;
  enforceStockAvailability: boolean;
  forPost: boolean;
  lines: DraftMaterialLine[];
  materials: MaterialOption[];
  unitsByMaterial: Record<string, MaterialUnitOption[]>;
  balanceByKey: Record<string, number>;
  expiryBalanceByKey?: Record<string, number>;
  serialBalanceByKey?: Record<string, number>;
  materialLabelById?: Record<string, string>;
}): string | null {
  const {
    commercialKind,
    enforceStockAvailability,
    forPost,
    lines,
    materials,
    unitsByMaterial,
    balanceByKey,
    expiryBalanceByKey = {},
    serialBalanceByKey = {},
    materialLabelById = {},
  } = params;

  if (!forPost || !enforceStockAvailability || !isOutboundStockMovement(commercialKind)) {
    return null;
  }

  const materialById = new Map(materials.map((m) => [m.id, m]));
  const demandByKey = new Map<string, number>();
  const lineNosByKey = new Map<string, number[]>();
  const expiryDemand = new Map<string, number>();
  const expiryLineNos = new Map<string, number[]>();
  const serialDemand = new Map<string, number>();
  const serialLineNos = new Map<string, number[]>();
  const serialsUsed = new Map<string, number>();

  for (const line of lines) {
    if (!line.material_id || !line.warehouse_id || line.quantity <= 0) continue;

    const material = materialById.get(line.material_id);
    // المواد التجميعية تُفكّك على الخادم إلى مكوّنات — لا نفحص رصيد الأب
    if (material?.material_kind === "composite") continue;

    const qtyBase = lineQuantityBase(line, unitsByMaterial);
    const mwKey = stockBalanceKey(line.material_id, line.warehouse_id);

    demandByKey.set(mwKey, (demandByKey.get(mwKey) ?? 0) + qtyBase);
    const mwNos = lineNosByKey.get(mwKey) ?? [];
    mwNos.push(line.line_no);
    lineNosByKey.set(mwKey, mwNos);

    if (material?.has_expiry_date && line.expiry_date) {
      const eKey = expiryLotKey(line.material_id, line.warehouse_id, line.expiry_date);
      expiryDemand.set(eKey, (expiryDemand.get(eKey) ?? 0) + qtyBase);
      const eNos = expiryLineNos.get(eKey) ?? [];
      eNos.push(line.line_no);
      expiryLineNos.set(eKey, eNos);
    }

    const serial = line.serial_number?.trim();
    if (material?.has_serial_number && serial) {
      const sKey = serialLotKey(line.material_id, line.warehouse_id, serial);
      serialDemand.set(sKey, (serialDemand.get(sKey) ?? 0) + qtyBase);
      const sNos = serialLineNos.get(sKey) ?? [];
      sNos.push(line.line_no);
      serialLineNos.set(sKey, sNos);

      const dupKey = serial.toLowerCase();
      serialsUsed.set(dupKey, (serialsUsed.get(dupKey) ?? 0) + 1);
      if ((serialsUsed.get(dupKey) ?? 0) > 1) {
        return `الرقم التسلسلي «${serial}» مكرر في أكثر من سطر.`;
      }
    }
  }

  for (const [key, demand] of demandByKey) {
    const available = balanceByKey[key] ?? 0;
    if (demand > available + 0.000001) {
      const materialId = key.split("|")[0];
      const label = materialLabelById[materialId] ?? materialId;
      const lineNos = (lineNosByKey.get(key) ?? []).join("، ");
      return `الرصيد غير كافٍ للمادة «${label}» — المتاح ${available.toFixed(4)} والمطلوب ${demand.toFixed(4)} (أسطر: ${lineNos}).`;
    }
  }

  for (const [key, demand] of expiryDemand) {
    const available = expiryBalanceByKey[key] ?? 0;
    if (demand > available + 0.000001) {
      const expiry = key.split("|exp|")[1] ?? key;
      const materialId = key.split("|")[0];
      const label = materialLabelById[materialId] ?? materialId;
      const lineNos = (expiryLineNos.get(key) ?? []).join("، ");
      return `رصيد تاريخ الصلاحية ${expiry} غير كافٍ للمادة «${label}» — المتاح ${available.toFixed(4)} والمطلوب ${demand.toFixed(4)} (أسطر: ${lineNos}).`;
    }
  }

  for (const [key, demand] of serialDemand) {
    const available = serialBalanceByKey[key] ?? 0;
    if (demand > available + 0.000001) {
      const serial = key.split("|sn|")[1] ?? key;
      const materialId = key.split("|")[0];
      const label = materialLabelById[materialId] ?? materialId;
      const lineNos = (serialLineNos.get(key) ?? []).join("، ");
      return `الرقم التسلسلي «${serial}» غير متوفر للمادة «${label}» — المتاح ${available.toFixed(4)} (أسطر: ${lineNos}).`;
    }
  }

  return null;
}

export function buildStockBalanceMap(
  rows: Array<{ material_id: string; warehouse_id: string; quantity_base: number }>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const key = stockBalanceKey(row.material_id, row.warehouse_id);
    map[key] = row.quantity_base;
  }
  return map;
}

export { lotBalancesKey };
