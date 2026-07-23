"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { transferApi } from "@/modules/invoices/services/transfer-api";
import type { InventoryTransferListItem } from "@/modules/invoices/types";

/** أيام بعد الشحن/التحديث قبل اعتبار المناقلة «عالقة» */
const STUCK_AFTER_DAYS = 3;
const PREVIEW_LIMIT = 5;

const OPEN_STATUSES = new Set([
  "dispatched",
  "in_transit",
  "partially_received",
]);

function isStuck(item: InventoryTransferListItem, nowMs: number): boolean {
  if (!OPEN_STATUSES.has(item.status)) return false;
  const anchor = Date.parse(item.created_at);
  if (Number.isNaN(anchor)) return false;
  return nowMs - anchor >= STUCK_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

const STATUS_LABEL: Record<string, string> = {
  dispatched: "مشحونة",
  in_transit: "في الطريق",
  partially_received: "استلام جزئي",
};

export function StuckTransfersAlert() {
  const [items, setItems] = useState<InventoryTransferListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void transferApi
      .listTransfers()
      .then((rows) => {
        if (cancelled) return;
        const now = Date.now();
        setItems(rows.filter((row) => isStuck(row, now)));
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

  if (isLoading || unavailable || items.length === 0) {
    return null;
  }

  const preview = items.slice(0, PREVIEW_LIMIT);

  return (
    <section className="no-print rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            تنبيه مناقلات عالقة: {items.length} مناقلة لم تُستلم منذ{" "}
            {STUCK_AFTER_DAYS} أيام فأكثر
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {preview.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/invoices/transfers/${row.id}`}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {row.transfer_no}
                </Link>
                {" — "}
                {STATUS_LABEL[row.status] ?? row.status}
                {row.from_branch_name_ar && row.to_branch_name_ar && (
                  <span>
                    {" "}
                    ({row.from_branch_name_ar} → {row.to_branch_name_ar})
                  </span>
                )}
              </li>
            ))}
            {items.length > PREVIEW_LIMIT && (
              <li className="text-amber-800">
                + {items.length - PREVIEW_LIMIT} أخرى
              </li>
            )}
          </ul>
        </div>
        <Link
          href="/invoices/transfers"
          className="shrink-0 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          فتح المناقلات
        </Link>
      </div>
    </section>
  );
}
