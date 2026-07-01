"use client";

import { useEffect, useMemo, useState } from "react";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { OpenMovement } from "@/modules/vouchers/types";

export default function OpenMovementsPage() {
  const [items, setItems] = useState<OpenMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await voucherApi.listOpenMovements();
        if (!cancelled) setItems(data.filter((item) => item.open_amount > 0));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الحركات المفتوحة.");
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

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.entry_no.toLowerCase().includes(q) ||
        (item.account_code ?? "").toLowerCase().includes(q) ||
        (item.account_name ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">الحركات المفتوحة</h1>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث برقم القيد أو كود الحساب"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">رقم القيد</th>
                  <th className="border-b border-slate-200 p-2">كود الحساب</th>
                  <th className="border-b border-slate-200 p-2">اسم الحساب</th>
                  <th className="border-b border-slate-200 p-2">الوصف</th>
                  <th className="border-b border-slate-200 p-2">الرصيد المفتوح</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.target_journal_line_id}
                    className="odd:bg-white even:bg-slate-50/60"
                  >
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {item.entry_no}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {item.account_code ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {item.account_name ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {item.line_description ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {item.open_amount.toFixed(2)}
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="border-b border-slate-100 p-4 text-center text-slate-500"
                    >
                      لا توجد نتائج.
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
