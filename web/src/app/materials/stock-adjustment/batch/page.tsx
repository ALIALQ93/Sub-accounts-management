"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DocumentActionLinks } from "@/components/open-in-new-tab-link";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { materialApi } from "@/modules/materials/services/material-api";
import { stockAdjustmentApi } from "@/modules/materials/services/stock-adjustment-api";
import { warehouseApi } from "@/modules/materials/services/warehouse-api";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

interface BatchLine {
  key: string;
  materialId: string;
  warehouseId: string;
  countedQty: string;
  systemQty: number | null;
}

function newLine(): BatchLine {
  return {
    key: crypto.randomUUID(),
    materialId: "",
    warehouseId: "",
    countedQty: "",
    systemQty: null,
  };
}

export default function BatchStockAdjustmentPage() {
  const { hasPermission } = useAuth();
  const canPost = hasPermission("materials.edit");

  const [materials, setMaterials] = useState<
    Awaited<ReturnType<typeof materialApi.listMaterials>>
  >([]);
  const [warehouses, setWarehouses] = useState<
    Awaited<ReturnType<typeof warehouseApi.listWarehouses>>
  >([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<BatchLine[]>([newLine(), newLine()]);
  const [adjustmentDate, setAdjustmentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [inventoryAccountId, setInventoryAccountId] = useState("");
  const [adjustmentAccountId, setAdjustmentAccountId] = useState("");
  const [description, setDescription] = useState("تسوية جرد مجمّعة");

  const [isLoading, setIsLoading] = useState(true);
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

  const loadSystemQty = useCallback(
    async (line: BatchLine) => {
      if (!line.materialId || !line.warehouseId) return null;
      return stockAdjustmentApi.getSystemBalance(
        line.materialId,
        line.warehouseId,
        adjustmentDate || undefined,
      );
    },
    [adjustmentDate],
  );

  const updateLine = (key: string, patch: Partial<BatchLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const refreshLineBalance = async (key: string) => {
    const line = lines.find((item) => item.key === key);
    if (!line?.materialId || !line.warehouseId) return;
    const qty = await loadSystemQty(line);
    updateLine(key, { systemQty: qty });
  };

  const validLines = useMemo(
    () =>
      lines.filter((line) => {
        const counted = Number(line.countedQty);
        return (
          line.materialId &&
          line.warehouseId &&
          Number.isFinite(counted) &&
          counted >= 0 &&
          line.systemQty != null &&
          Math.abs(counted - line.systemQty) >= 0.000001
        );
      }),
    [lines],
  );

  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );

  const distinctBranchCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const line of validLines) {
      const warehouse = warehouseById.get(line.warehouseId);
      if (warehouse?.branch_code) codes.add(warehouse.branch_code);
    }
    return [...codes];
  }, [validLines, warehouseById]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canPost) return;

    if (!inventoryAccountId || !adjustmentAccountId) {
      setError("حساب المخزون وحساب فروقات الجرد مطلوبان.");
      return;
    }
    if (validLines.length === 0) {
      setError("أضف سطراً واحداً على الأقل بفرق كمية.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");
    setLastJournalId("");

    try {
      const result = await stockAdjustmentApi.postBatchAdjustment({
        lines: validLines.map((line) => ({
          materialId: line.materialId,
          warehouseId: line.warehouseId,
          countedQuantityBase: Number(line.countedQty),
        })),
        inventoryAccountId,
        adjustmentAccountId,
        adjustmentDate,
        description,
      });
      setSuccess(
        `تم ترحيل ${result.applied_lines} سطر/أسطر في قيد واحد (${result.entry_no})${
          result.branch_count > 1
            ? ` — ${result.branch_count} فروع`
            : ""
        }.`,
      );
      setLastJournalId(result.journal_entry_id);
      setLines([newLine(), newLine()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التسوية المجمّعة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">تسوية جرد مجمّعة</h1>
      <p className="mb-4 text-sm text-slate-600">
        عدة مواد في{" "}
        <strong>قيد واحد</strong> — يدعم مستودعات من فروع مختلفة (سطور القيد
        per فرع). أو{" "}
        <Link href="/materials/stock-adjustment/new" className="text-blue-800 underline">
          تسوية سطر واحد
        </Link>
        .
      </p>
      <MaterialsNav />

      {isLoading && (
        <p className="mt-4 text-sm text-slate-600">جاري التحميل...</p>
      )}

      {!isLoading && (
        <form
          onSubmit={onSubmit}
          className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 md:grid-cols-3">
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
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[880px]">
              <thead>
                <tr>
                  <th>المادة</th>
                  <th>المستودع</th>
                  <th>الفرع</th>
                  <th>نظامي</th>
                  <th>فعلي</th>
                  <th>فرق</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const counted = Number(line.countedQty);
                  const delta =
                    line.systemQty != null && Number.isFinite(counted)
                      ? counted - line.systemQty
                      : null;
                  const warehouse = warehouseById.get(line.warehouseId);
                  return (
                    <tr key={line.key}>
                      <td>
                        <select
                          value={line.materialId}
                          onChange={(e) => {
                            updateLine(line.key, {
                              materialId: e.target.value,
                              systemQty: null,
                            });
                          }}
                          onBlur={() => void refreshLineBalance(line.key)}
                          disabled={isSaving}
                          className="w-full rounded border border-slate-300 px-2 py-1"
                        >
                          <option value="">—</option>
                          {materials.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.material_code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={line.warehouseId}
                          onChange={(e) => {
                            updateLine(line.key, {
                              warehouseId: e.target.value,
                              systemQty: null,
                            });
                          }}
                          onBlur={() => void refreshLineBalance(line.key)}
                          disabled={isSaving}
                          className="w-full rounded border border-slate-300 px-2 py-1"
                        >
                          <option value="">—</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.warehouse_code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="font-mono text-xs">
                        {warehouse?.branch_code ?? "—"}
                      </td>
                      <td className="font-mono text-xs tabular-nums">
                        {line.systemQty == null ? "—" : line.systemQty.toFixed(4)}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.000001"
                          value={line.countedQty}
                          onChange={(e) =>
                            updateLine(line.key, { countedQty: e.target.value })
                          }
                          disabled={isSaving}
                          className="w-full rounded border border-slate-300 px-2 py-1 font-mono tabular-nums"
                        />
                      </td>
                      <td className="font-mono text-xs tabular-nums">
                        {delta == null ? "—" : delta.toFixed(4)}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setLines((current) =>
                              current.filter((item) => item.key !== line.key),
                            )
                          }
                          disabled={isSaving || lines.length <= 1}
                          className="text-xs text-[var(--danger)] disabled:opacity-40"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => setLines((current) => [...current, newLine()])}
            disabled={isSaving}
            className="btn btn-sm btn-outline w-fit"
          >
            + سطر
          </button>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1 text-sm">
              <span className="font-medium">حساب المخزون *</span>
              <AccountSearchField
                accounts={accounts}
                value={inventoryAccountId}
                onChange={setInventoryAccountId}
                disabled={!canPost || isSaving}
              />
            </div>
            <div className="grid gap-1 text-sm">
              <span className="font-medium">حساب فروقات الجرد *</span>
              <AccountSearchField
                accounts={accounts}
                value={adjustmentAccountId}
                onChange={setAdjustmentAccountId}
                disabled={!canPost || isSaving}
              />
            </div>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">ملاحظة</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <p className="text-xs text-slate-500">
            أسطر جاهزة للترحيل: {validLines.length}
            {distinctBranchCodes.length > 1 && (
              <span className="mr-2 text-amber-800">
                — {distinctBranchCodes.length} فروع:{" "}
                {distinctBranchCodes.join("، ")}
              </span>
            )}
          </p>

          {distinctBranchCodes.length > 1 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              التسوية تشمل عدة فروع — يُنشأ قيد واحد بسطور لكل فرع. تأكد أن
              الفترات المحاسبية مفتوحة لكل فرع في تاريخ التسوية.
            </p>
          )}

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
              disabled={isSaving}
              className="btn btn-primary w-fit"
            >
              {isSaving ? "جاري الترحيل..." : "ترحيل التسوية المجمّعة"}
            </button>
          )}
        </form>
      )}
    </main>
  );
}
