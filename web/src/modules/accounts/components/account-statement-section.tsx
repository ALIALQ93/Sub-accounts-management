"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OpenInNewTabLink } from "@/components/open-in-new-tab-link";
import type { AccountStatementResult } from "@/modules/accounts/types";
import { formatCurrencyAmount } from "@/modules/currencies/utils/convert-amount";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";

interface AccountStatementSectionProps {
  accountId: string;
  decimalPlaces: number;
  currencySymbol: string;
}

export function AccountStatementSection({
  accountId,
  decimalPlaces,
  currencySymbol,
}: AccountStatementSectionProps) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statement, setStatement] = useState<AccountStatementResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fmt = useCallback(
    (value: number) => formatCurrencyAmount(value, decimalPlaces, currencySymbol),
    [decimalPlaces, currencySymbol],
  );

  const loadStatement = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await voucherApi.listAccountStatement(
        accountId,
        fromDate || undefined,
        toDate || undefined,
      );
      setStatement(data);
    } catch (err) {
      setStatement(null);
      setError(
        err instanceof Error ? err.message : "تعذّر تحميل كشف الحركات.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accountId, fromDate, toDate]);

  useEffect(() => {
    void loadStatement();
  }, [loadStatement]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">من تاريخ</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">إلى تاريخ</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setFromDate("");
            setToDate("");
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          كل الفترة
        </button>
        <button
          type="button"
          onClick={() => void loadStatement()}
          disabled={isLoading}
          className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          تحديث
        </button>
      </div>

      {isLoading && (
        <p className="text-sm text-slate-600">جاري تحميل كشف الحركات...</p>
      )}

      {!isLoading && error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {!isLoading && !error && statement && (
        <>
          {fromDate && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              <span className="font-semibold">رصيد افتتاحي:</span>{" "}
              <span className="font-mono">{fmt(statement.opening_balance)}</span>
            </p>
          )}

          {statement.lines.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              لا توجد حركات مرحّلة في الفترة المحددة.
            </p>
          ) : (
            <div className="max-h-[min(52vh,520px)] overflow-auto rounded-xl border-2 border-slate-300">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-right text-xs font-semibold text-slate-700">
                    <th className={TH}>التاريخ</th>
                    <th className={TH}>رقم القيد</th>
                    <th className={TH}>المصدر</th>
                    <th className={TH}>البيان</th>
                    <th className={`${TH} bg-blue-100/70`}>مدين</th>
                    <th className={`${TH} bg-blue-100/70`}>دائن</th>
                    <th className={`${TH} bg-emerald-100/70`}>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.lines.map((line) => (
                    <tr
                      key={line.id}
                      className="odd:bg-white even:bg-slate-50/50"
                    >
                      <td className={TD}>{line.entry_date}</td>
                      <td className={TD}>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <Link
                            href={`/journals/${line.journal_entry_id}`}
                            className="font-mono text-xs font-medium text-blue-900 hover:underline"
                          >
                            {line.entry_no}
                          </Link>
                          <OpenInNewTabLink
                            href={`/journals/${line.journal_entry_id}`}
                            className="text-xs text-slate-500 hover:text-blue-900"
                            title="فتح القيد في تبويب جديد"
                          >
                            ↗
                          </OpenInNewTabLink>
                        </span>
                      </td>
                      <td className={TD}>
                        {line.source_type === "voucher" && line.source_id ? (
                          <span className="inline-flex flex-wrap items-center gap-1">
                            <Link
                              href={`/vouchers/${line.source_id}`}
                              className="font-mono text-xs font-medium text-blue-900 hover:underline"
                            >
                              {line.voucher_no ?? "سند"}
                            </Link>
                            <OpenInNewTabLink
                              href={`/vouchers/${line.source_id}`}
                              className="text-xs text-slate-500 hover:text-blue-900"
                              title="فتح السند في تبويب جديد"
                            >
                              ↗
                            </OpenInNewTabLink>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className={TD}>
                        <p className="whitespace-normal break-words text-sm text-slate-800">
                          {line.line_description ||
                            line.journal_description ||
                            "—"}
                        </p>
                      </td>
                      <td className={`${TD} text-left font-mono text-xs tabular-nums`}>
                        {line.debit > 0 ? fmt(line.debit) : "—"}
                      </td>
                      <td className={`${TD} text-left font-mono text-xs tabular-nums`}>
                        {line.credit > 0 ? fmt(line.credit) : "—"}
                      </td>
                      <td className={`${TD} text-left font-mono text-xs font-semibold tabular-nums text-blue-900`}>
                        {fmt(line.running_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100/90">
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-800"
                    >
                      الإجمالي
                    </td>
                    <td className="border border-slate-300 px-3 py-3 text-left font-mono text-xs font-semibold tabular-nums">
                      {fmt(statement.total_debit)}
                    </td>
                    <td className="border border-slate-300 px-3 py-3 text-left font-mono text-xs font-semibold tabular-nums">
                      {fmt(statement.total_credit)}
                    </td>
                    <td className="border border-slate-300 px-3 py-3 text-left font-mono text-sm font-bold tabular-nums text-blue-900">
                      {fmt(statement.closing_balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {statement.lines.length > 0 && (
            <p className="text-xs text-slate-500">
              {statement.lines.length} حركة — القيود المرحّلة فقط.
            </p>
          )}
        </>
      )}
    </section>
  );
}

const TH = "border border-slate-300 px-3 py-2.5";
const TD = "border border-slate-300 px-3 py-2.5 align-top";
