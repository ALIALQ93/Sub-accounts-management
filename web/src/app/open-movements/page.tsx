"use client";

import { useEffect, useMemo, useState } from "react";
import { openMovementsApi } from "@/modules/vouchers/services/open-movements-api";
import type { OpenMovement, OpenMovementFilters } from "@/modules/vouchers/types";
import { formatOpenMovementLabel } from "@/modules/vouchers/utils/open-movement-utils";

export default function OpenMovementsPage() {
  const [items, setItems] = useState<OpenMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<OpenMovementFilters>({
    openSide: "all",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await openMovementsApi.list(filters);
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
  }, [filters]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.entry_no.toLowerCase().includes(q) ||
        (item.account_code ?? "").toLowerCase().includes(q) ||
        (item.account_name ?? "").toLowerCase().includes(q) ||
        (item.cost_center_code ?? "").toLowerCase().includes(q) ||
        (item.branch_code ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">الحركات المفتوحة</h1>
      <p className="mb-4 text-sm text-slate-600">
        من <code className="text-xs">open_items_view</code> — رصيد مفتوح حقيقي بعد
        خصم التخصيصات المرحّلة
      </p>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث برقم القيد أو كود الحساب أو CC"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={filters.openSide ?? "all"}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                openSide: event.target.value as OpenMovementFilters["openSide"],
              }))
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">كل الجوانب</option>
            <option value="debit">مدين</option>
            <option value="credit">دائن</option>
          </select>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">رقم القيد</th>
                  <th className="border-b border-slate-200 p-2">التاريخ</th>
                  <th className="border-b border-slate-200 p-2">الحساب</th>
                  <th className="border-b border-slate-200 p-2">CC</th>
                  <th className="border-b border-slate-200 p-2">الفرع</th>
                  <th className="border-b border-slate-200 p-2">جانب</th>
                  <th className="border-b border-slate-200 p-2">استحقاق</th>
                  <th className="border-b border-slate-200 p-2">المفتوح</th>
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
                    <td className="border-b border-slate-100 p-2">
                      {item.entry_date ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      <span className="font-mono">{item.account_code ?? "—"}</span>
                      {item.account_name ? (
                        <span className="ms-1 text-slate-600">{item.account_name}</span>
                      ) : null}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {item.cost_center_code ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {item.branch_code ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {item.open_side === "debit"
                        ? "مدين"
                        : item.open_side === "credit"
                          ? "دائن"
                          : "—"}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {item.due_date ?? "—"}
                      {item.is_overdue ? (
                        <span className="ms-1 text-rose-700">متأخر</span>
                      ) : null}
                    </td>
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {item.open_amount.toFixed(2)}
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
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
        {!isLoading && !error && filteredItems.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {filteredItems.length} سطر — مثال:{" "}
            {formatOpenMovementLabel(filteredItems[0])}
          </p>
        )}
      </section>
    </main>
  );
}
