"use client";

import { useEffect, useMemo, useState } from "react";
import { DocumentActionLinks } from "@/components/open-in-new-tab-link";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { JournalEntryDetails } from "@/modules/vouchers/types";

interface JournalDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function JournalDetailPage({ params }: JournalDetailPageProps) {
  const [journalId, setJournalId] = useState("");
  const [details, setDetails] = useState<JournalEntryDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { id } = await params;
        if (cancelled) return;
        setJournalId(id);

        const data = await voucherApi.getJournalEntryById(id);
        if (!cancelled) setDetails(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل تفاصيل القيد.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const totals = useMemo(() => {
    const lines = details?.lines ?? [];
    const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return { debit, credit, diff: debit - credit };
  }, [details]);

  return (
    <main className="mx-auto w-full max-w-6xl">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">تفاصيل قيد اليومية</h1>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}
        {!isLoading && !error && details && (
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p>
              <span className="font-semibold">المعرف:</span>{" "}
              <span className="font-mono">{journalId}</span>
            </p>
            <p>
              <span className="font-semibold">رقم القيد:</span>{" "}
              <span className="font-mono">{details.header.entry_no}</span>
            </p>
            <p>
              <span className="font-semibold">التاريخ:</span> {details.header.entry_date}
            </p>
            <p>
              <span className="font-semibold">الحالة:</span> {details.header.status}
            </p>
            <p>
              <span className="font-semibold">نوع المصدر:</span>{" "}
              {details.header.source_type ?? "-"}
            </p>
            <p>
              <span className="font-semibold">المصدر:</span>{" "}
              <span className="font-mono">{details.header.source_id ?? "-"}</span>
            </p>
            <p className="md:col-span-2">
              <span className="font-semibold">الوصف:</span>{" "}
              {details.header.description ?? "-"}
            </p>
            {details.header.source_type === "voucher" &&
              details.header.source_id && (
                <div className="md:col-span-2">
                  <DocumentActionLinks
                    href={`/vouchers/${details.header.source_id}`}
                    openLabel="فتح السند المصدر"
                  />
                </div>
              )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {!isLoading && !error && details && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-right text-slate-700">
                    <th className="border-b border-slate-200 p-2">كود الحساب</th>
                    <th className="border-b border-slate-200 p-2">اسم الحساب</th>
                    <th className="border-b border-slate-200 p-2">مدين</th>
                    <th className="border-b border-slate-200 p-2">دائن</th>
                    <th className="border-b border-slate-200 p-2">مركز الكلفة</th>
                    <th className="border-b border-slate-200 p-2">الوصف</th>
                  </tr>
                </thead>
                <tbody>
                  {details.lines.map((line) => (
                    <tr key={line.id} className="odd:bg-white even:bg-slate-50/60">
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {line.account_code}
                      </td>
                      <td className="border-b border-slate-100 p-2">{line.account_name}</td>
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {line.debit.toFixed(2)}
                      </td>
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {line.credit.toFixed(2)}
                      </td>
                      <td className="border-b border-slate-100 p-2 font-mono text-xs">
                        {line.cost_center_code
                          ? `${line.cost_center_code} — ${line.cost_center_name ?? ""}`
                          : "—"}
                      </td>
                      <td className="border-b border-slate-100 p-2">
                        {line.line_description ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
              <p className="font-mono">إجمالي المدين: {totals.debit.toFixed(2)}</p>
              <p className="font-mono">إجمالي الدائن: {totals.credit.toFixed(2)}</p>
              <p className="font-mono">الفرق: {totals.diff.toFixed(2)}</p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
