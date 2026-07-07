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
      <table className="data-table min-w-[900px]">
        <thead>
          <tr>
            <th>رقم المناقلة</th>
            <th>من فرع</th>
            <th>إلى فرع</th>
            <th>الحالة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="font-mono" dir="ltr">
                {item.transfer_no}
              </td>
              <td>{item.from_branch_name_ar ?? "—"}</td>
              <td>{item.to_branch_name_ar ?? "—"}</td>
              <td>
                <span className="badge badge-muted">
                  {STATUS_LABELS[item.status]}
                </span>
              </td>
              <td>
                <div className="flex flex-wrap gap-1">
                  <Link
                    href={`/invoices/transfers/${item.id}`}
                    className="btn btn-sm btn-outline text-[var(--brand-navy)]"
                  >
                    عرض
                  </Link>
                  {canCreate && outPatternId && !item.out_invoice_id && (
                    <Link
                      href={`/invoices/new?pattern=${outPatternId}&transfer=${item.id}&role=out`}
                      className="btn btn-sm btn-outline text-amber-800"
                    >
                      إخراج
                    </Link>
                  )}
                  {canCreate && inPatternId && (
                    <Link
                      href={`/invoices/new?pattern=${inPatternId}&transfer=${item.id}&role=in`}
                      className="btn btn-sm btn-outline text-[var(--success)]"
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
              <td colSpan={5} className="p-6 text-center text-slate-500">
                لا توجد مناقلات.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
