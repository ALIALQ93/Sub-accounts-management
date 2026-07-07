"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  invoiceInventoryApi,
  type InvoiceInventoryMovement,
} from "@/modules/invoices/services/invoice-inventory-api";

interface InvoiceInventoryMovementsPanelProps {
  invoiceId: string;
  invoiceNo: string;
}

export function InvoiceInventoryMovementsPanel({
  invoiceId,
  invoiceNo,
}: InvoiceInventoryMovementsPanelProps) {
  const [rows, setRows] = useState<InvoiceInventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    void invoiceInventoryApi
      .listByInvoiceId(invoiceId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "فشل تحميل حركات المخزون.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">جاري تحميل حركات المخزون...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
        <p className="text-sm text-rose-700">{error}</p>
      </section>
    );
  }

  if (rows.length === 0) {
    return null;
  }

  const ledgerHref = `/reports/inventory-balance?invoice=${encodeURIComponent(invoiceNo)}`;

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-emerald-900">حركات المخزون المرتبطة</h2>
        <Link
          href={ledgerHref}
          className="text-xs text-blue-800 underline"
        >
          دفتر حركة المخزون
        </Link>
      </div>
      <p className="mb-3 text-xs text-emerald-800">
        {rows.length} حركة من ترحيل الفاتورة — مرتبطة بـ{" "}
        <code className="text-[11px]">inventory_movements</code>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-white/80">
            <tr className="text-right text-slate-700">
              <th className="border-b border-emerald-100 p-2">النوع</th>
              <th className="border-b border-emerald-100 p-2">المادة</th>
              <th className="border-b border-emerald-100 p-2">مستودع</th>
              <th className="border-b border-emerald-100 p-2">كمية أساس</th>
              <th className="border-b border-emerald-100 p-2">تكلفة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="odd:bg-white/60 even:bg-transparent">
                <td className="border-b border-emerald-50 p-2 text-xs">
                  {row.movement_kind_label}
                </td>
                <td className="border-b border-emerald-50 p-2">
                  <span className="font-mono text-xs">{row.material_code}</span>
                  <span className="block text-xs">{row.material_name_ar}</span>
                </td>
                <td className="border-b border-emerald-50 p-2 font-mono text-xs">
                  {row.warehouse_code}
                </td>
                <td className="border-b border-emerald-50 p-2 font-mono text-xs">
                  {row.quantity_base_delta.toFixed(4)}
                </td>
                <td className="border-b border-emerald-50 p-2 font-mono text-xs">
                  {row.total_cost.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
