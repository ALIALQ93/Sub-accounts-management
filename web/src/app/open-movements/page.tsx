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
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">الحركات المفتوحة</h1>
      <p className="mb-4 text-sm text-slate-600">
        من <code className="text-xs">open_items_view</code> — رصيد مفتوح حقيقي بعد
        خصم التخصيصات المرحّلة
      </p>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        {!isLoading && !error && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[1100px]">
              <thead>
                <tr>
                  <th>رقم القيد</th>
                  <th>التاريخ</th>
                  <th>الحساب</th>
                  <th>CC</th>
                  <th>الفرع</th>
                  <th>جانب</th>
                  <th>استحقاق</th>
                  <th>المفتوح</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.target_journal_line_id}>
                    <td className="font-mono">{item.entry_no}</td>
                    <td className="tabular-nums">{item.entry_date ?? "—"}</td>
                    <td>
                      <span className="font-mono">{item.account_code ?? "—"}</span>
                      {item.account_name ? (
                        <span className="ms-1 text-slate-600">{item.account_name}</span>
                      ) : null}
                    </td>
                    <td className="font-mono">{item.cost_center_code ?? "—"}</td>
                    <td className="font-mono">{item.branch_code ?? "—"}</td>
                    <td>
                      {item.open_side === "debit"
                        ? "مدين"
                        : item.open_side === "credit"
                          ? "دائن"
                          : "—"}
                    </td>
                    <td className="text-xs">
                      {item.due_date ?? "—"}
                      {item.is_overdue ? (
                        <span className="ms-1 text-[var(--danger)]">متأخر</span>
                      ) : null}
                    </td>
                    <td className="font-mono tabular-nums">
                      {item.open_amount.toFixed(2)}
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-500">
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
