"use client";

import Link from "next/link";
import type { InventoryTransferListItem, TransferStatus } from "@/modules/invoices/types";

const STATUS_LABELS: Record<TransferStatus, string> = {
  draft: "مسودة",
  dispatched: "مشحونة",
  in_transit: "في الطريق",
  partially_received: "استلام جزئي",
  received: "مستلمة",
  cancelled: "ملغاة",
};

interface TransfersListTableProps {
  items: InventoryTransferListItem[];
  outPatternId?: string;
  inPatternId?: string;
  canCreate: boolean;
}

export function TransfersListTable({
  items,
  outPatternId,
  inPatternId,
  canCreate,
}: TransfersListTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr className="text-right text-slate-700">
            <th className="border border-slate-200 p-2">رقم المناقلة</th>
            <th className="border border-slate-200 p-2">من فرع</th>
            <th className="border border-slate-200 p-2">إلى فرع</th>
            <th className="border border-slate-200 p-2">الحالة</th>
            <th className="border border-slate-200 p-2">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="odd:bg-white even:bg-slate-50/60">
              <td className="border border-slate-100 p-2 font-mono" dir="ltr">
                {item.transfer_no}
              </td>
              <td className="border border-slate-100 p-2">
                {item.from_branch_name_ar ?? "—"}
              </td>
              <td className="border border-slate-100 p-2">
                {item.to_branch_name_ar ?? "—"}
              </td>
              <td className="border border-slate-100 p-2">
                {STATUS_LABELS[item.status]}
              </td>
              <td className="border border-slate-100 p-2">
                <div className="flex flex-wrap gap-1">
                  <Link
                    href={`/invoices/transfers/${item.id}`}
                    className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700"
                  >
                    عرض
                  </Link>
                  {canCreate && outPatternId && !item.out_invoice_id && (
                    <Link
                      href={`/invoices/new?pattern=${outPatternId}&transfer=${item.id}&role=out`}
                      className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800"
                    >
                      إخراج
                    </Link>
                  )}
                  {canCreate && inPatternId && (
                    <Link
                      href={`/invoices/new?pattern=${inPatternId}&transfer=${item.id}&role=in`}
                      className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800"
                    >
                      إدخال
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="border border-slate-100 p-6 text-center text-slate-500"
              >
                لا توجد مناقلات.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
