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
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr className="text-right text-slate-700">
            <th className="border border-slate-200 p-2">#</th>
            <th className="border border-slate-200 p-2">الاسم</th>
            <th className="border border-slate-200 p-2">الاتجاه</th>
            <th className="border border-slate-200 p-2">النوع التجاري</th>
            <th className="border border-slate-200 p-2">التسوية</th>
            <th className="border border-slate-200 p-2">الترتيب</th>
            <th className="border border-slate-200 p-2">الحالة</th>
            <th className="border border-slate-200 p-2">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((pattern) => (
            <tr key={pattern.id} className="odd:bg-white even:bg-slate-50/60">
              <td className="border border-slate-100 p-2 font-mono text-slate-600">
                {pattern.pattern_no}
              </td>
              <td className="border border-slate-100 p-2">
                <div className="font-medium">{pattern.name_ar}</div>
                {pattern.name_en && (
                  <div className="text-xs text-slate-500" dir="ltr">
                    {pattern.name_en}
                  </div>
                )}
              </td>
              <td className="border border-slate-100 p-2">
                {getDirectionLabel(pattern.direction)}
              </td>
              <td className="border border-slate-100 p-2">
                {getCommercialKindLabel(pattern.commercial_kind)}
              </td>
              <td className="border border-slate-100 p-2">
                {pattern.default_settlement_mode === "cash" ? "نقدي" : "آجل"}
              </td>
              <td className="border border-slate-100 p-2 font-mono">
                {pattern.sort_order}
              </td>
              <td className="border border-slate-100 p-2">
                {pattern.is_active ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                    نشط
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    معطّل
                  </span>
                )}
              </td>
              <td className="border border-slate-100 p-2">
                {canEdit ? (
                  <Link
                    href={`/invoices/patterns/${pattern.id}`}
                    className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700"
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
              <td
                colSpan={8}
                className="border border-slate-100 p-6 text-center text-slate-500"
              >
                لا توجد أنماط فواتير. اضغط «نمط جديد» للبدء.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
