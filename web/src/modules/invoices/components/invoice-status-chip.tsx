"use client";

import type { InvoiceStatus } from "@/modules/invoices/types";

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "مسودة",
    className: "bg-amber-50 text-amber-800",
  },
  posted: {
    label: "مرحّلة",
    className: "bg-emerald-50 text-emerald-800",
  },
  cancelled: {
    label: "ملغاة",
    className: "bg-slate-100 text-slate-600",
  },
};

export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
