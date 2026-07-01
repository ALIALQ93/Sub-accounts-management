"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await voucherApi.listAccounts();
        if (!cancelled) setAccounts(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الحسابات.");
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
        <h1 className="text-2xl font-bold text-slate-900">دليل الحسابات</h1>
        <Link
          href="/vouchers/new"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          إنشاء سند
        </Link>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري تحميل الحسابات...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}

        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">كود الحساب</th>
                  <th className="border-b border-slate-200 p-2">اسم الحساب</th>
                  <th className="border-b border-slate-200 p-2">حالة الترحيل</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {account.code}
                    </td>
                    <td className="border-b border-slate-100 p-2">{account.name_ar}</td>
                    <td className="border-b border-slate-100 p-2">
                      {account.is_postable ? "مرحّل عليه" : "حساب أب"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {account.is_active ? "نشط" : "غير نشط"}
                    </td>
                  </tr>
                ))}

                {accounts.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="border-b border-slate-100 p-4 text-center text-slate-500"
                    >
                      لا توجد حسابات قابلة للترحيل.
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
