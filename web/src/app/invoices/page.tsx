"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { InvoicesListTable } from "@/modules/invoices/components/invoices-list-table";
import { InvoicesNav } from "@/modules/invoices/components/invoices-nav";
import { invoiceApi } from "@/modules/invoices/services/invoice-api";
import { invoicePatternApi } from "@/modules/invoices/services/invoice-pattern-api";
import type { InvoiceListItem, InvoicePatternListItem } from "@/modules/invoices/types";
import {
  getCommercialKindLabel,
  getDirectionLabel,
} from "@/modules/invoices/utils/invoice-kind-config";

export default function InvoicesPage() {
  const { hasPermission } = useAuth();
  const { notifyError } = useNotifications();
  const canCreate = hasPermission("invoices.create");
  const canEdit = hasPermission("invoices.edit");

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [patterns, setPatterns] = useState<InvoicePatternListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [invoicesData, patternsData] = await Promise.all([
          invoiceApi.listInvoices(),
          invoicePatternApi.listInvoicePatterns(),
        ]);
        if (!cancelled) {
          setInvoices(invoicesData);
          setPatterns(patternsData.filter((p) => p.is_active));
        }
      } catch (err) {
        if (!cancelled) {
          notifyError(
            err instanceof Error ? err.message : "فشل تحميل الفواتير.",
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

      <section>
        <h1 className="text-xl font-bold tracking-tight text-[var(--brand-navy)]">
          الفواتير
        </h1>
        <p className="text-xs text-slate-600">
          إنشاء فواتير حسب النمط — كل نمط له ترقيم وسلوك مستقل.
        </p>
      </section>

      <PermissionGate permission="invoices.create">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">إنشاء فاتورة</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {patterns.map((pattern) => (
              <Link
                key={pattern.id}
                href={`/invoices/new?pattern=${pattern.id}`}
                className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-navy)]/30 hover:shadow-md"
              >
                <p className="font-semibold text-slate-900">{pattern.name_ar}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {getCommercialKindLabel(pattern.commercial_kind)} ·{" "}
                  {getDirectionLabel(pattern.direction)}
                </p>
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-navy)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  فاتورة جديدة
                </p>
              </Link>
            ))}

            {patterns.length === 0 && !isLoading && (
              <p className="text-sm text-slate-500 md:col-span-2">
                لا توجد أنماط فواتير نشطة.{" "}
                <Link href="/invoices/patterns" className="text-blue-700 underline">
                  إدارة الأنماط
                </Link>
              </p>
            )}
          </div>
        </section>
      </PermissionGate>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">آخر الفواتير</h2>
        {isLoading && (
          <p className="text-sm text-slate-600">جاري التحميل...</p>
        )}
        {!isLoading && (
          <InvoicesListTable items={invoices} canEdit={canEdit || canCreate} />
        )}
      </section>
    </main>
  );
}
