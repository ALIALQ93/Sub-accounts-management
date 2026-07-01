"use client";

import { useEffect, useMemo, useState } from "react";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { TrialBalanceRow } from "@/modules/vouchers/types";

export default function TrialBalancePage() {
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchRows = async (from?: string, to?: string) => {
    return voucherApi.listTrialBalanceRows(from, to);
  };

  const loadRows = async (from?: string, to?: string) => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchRows(from, to);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل ميزان المراجعة.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const data = await fetchRows();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل ميزان المراجعة.");
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
    await loadRows(fromDate || undefined, toDate || undefined);
  };

  const resetDateFilter = async () => {
    setFromDate("");
    setToDate("");
    await loadRows();
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.account_code.toLowerCase().includes(q) ||
        row.account_name.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.debit += row.debit;
          acc.credit += row.credit;
          return acc;
        },
        { debit: 0, credit: 0 },
      ),
    [filteredRows],
  );

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">ميزان المراجعة</h1>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="بحث بكود الحساب أو الاسم"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
          />
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
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
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
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}
        {!isLoading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-right text-slate-700">
                    <th className="border-b border-slate-200 p-2">كود الحساب</th>
                    <th className="border-b border-slate-200 p-2">اسم الحساب</th>
                    <th className="border-b border-slate-200 p-2">مدين</th>
                    <th className="border-b border-slate-200 p-2">دائن</th>
                    <th className="border-b border-slate-200 p-2">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.account_id} className="odd:bg-white even:bg-slate-50/60">
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {row.account_code}
                      </td>
                      <td className="border-b border-slate-100 p-2">{row.account_name}</td>
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {row.debit.toFixed(2)}
                      </td>
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {row.credit.toFixed(2)}
                      </td>
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {row.balance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border-b border-slate-100 p-4 text-center text-slate-500"
                      >
                        لا توجد بيانات.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
              <p className="font-mono">إجمالي المدين: {totals.debit.toFixed(2)}</p>
              <p className="font-mono">إجمالي الدائن: {totals.credit.toFixed(2)}</p>
              <p className="font-mono">
                الفرق: {(totals.debit - totals.credit).toFixed(2)}
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
