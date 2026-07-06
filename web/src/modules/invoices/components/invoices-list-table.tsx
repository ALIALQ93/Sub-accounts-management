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
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr className="text-right text-slate-700">
            <th className="border border-slate-200 p-2">رقم الفاتورة</th>
            <th className="border border-slate-200 p-2">التاريخ</th>
            <th className="border border-slate-200 p-2">النمط</th>
            <th className="border border-slate-200 p-2">النوع</th>
            <th className="border border-slate-200 p-2">الفرع</th>
            <th className="border border-slate-200 p-2">الطرف</th>
            <th className="border border-slate-200 p-2">التسوية</th>
            <th className="border border-slate-200 p-2">الحالة</th>
            <th className="border border-slate-200 p-2">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="odd:bg-white even:bg-slate-50/60">
              <td className="border border-slate-100 p-2 font-mono" dir="ltr">
                {item.invoice_no}
              </td>
              <td className="border border-slate-100 p-2">{item.invoice_date}</td>
              <td className="border border-slate-100 p-2">
                {item.pattern_name_ar ?? "—"}
              </td>
              <td className="border border-slate-100 p-2">
                {item.commercial_kind
                  ? getCommercialKindLabel(item.commercial_kind)
                  : "—"}
              </td>
              <td className="border border-slate-100 p-2">
                {item.branch_name_ar ?? "—"}
              </td>
              <td className="border border-slate-100 p-2">
                {item.party_name_ar ?? "—"}
              </td>
              <td className="border border-slate-100 p-2">
                {item.settlement_mode === "cash" ? "نقدي" : "آجل"}
              </td>
              <td className="border border-slate-100 p-2">
                <InvoiceStatusChip status={item.status} />
              </td>
              <td className="border border-slate-100 p-2">
                <Link
                  href={`/invoices/${item.id}`}
                  className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700"
                >
                  {canEdit && item.status === "draft" ? "تعديل" : "عرض"}
                </Link>
              </td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td
                colSpan={9}
                className="border border-slate-100 p-6 text-center text-slate-500"
              >
                لا توجد فواتير بعد.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
