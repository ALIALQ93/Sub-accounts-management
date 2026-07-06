"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { InvoicesNav } from "@/modules/invoices/components/invoices-nav";
import { InvoicePatternsTable } from "@/modules/invoices/components/invoice-patterns-table";
import { invoicePatternApi } from "@/modules/invoices/services/invoice-pattern-api";
import type { InvoicePatternListItem } from "@/modules/invoices/types";

export default function InvoicePatternsPage() {
  const { hasPermission } = useAuth();
  const { notifyError } = useNotifications();
  const canManage = hasPermission("invoices.settings");
  const [patterns, setPatterns] = useState<InvoicePatternListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await invoicePatternApi.listInvoicePatterns();
        if (!cancelled) setPatterns(data);
      } catch (err) {
        if (!cancelled) {
          notifyError(
            err instanceof Error ? err.message : "فشل تحميل أنماط الفواتير.",
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
          <h1 className="text-xl font-bold text-slate-900">أنماط الفواتير</h1>
          <p className="text-xs text-slate-600">
            تعريف أنماط المبيعات والمشتريات والمناقلة وغيرها — كل نمط له ترقيم وسلوك مستقل.
          </p>
        </div>
        <PermissionGate permission="invoices.settings">
          <Link
            href="/invoices/patterns/new"
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
          >
            + نمط جديد
          </Link>
        </PermissionGate>
      </section>

      <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
        {isLoading && (
          <p className="text-sm text-slate-600">جاري تحميل الأنماط...</p>
        )}

        {!isLoading && (
          <InvoicePatternsTable patterns={patterns} canEdit={canManage} />
        )}
      </section>
    </main>
  );
}
