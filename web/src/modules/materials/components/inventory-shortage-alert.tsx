"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { materialApi } from "@/modules/materials/services/material-api";
import { warehouseMaterialLimitsApi } from "@/modules/materials/services/warehouse-material-limits-api";
import { inventoryReportApi } from "@/modules/reports/services/inventory-report-api";

const PREVIEW_LIMIT = 5;

export function InventoryShortageAlert() {
  const [count, setCount] = useState(0);
  const [preview, setPreview] = useState<
    Awaited<ReturnType<typeof inventoryReportApi.listAnalysisRows>>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      materialApi.listMaterials(),
      warehouseMaterialLimitsApi.listAll(),
      inventoryReportApi.listBalanceRows({ hideZero: false }),
    ])
      .then(async ([materials, warehouseLimits, balanceRows]) => {
        if (cancelled) return;

        let shortageRows: Awaited<
          ReturnType<typeof inventoryReportApi.listAnalysisRows>
        > = [];

        try {
          const analysisRows = await inventoryReportApi.listAnalysisRows({
            shortageMaxQty: 0,
            stagnantDays: 90,
          });
          shortageRows = analysisRows.filter(
            (row) => row.analysis_kind === "shortage",
          );
        } catch {
          shortageRows = inventoryReportApi.listBelowMinStockRows(
            balanceRows,
            materials,
            warehouseLimits,
          );
        }

        if (!cancelled) {
          setCount(shortageRows.length);
          setPreview(shortageRows.slice(0, PREVIEW_LIMIT));
        }
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || unavailable || count === 0) {
    return null;
  }

  return (
    <section className="no-print rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            تنبيه مخزون: {count} مادة/مستودع تحت الحد الأدنى
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {preview.map((row) => (
              <li key={`${row.material_id}-${row.warehouse_id}`}>
                <span className="font-mono">{row.material_code}</span> @{" "}
                {row.warehouse_code} — كمية {row.quantity_base.toFixed(4)}
                {row.min_stock != null && row.min_stock > 0 && (
                  <span> (حد {row.min_stock.toFixed(4)})</span>
                )}
              </li>
            ))}
            {count > PREVIEW_LIMIT && (
              <li className="text-amber-800">+ {count - PREVIEW_LIMIT} أخرى</li>
            )}
          </ul>
        </div>
        <Link
          href="/reports/inventory-balance?view=analysis"
          className="shrink-0 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          عرض التقرير
        </Link>
      </div>
    </section>
  );
}
