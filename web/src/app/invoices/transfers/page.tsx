"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { InvoicesNav } from "@/modules/invoices/components/invoices-nav";
import { TransfersListTable } from "@/modules/invoices/components/transfers-list-table";
import { invoicePatternApi } from "@/modules/invoices/services/invoice-pattern-api";
import { transferApi } from "@/modules/invoices/services/transfer-api";
import type { InventoryTransferListItem } from "@/modules/invoices/types";

export default function TransfersPage() {
  const { hasPermission } = useAuth();
  const { notifyError } = useNotifications();
  const canCreate = hasPermission("invoices.create");

  const [items, setItems] = useState<InventoryTransferListItem[]>([]);
  const [outPatternId, setOutPatternId] = useState<string>();
  const [inPatternId, setInPatternId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [transfers, patterns] = await Promise.all([
          transferApi.listTransfers(),
          invoicePatternApi.listInvoicePatterns(),
        ]);
        if (!cancelled) {
          setItems(transfers);
          setOutPatternId(
            patterns.find((p) => p.commercial_kind === "transfer_out" && p.is_active)?.id,
          );
          setInPatternId(
            patterns.find((p) => p.commercial_kind === "transfer_in" && p.is_active)?.id,
          );
        }
      } catch (err) {
        if (!cancelled) {
          notifyError(
            err instanceof Error ? err.message : "فشل تحميل المناقلات.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [notifyError]);

  return (
    <main className="flex w-full flex-col gap-4">
      <InvoicesNav />

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">مناقلات المخزون</h1>
          <p className="text-xs text-slate-600">
            مستند مناقلة ثم فاتورة إخراج عند الشحن وفاتورة إدخال عند الاستلام.
          </p>
        </div>
        <PermissionGate permission="invoices.create">
          <Link
            href="/invoices/transfers/new"
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
          >
            + مناقلة جديدة
          </Link>
        </PermissionGate>
      </section>

      <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
        {isLoading ? (
          <p className="text-sm text-slate-600">جاري التحميل...</p>
        ) : (
          <TransfersListTable
            items={items}
            outPatternId={outPatternId}
            inPatternId={inPatternId}
            canCreate={canCreate}
          />
        )}
      </section>
    </main>
  );
}
