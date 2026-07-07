"use client";

import Link from "next/link";
import { InvoiceStatusChip } from "@/modules/invoices/components/invoice-status-chip";
import type { InvoiceListItem } from "@/modules/invoices/types";
import { getCommercialKindLabel } from "@/modules/invoices/utils/invoice-kind-config";

interface InvoicesListTableProps {
  items: InvoiceListItem[];
  canEdit: boolean;
}

export function InvoicesListTable({ items, canEdit }: InvoicesListTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="data-table min-w-[900px]">
        <thead>
          <tr>
            <th>رقم الفاتورة</th>
            <th>التاريخ</th>
            <th>النمط</th>
            <th>النوع</th>
            <th>الفرع</th>
            <th>الطرف</th>
            <th>التسوية</th>
            <th>الحالة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="font-mono font-medium text-slate-900" dir="ltr">
                {item.invoice_no}
              </td>
              <td className="tabular-nums text-slate-600">{item.invoice_date}</td>
              <td>{item.pattern_name_ar ?? "—"}</td>
              <td>
                {item.commercial_kind
                  ? getCommercialKindLabel(item.commercial_kind)
                  : "—"}
              </td>
              <td className="text-slate-600">{item.branch_name_ar ?? "—"}</td>
              <td>{item.party_name_ar ?? "—"}</td>
              <td>{item.settlement_mode === "cash" ? "نقدي" : "آجل"}</td>
              <td>
                <InvoiceStatusChip status={item.status} />
              </td>
              <td>
                <Link
                  href={`/invoices/${item.id}`}
                  className="btn btn-sm btn-outline"
                >
                  {canEdit && item.status === "draft" ? "تعديل" : "عرض"}
                </Link>
              </td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td colSpan={9} className="p-8 text-center text-slate-500">
                لا توجد فواتير بعد.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
