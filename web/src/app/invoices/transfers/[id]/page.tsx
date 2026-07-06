"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useNotifications } from "@/components/notifications";
import { InvoicesNav } from "@/modules/invoices/components/invoices-nav";
import { invoicePatternApi } from "@/modules/invoices/services/invoice-pattern-api";
import { transferApi } from "@/modules/invoices/services/transfer-api";
import type { InventoryTransferDetail } from "@/modules/invoices/types";

export default function TransferDetailPage() {
  const params = useParams<{ id: string }>();
  const { notifyError } = useNotifications();
  const [transfer, setTransfer] = useState<InventoryTransferDetail | null>(null);
  const [outPatternId, setOutPatternId] = useState<string>();
  const [inPatternId, setInPatternId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      transferApi.getTransfer(params.id),
      invoicePatternApi.listInvoicePatterns(),
    ])
      .then(([transferData, patterns]) => {
        if (!cancelled) {
          setTransfer(transferData);
          setOutPatternId(
            patterns.find((p) => p.commercial_kind === "transfer_out" && p.is_active)?.id,
          );
          setInPatternId(
            patterns.find((p) => p.commercial_kind === "transfer_in" && p.is_active)?.id,
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          notifyError(err instanceof Error ? err.message : "فشل تحميل المناقلة.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, notifyError]);

  if (isLoading) {
    return (
      <main className="flex w-full flex-col gap-4">
        <InvoicesNav />
        <p className="text-sm text-slate-600">جاري التحميل...</p>
      </main>
    );
  }

  if (!transfer) {
    return (
      <main className="flex w-full flex-col gap-4">
        <InvoicesNav />
        <p className="text-sm text-red-600">لم تُعثر على المناقلة.</p>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <InvoicesNav />

      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            مناقلة {transfer.transfer_no}
          </h1>
          <p className="text-xs text-slate-600">الحالة: {transfer.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {outPatternId && !transfer.out_invoice_id && (
            <Link
              href={`/invoices/new?pattern=${outPatternId}&transfer=${transfer.id}&role=out`}
              className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white"
            >
              فاتورة إخراج
            </Link>
          )}
          {transfer.out_invoice_id && (
            <Link
              href={`/invoices/${transfer.out_invoice_id}`}
              className="rounded-md border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800"
            >
              عرض فاتورة الإخراج
            </Link>
          )}
          {inPatternId && (
            <Link
              href={`/invoices/new?pattern=${inPatternId}&transfer=${transfer.id}&role=in`}
              className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white"
            >
              فاتورة إدخال
            </Link>
          )}
          {transfer.in_invoice_id && (
            <Link
              href={`/invoices/${transfer.in_invoice_id}`}
              className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-800"
            >
              عرض فاتورة الإدخال
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="text-right text-slate-700">
                <th className="border border-slate-200 p-2">#</th>
                <th className="border border-slate-200 p-2">المادة</th>
                <th className="border border-slate-200 p-2">الوحدة</th>
                <th className="border border-slate-200 p-2">المطلوب</th>
                <th className="border border-slate-200 p-2">المشحون</th>
                <th className="border border-slate-200 p-2">المستلم</th>
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((line) => (
                <tr key={line.id} className="odd:bg-white even:bg-slate-50/60">
                  <td className="border border-slate-100 p-2">{line.line_no}</td>
                  <td className="border border-slate-100 p-2">
                    {line.material_code} — {line.material_name_ar}
                  </td>
                  <td className="border border-slate-100 p-2">{line.unit_name_ar}</td>
                  <td className="border border-slate-100 p-2 font-mono">
                    {line.qty_ordered}
                  </td>
                  <td className="border border-slate-100 p-2 font-mono">
                    {line.qty_shipped}
                  </td>
                  <td className="border border-slate-100 p-2 font-mono">
                    {line.qty_received}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
