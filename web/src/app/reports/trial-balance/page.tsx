"use client";

import { useEffect, useMemo, useState } from "react";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { TrialBalanceRow } from "@/modules/vouchers/types";

export default function TrialBalancePage() {
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await voucherApi.listTrialBalanceRows();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل ميزان المراجعة.");
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
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="بحث بكود الحساب أو الاسم"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
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
