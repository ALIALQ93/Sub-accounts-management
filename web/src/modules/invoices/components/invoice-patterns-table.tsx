"use client";

import Link from "next/link";
import type { InvoicePatternListItem } from "@/modules/invoices/types";
import {
  getCommercialKindLabel,
  getDirectionLabel,
} from "@/modules/invoices/utils/invoice-kind-config";

interface InvoicePatternsTableProps {
  patterns: InvoicePatternListItem[];
  canEdit: boolean;
}

export function InvoicePatternsTable({
  patterns,
  canEdit,
}: InvoicePatternsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="data-table min-w-[760px]">
        <thead>
          <tr>
            <th>#</th>
            <th>الاسم</th>
            <th>الاتجاه</th>
            <th>النوع التجاري</th>
            <th>التسوية</th>
            <th>الترتيب</th>
            <th>الحالة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((pattern) => (
            <tr key={pattern.id}>
              <td className="font-mono text-slate-600">{pattern.pattern_no}</td>
              <td>
                <div className="font-medium">{pattern.name_ar}</div>
                {pattern.name_en && (
                  <div className="text-xs text-slate-500" dir="ltr">
                    {pattern.name_en}
                  </div>
                )}
              </td>
              <td>{getDirectionLabel(pattern.direction)}</td>
              <td>{getCommercialKindLabel(pattern.commercial_kind)}</td>
              <td>
                {pattern.default_settlement_mode === "cash" ? "نقدي" : "آجل"}
              </td>
              <td className="font-mono tabular-nums">{pattern.sort_order}</td>
              <td>
                {pattern.is_active ? (
                  <span className="badge badge-success">نشط</span>
                ) : (
                  <span className="badge badge-muted">معطّل</span>
                )}
              </td>
              <td>
                {canEdit ? (
                  <Link
                    href={`/invoices/patterns/${pattern.id}`}
                    className="btn btn-sm btn-outline text-[var(--brand-navy)]"
                  >
                    تعديل
                  </Link>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}

          {patterns.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-slate-500">
                لا توجد أنماط فواتير. اضغط «نمط جديد» للبدء.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
