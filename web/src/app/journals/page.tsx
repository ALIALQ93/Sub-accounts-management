"use client";

import { useEffect, useState } from "react";
import { DocumentActionLinks } from "@/components/open-in-new-tab-link";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { JournalEntryListItem } from "@/modules/vouchers/types";

export default function JournalsPage() {
  const [entries, setEntries] = useState<JournalEntryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchEntries = async (from?: string, to?: string) => {
    return voucherApi.listJournalEntries(from, to);
  };

  const loadEntries = async (from?: string, to?: string) => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchEntries(from, to);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل القيود.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadInitial = async () => {
      try {
        const data = await fetchEntries();
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل القيود.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyDateFilter = async () => {
    await loadEntries(fromDate || undefined, toDate || undefined);
  };

  const resetDateFilter = async () => {
    setFromDate("");
    setToDate("");
    await loadEntries();
  };

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">قيود اليومية</h1>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={applyDateFilter}
            disabled={isLoading}
            className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            تطبيق الفترة
          </button>
          <button
            type="button"
            onClick={resetDateFilter}
            disabled={isLoading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            إلغاء الفلترة
          </button>
        </div>
      </section>

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
                  <th className="border-b border-slate-200 p-2">إجراء</th>
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
                    <td className="border-b border-slate-100 p-2">
                      <DocumentActionLinks
                        href={`/journals/${entry.id}`}
                        openLabel="تفاصيل"
                      />
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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
