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
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
        قيود اليومية
      </h1>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
            className="btn btn-primary"
          >
            تطبيق الفترة
          </button>
          <button
            type="button"
            onClick={resetDateFilter}
            disabled={isLoading}
            className="btn btn-outline"
          >
            إلغاء الفلترة
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <p className="p-4 text-sm text-slate-600">جاري تحميل القيود...</p>
        )}
        {!isLoading && error && (
          <p className="p-4 text-sm text-[var(--danger)]">{error}</p>
        )}

        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[960px]">
              <thead>
                <tr>
                  <th>رقم القيد</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th>نوع المصدر</th>
                  <th>المصدر</th>
                  <th>الوصف</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-mono font-medium text-slate-900">
                      {entry.entry_no}
                    </td>
                    <td className="tabular-nums text-slate-600">
                      {entry.entry_date}
                    </td>
                    <td>{entry.status}</td>
                    <td className="text-slate-600">{entry.source_type ?? "-"}</td>
                    <td className="font-mono text-slate-500">
                      {entry.source_id ?? "-"}
                    </td>
                    <td className="text-slate-600">{entry.description ?? "-"}</td>
                    <td>
                      <DocumentActionLinks
                        href={`/journals/${entry.id}`}
                        openLabel="تفاصيل"
                      />
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
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
