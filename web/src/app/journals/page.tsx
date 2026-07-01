"use client";

import { useEffect, useState } from "react";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { JournalEntryListItem } from "@/modules/vouchers/types";

export default function JournalsPage() {
  const [entries, setEntries] = useState<JournalEntryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await voucherApi.listJournalEntries();
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل القيود.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">قيود اليومية</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري تحميل القيود...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}

        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">رقم القيد</th>
                  <th className="border-b border-slate-200 p-2">التاريخ</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  <th className="border-b border-slate-200 p-2">نوع المصدر</th>
                  <th className="border-b border-slate-200 p-2">المصدر</th>
                  <th className="border-b border-slate-200 p-2">الوصف</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {entry.entry_no}
                    </td>
                    <td className="border-b border-slate-100 p-2">{entry.entry_date}</td>
                    <td className="border-b border-slate-100 p-2">{entry.status}</td>
                    <td className="border-b border-slate-100 p-2">
                      {entry.source_type ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {entry.source_id ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {entry.description ?? "-"}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="border-b border-slate-100 p-4 text-center text-slate-500"
                    >
                      لا توجد قيود يومية.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
