"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { InvoiceForm } from "@/modules/invoices/components/invoice-form";
import { InvoicesNav } from "@/modules/invoices/components/invoices-nav";

function NewInvoicePageInner() {
  const searchParams = useSearchParams();
  const patternId = searchParams.get("pattern") ?? "";
  const transferId = searchParams.get("transfer") ?? undefined;
  const roleParam = searchParams.get("role");
  const transferRole =
    roleParam === "out" || roleParam === "in" ? roleParam : undefined;

  if (!patternId) {
    return (
      <p className="text-sm text-slate-600">
        اختر نمطاً من صفحة الفواتير لإنشاء فاتورة جديدة.
      </p>
    );
  }

  return (
    <InvoiceForm
      mode="create"
      patternId={patternId}
      transferId={transferId}
      transferRole={transferRole}
    />
  );
}

export default function NewInvoicePage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <InvoicesNav />
      <PermissionGate
        permission="invoices.create"
        fallback={
          <p className="text-sm text-slate-600">ليس لديك صلاحية إنشاء فواتير.</p>
        }
      >
        <Suspense fallback={<p className="text-sm text-slate-600">جاري التحميل...</p>}>
          <NewInvoicePageInner />
        </Suspense>
      </PermissionGate>
    </main>
  );
}
