"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DocumentActionLinks } from "@/components/open-in-new-tab-link";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { materialApi } from "@/modules/materials/services/material-api";
import { stockAdjustmentApi } from "@/modules/materials/services/stock-adjustment-api";
import { warehouseApi } from "@/modules/materials/services/warehouse-api";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

export default function StockAdjustmentPage() {
  const { hasPermission } = useAuth();
  const canPost = hasPermission("materials.edit");

  const [materials, setMaterials] = useState<
    Awaited<ReturnType<typeof materialApi.listMaterials>>
  >([]);
  const [warehouses, setWarehouses] = useState<
    Awaited<ReturnType<typeof warehouseApi.listWarehouses>>
  >([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [baseUnitName, setBaseUnitName] = useState("وحدة أساس");

  const [materialId, setMaterialId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [countedQty, setCountedQty] = useState("");
  const [systemQty, setSystemQty] = useState<number | null>(null);
  const [adjustmentDate, setAdjustmentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [inventoryAccountId, setInventoryAccountId] = useState("");
  const [adjustmentAccountId, setAdjustmentAccountId] = useState("");
  const [description, setDescription] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastJournalId, setLastJournalId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      materialApi.listMaterials(),
      warehouseApi.listWarehouses(),
      voucherApi.listAllAccounts(),
    ])
      .then(([materialsData, warehousesData, accountsData]) => {
        if (!cancelled) {
          setMaterials(materialsData.filter((m) => m.is_active));
          setWarehouses(warehousesData.filter((w) => w.is_active));
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

  useEffect(() => {
    if (!materialId) {
      setBaseUnitName("وحدة أساس");
      return;
    }
    let cancelled = false;
    void materialApi.listMaterialUnits(materialId).then((units) => {
      if (cancelled) return;
      const base = units.find((unit) => unit.is_base_unit);
      setBaseUnitName(base?.name_ar ?? "وحدة أساس");
    });
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  useEffect(() => {
    if (!materialId || !warehouseId) {
      setSystemQty(null);
      return;
    }

    let cancelled = false;
    setIsLookingUp(true);
    void stockAdjustmentApi
      .getSystemBalance(materialId, warehouseId, adjustmentDate || undefined)
      .then((qty) => {
        if (!cancelled) setSystemQty(qty);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل قراءة الرصيد.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLookingUp(false);
      });

    return () => {
      cancelled = true;
    };
  }, [materialId, warehouseId, adjustmentDate]);

  const countedNumber = useMemo(() => {
    const value = Number(countedQty);
    return Number.isFinite(value) ? value : null;
  }, [countedQty]);

  const delta = useMemo(() => {
    if (systemQty == null || countedNumber == null) return null;
    return countedNumber - systemQty;
  }, [systemQty, countedNumber]);

  const selectedMaterial = materials.find((m) => m.id === materialId);

  useEffect(() => {
    if (selectedMaterial?.inventory_account_id && !inventoryAccountId) {
      setInventoryAccountId(selectedMaterial.inventory_account_id);
    }
  }, [selectedMaterial, inventoryAccountId]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canPost) return;

    if (!materialId || !warehouseId || countedNumber == null) {
      setError("المادة والمستودع والكمية الفعلية مطلوبة.");
      return;
    }
    if (countedNumber < 0) {
      setError("الكمية الفعلية لا يمكن أن تكون سالبة.");
      return;
    }
    if (!inventoryAccountId || !adjustmentAccountId) {
      setError("حساب المخزون وحساب فروقات الجرد مطلوبان.");
      return;
    }
    if (delta === 0) {
      setError("لا يوجد فرق بين العدّ الفعلي والرصيد النظامي.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");
    setLastJournalId("");

    try {
      const result = await stockAdjustmentApi.postAdjustment({
        materialId,
        warehouseId,
        countedQuantityBase: countedNumber,
        inventoryAccountId,
        adjustmentAccountId,
        adjustmentDate,
        description,
      });
      setSuccess(
        `تمت التسوية — فرق ${result.delta_quantity_base.toFixed(4)} بقيمة ${result.adjustment_amount.toFixed(2)}`,
      );
      setLastJournalId(result.journal_entry_id);
      setSystemQty(result.counted_quantity_base);
      setCountedQty("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل ترحيل التسوية.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">تسوية جردية</h1>
      <MaterialsNav />

      <p className="mt-4 text-sm text-slate-600">
        أدخل الكمية الفعلية بعد العدّ — يُرحَّل قيد فروقات + حركة{" "}
        <code className="text-xs">adjustment</code>. للرصيد الحالي راجع{" "}
        <Link href="/reports/inventory-balance" className="text-blue-800 underline">
          تقرير المخزون
        </Link>
        . لعدّ عدة مواد في قيد واحد استخدم{" "}
        <Link href="/materials/stock-adjustment/batch" className="text-blue-800 underline">
          تسوية مجمّعة
        </Link>
        .
      </p>

      {isLoading && (
        <p className="mt-4 text-sm text-slate-600">جاري التحميل...</p>
      )}

      {!isLoading && (
        <form
          onSubmit={onSubmit}
          className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">المادة *</span>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                disabled={isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              >
                <option value="">— اختر —</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.material_code} — {material.name_ar}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">المستودع *</span>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                disabled={isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              >
                <option value="">— اختر —</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouse_code} — {warehouse.name_ar}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">تاريخ التسوية</span>
              <input
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                disabled={isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">الكمية الفعلية ({baseUnitName}) *</span>
              <input
                type="number"
                min={0}
                step="0.000001"
                value={countedQty}
                onChange={(e) => setCountedQty(e.target.value)}
                disabled={isSaving}
                className="rounded-md border border-slate-300 px-3 py-2 font-mono"
                required
              />
            </label>
          </div>

          {materialId && warehouseId && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p>
                الرصيد النظامي:{" "}
                <span className="font-mono font-semibold tabular-nums">
                  {isLookingUp
                    ? "..."
                    : systemQty != null
                      ? systemQty.toFixed(4)
                      : "—"}
                </span>
              </p>
              {delta != null && countedNumber != null && (
                <p className="mt-1">
                  الفرق:{" "}
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      delta > 0
                        ? "text-[var(--success)]"
                        : delta < 0
                          ? "text-[var(--danger)]"
                          : "text-slate-700"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(4)}
                  </span>
                  {delta > 0 && " (فائض)"}
                  {delta < 0 && " (عجز)"}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3">
            <div className="grid gap-1 text-sm">
              <span className="font-medium">حساب المخزون *</span>
              <AccountSearchField
                accounts={accounts}
                value={inventoryAccountId}
                onChange={(accountId) => setInventoryAccountId(accountId)}
                disabled={!canPost || isSaving}
                placeholder="حساب مخزون"
              />
            </div>
            <div className="grid gap-1 text-sm">
              <span className="font-medium">حساب فروقات الجرد *</span>
              <AccountSearchField
                accounts={accounts}
                value={adjustmentAccountId}
                onChange={(accountId) => setAdjustmentAccountId(accountId)}
                disabled={!canPost || isSaving}
                placeholder="مصروف/إيراد فروقات الجرد"
              />
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">ملاحظة</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="اختياري"
              />
            </label>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          {success && (
            <div className="text-sm text-[var(--success)]">
              <p>{success}</p>
              {lastJournalId && (
                <DocumentActionLinks
                  href={`/journals/${lastJournalId}`}
                  openLabel="فتح القيد"
                />
              )}
            </div>
          )}

          {canPost && (
            <button
              type="submit"
              disabled={isSaving || isLookingUp}
              className="btn btn-primary w-fit"
            >
              {isSaving ? "جاري الترحيل..." : "ترحيل التسوية"}
            </button>
          )}
        </form>
      )}
    </main>
  );
}
