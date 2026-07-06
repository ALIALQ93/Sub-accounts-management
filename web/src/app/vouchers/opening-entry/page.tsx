"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  openingEntryApi,
  type OpeningEntryListItem,
} from "@/modules/opening-entry/services/opening-entry-api";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";

export default function OpeningEntryListPage() {
  const [rows, setRows] = useState<OpeningEntryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void openingEntryApi
      .listOpeningEntries()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل القيود.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex w-full flex-col gap-4">
      <VouchersNav />
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-indigo-950">قيود افتتاحية</h1>
            <p className="mt-1 text-sm text-indigo-900/80">
              ميزانية افتتاحية per فرع — يتطلب{" "}
              <code className="text-xs">patch_opening_entry.sql</code>.
            </p>
          </div>
          <Link
            href="/vouchers/opening-entry/new"
            className="rounded-md bg-indigo-900 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-950"
          >
            قيد افتتاحي جديد
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-rose-700">{error}</p>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد قيود افتتاحية بعد.
          </p>
        )}
        {!isLoading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">الرقم</th>
                  <th className="border-b border-slate-200 p-2">التاريخ</th>
                  <th className="border-b border-slate-200 p-2">الفرع</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  <th className="border-b border-slate-200 p-2">المدين</th>
                  <th className="border-b border-slate-200 p-2">عرض</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {row.voucher_no}
                    </td>
                    <td className="border-b border-slate-100 p-2">{row.voucher_date}</td>
                    <td className="border-b border-slate-100 p-2">
                      {row.branch_name_ar ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {row.total_debit.toFixed(2)}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      <Link
                        href={`/vouchers/${row.id}?mode=view`}
                        className="text-xs text-blue-900 hover:underline"
                      >
                        فتح
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
