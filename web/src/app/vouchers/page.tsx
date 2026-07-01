"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { VoucherListItem } from "@/modules/vouchers/types";

export default function VouchersListPage() {
  const [items, setItems] = useState<VoucherListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await voucherApi.listVouchers();
        if (!cancelled) setItems(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل السندات.");
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
      <section className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">السندات</h1>
        <Link
          href="/vouchers/new"
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
        >
          سند جديد
        </Link>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري تحميل السندات...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}

        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">رقم السند</th>
                  <th className="border-b border-slate-200 p-2">النوع</th>
                  <th className="border-b border-slate-200 p-2">وضع التسوية</th>
                  <th className="border-b border-slate-200 p-2">التاريخ</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  <th className="border-b border-slate-200 p-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {item.voucher_no}
                    </td>
                    <td className="border-b border-slate-100 p-2">{item.voucher_type}</td>
                    <td className="border-b border-slate-100 p-2">
                      {item.settlement_mode}
                    </td>
                    <td className="border-b border-slate-100 p-2">{item.voucher_date}</td>
                    <td className="border-b border-slate-100 p-2">
                      <StatusChip status={item.status} />
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      <Link
                        href={`/vouchers/${item.id}`}
                        className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        فتح
                      </Link>
                    </td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="border-b border-slate-100 p-4 text-center text-slate-500"
                    >
                      لا توجد سندات حتى الآن.
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
