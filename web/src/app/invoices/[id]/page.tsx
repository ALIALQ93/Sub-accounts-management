"use client";

import { useParams } from "next/navigation";
import { InvoiceForm } from "@/modules/invoices/components/invoice-form";
import { InvoicesNav } from "@/modules/invoices/components/invoices-nav";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <main className="flex w-full flex-col gap-4">
      <InvoicesNav />
      <InvoiceForm mode="edit" invoiceId={params.id} />
    </main>
  );
}
