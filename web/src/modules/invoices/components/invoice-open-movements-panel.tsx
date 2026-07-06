"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  invoiceSettlementApi,
  type InvoiceCoverageSummary,
  type InvoiceOpenItem,
  type InvoiceSettlementVoucherRow,
} from "@/modules/invoices/services/invoice-settlement-api";
import {
  COVERAGE_STATUS_LABELS,
  COVERAGE_STATUS_STYLES,
} from "@/modules/invoices/utils/invoice-coverage-utils";
import { StatusChip } from "@/modules/vouchers/components/status-chip";

interface InvoiceOpenMovementsPanelProps {
  invoiceId: string;
  commercialKind: string;
  settlementMode: string;
  customerId: string;
  vendorId: string;
  dueDate: string | null;
  paymentTermsDays: number | null;
}

function closeMovementsHref(
  commercialKind: string,
  customerId: string,
  vendorId: string,
  invoiceId: string,
  paymentAmount?: number,
): string | null {
  const params = new URLSearchParams({
    invoiceId,
    autoAllocate: "1",
  });

  if (paymentAmount != null && paymentAmount > 0) {
    params.set("payAmount", paymentAmount.toFixed(2));
  }

  if (commercialKind === "sale" || commercialKind === "return_purchase") {
    const base = "/vouchers/receipt/close-movements/new";
    if (!customerId) return `${base}?${params.toString()}`;
    params.set("customerId", customerId);
    return `${base}?${params.toString()}`;
  }
  if (commercialKind === "purchase" || commercialKind === "return_sale") {
    const base = "/vouchers/payment/close-movements/new";
    if (!vendorId) return `${base}?${params.toString()}`;
    params.set("vendorId", vendorId);
    return `${base}?${params.toString()}`;
  }
  return null;
}

function voucherTypeLabel(type: InvoiceSettlementVoucherRow["voucher_type"]): string {
  return type === "receipt" ? "قبض" : "دفع";
}

export function InvoiceOpenMovementsPanel({
  invoiceId,
  commercialKind,
  settlementMode,
  customerId,
  vendorId,
  dueDate,
  paymentTermsDays,
}: InvoiceOpenMovementsPanelProps) {
  const [items, setItems] = useState<InvoiceOpenItem[]>([]);
  const [settlementVouchers, setSettlementVouchers] = useState<
    InvoiceSettlementVoucherRow[]
  >([]);
  const [coverage, setCoverage] = useState<InvoiceCoverageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentInput, setPaymentInput] = useState("");
  const [usePartialPayment, setUsePartialPayment] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    void (async () => {
      try {
        const openItems =
          await invoiceSettlementApi.listOpenItemsForInvoice(invoiceId);
        const [vouchers, coverageSummary] = await Promise.all([
          invoiceSettlementApi.listSettlementVouchersForInvoice(invoiceId),
          invoiceSettlementApi.getInvoiceCoverageSummary(invoiceId, openItems),
        ]);

        if (cancelled) return;
        setItems(openItems);
        setSettlementVouchers(vouchers);
        setCoverage(coverageSummary);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "فشل تحميل بيانات الإغلاق.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const totalOpen = useMemo(
    () => coverage?.total_open ?? items.reduce((sum, item) => sum + item.open_amount, 0),
    [coverage, items],
  );

  const parsedPaymentAmount = useMemo(() => {
    if (!usePartialPayment) return undefined;
    const parsed = Number(paymentInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return Math.min(parsed, totalOpen);
  }, [usePartialPayment, paymentInput, totalOpen]);

  const paymentValidationError = useMemo(() => {
    if (!usePartialPayment) return "";
    if (!paymentInput.trim()) return "أدخل مبلغ الدفعة الجزئية.";
    const parsed = Number(paymentInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return "مبلغ الدفعة غير صالح.";
    }
    if (parsed > totalOpen + 0.001) {
      return `المبلغ يتجاوز إجمالي المفتوح (${totalOpen.toFixed(2)}).`;
    }
    return "";
  }, [usePartialPayment, paymentInput, totalOpen]);

  if (settlementMode !== "credit") return null;

  const closeHref = closeMovementsHref(
    commercialKind,
    customerId,
    vendorId,
    invoiceId,
    parsedPaymentAmount,
  );
  const canCreateSettlement = totalOpen > 0.001 && Boolean(closeHref);

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-blue-950">إغلاق الحركات (سيناريو ز)</h2>
          <p className="mt-1 text-xs text-blue-900/80">
            حالة التغطية، السندات المرتبطة، والحركات المفتوحة — سداد كامل أو
            جزئي (FIFO).
          </p>
          {(dueDate || paymentTermsDays != null) && (
            <p className="mt-1 text-xs text-slate-700">
              {paymentTermsDays != null && (
                <span>شروط السداد: {paymentTermsDays} يوم · </span>
              )}
              {dueDate && <span>تاريخ الاستحقاق: {dueDate}</span>}
            </p>
          )}
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-slate-600">جاري تحميل بيانات الإغلاق...</p>
      )}
      {!isLoading && error && (
        <p className="text-sm text-rose-700">{error}</p>
      )}

      {!isLoading && !error && coverage && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-white/80 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-blue-950">حالة التغطية</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${COVERAGE_STATUS_STYLES[coverage.coverage_status]}`}
            >
              {COVERAGE_STATUS_LABELS[coverage.coverage_status]}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${coverage.coverage_percent}%` }}
            />
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <p className="font-mono text-slate-700">
              أصل الذمة: {coverage.total_original.toFixed(2)}
            </p>
            <p className="font-mono text-emerald-800">
              مُسدَّد (مرحّل): {coverage.total_settled_posted.toFixed(2)}
            </p>
            <p className="font-mono text-amber-800">
              مسودات/معتمد: {coverage.total_settled_draft.toFixed(2)}
            </p>
            <p className="font-mono text-blue-900">
              متبقٍ مفتوح: {coverage.remaining_open.toFixed(2)}
            </p>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            نسبة التغطية: {coverage.coverage_percent.toFixed(1)}%
          </p>
        </div>
      )}

      {!isLoading && !error && settlementVouchers.length > 0 && (
        <div className="mb-4 overflow-x-auto rounded-lg border border-blue-100 bg-white/70">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-white/90">
              <tr className="text-right text-slate-700">
                <th className="border-b border-blue-100 p-2">السند</th>
                <th className="border-b border-blue-100 p-2">النوع</th>
                <th className="border-b border-blue-100 p-2">التاريخ</th>
                <th className="border-b border-blue-100 p-2">الحالة</th>
                <th className="border-b border-blue-100 p-2">المخصص للفاتورة</th>
                <th className="border-b border-blue-100 p-2">عرض</th>
              </tr>
            </thead>
            <tbody>
              {settlementVouchers.map((voucher) => (
                <tr
                  key={voucher.voucher_id}
                  className="odd:bg-white even:bg-blue-50/30"
                >
                  <td className="border-b border-blue-100 p-2 font-mono text-xs">
                    {voucher.voucher_no}
                  </td>
                  <td className="border-b border-blue-100 p-2 text-xs">
                    {voucherTypeLabel(voucher.voucher_type)}
                  </td>
                  <td className="border-b border-blue-100 p-2 text-xs">
                    {voucher.voucher_date}
                  </td>
                  <td className="border-b border-blue-100 p-2">
                    <StatusChip status={voucher.status} />
                  </td>
                  <td className="border-b border-blue-100 p-2 font-mono">
                    {voucher.allocated_amount.toFixed(2)}
                  </td>
                  <td className="border-b border-blue-100 p-2">
                    <Link
                      href={`/vouchers/${voucher.voucher_id}?mode=view`}
                      className="text-xs font-medium text-blue-900 hover:underline"
                    >
                      فتح السند
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <p className="mb-3 text-sm text-slate-600">
          {coverage?.coverage_status === "full"
            ? "لا توجد حركات مفتوحة — الذمة مغلقة بالكامل عبر سندات الإغلاق."
            : "لا توجد حركات مفتوحة مرتبطة — قد تكون مُغلقة أو لم يُرحَّل القيد بعد."}
        </p>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-white/70">
                <tr className="text-right text-slate-700">
                  <th className="border border-blue-100 p-2">القيد</th>
                  <th className="border border-blue-100 p-2">الحساب</th>
                  <th className="border border-blue-100 p-2">مركز الكلفة</th>
                  <th className="border border-blue-100 p-2">المفتوح</th>
                  <th className="border border-blue-100 p-2">الاستحقاق</th>
                  <th className="border border-blue-100 p-2">الأهلية</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.journal_line_id} className="odd:bg-white even:bg-blue-50/30">
                    <td className="border border-blue-100 p-2 font-mono text-xs">
                      {item.entry_no}
                      <span className="block text-slate-500">{item.entry_date}</span>
                    </td>
                    <td className="border border-blue-100 p-2">
                      {item.account_code ? `${item.account_code} — ` : ""}
                      {item.account_name ?? "—"}
                    </td>
                    <td className="border border-blue-100 p-2 text-xs">
                      {item.cost_center_code ?? "—"}
                      {item.cost_center_name ? ` (${item.cost_center_name})` : ""}
                    </td>
                    <td className="border border-blue-100 p-2 font-mono">
                      {item.open_amount.toFixed(2)}
                      {item.open_side && (
                        <span className="mr-1 text-xs text-slate-500">
                          ({item.open_side === "debit" ? "مدين" : "دائن"})
                        </span>
                      )}
                    </td>
                    <td className="border border-blue-100 p-2 text-xs">
                      {item.due_date ?? "—"}
                    </td>
                    <td className="border border-blue-100 p-2 text-xs">
                      {item.is_overdue ? (
                        <span className="text-rose-700">متأخر</span>
                      ) : item.is_eligible_for_payment ? (
                        <span className="text-emerald-700">مؤهل</span>
                      ) : (
                        <span className="text-amber-700">لم يحن</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canCreateSettlement && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-blue-100 bg-white/70 p-3">
              <p className="text-sm font-medium text-blue-950">
                إجمالي المفتوح:{" "}
                <span className="font-mono">{totalOpen.toFixed(2)}</span>
              </p>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={usePartialPayment}
                  onChange={(event) => {
                    setUsePartialPayment(event.target.checked);
                    if (!event.target.checked) setPaymentInput("");
                  }}
                />
                دفع جزئي
              </label>

              {usePartialPayment && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">مبلغ الدفعة</span>
                  <input
                    type="number"
                    min={0.01}
                    max={totalOpen}
                    step="0.01"
                    value={paymentInput}
                    onChange={(event) => setPaymentInput(event.target.value)}
                    className="w-40 rounded-md border border-slate-300 px-3 py-2 font-mono"
                    placeholder={totalOpen.toFixed(2)}
                  />
                </label>
              )}

              {closeHref && (
                <Link
                  href={
                    usePartialPayment && paymentValidationError ? "#" : closeHref
                  }
                  aria-disabled={Boolean(usePartialPayment && paymentValidationError)}
                  onClick={(event) => {
                    if (usePartialPayment && paymentValidationError) {
                      event.preventDefault();
                    }
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium text-white ${
                    usePartialPayment && paymentValidationError
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-blue-900 hover:bg-blue-950"
                  }`}
                >
                  {usePartialPayment ? "سند إغلاق جزئي" : "سند إغلاق حركات"}
                </Link>
              )}
            </div>
          )}

          {usePartialPayment && paymentValidationError && (
            <p className="mt-2 text-xs text-rose-700">{paymentValidationError}</p>
          )}
          {usePartialPayment &&
            parsedPaymentAmount != null &&
            !paymentValidationError && (
              <p className="mt-2 text-xs text-blue-900">
                سيُوزَّع {parsedPaymentAmount.toFixed(2)} على الأسطر (FIFO) —
                المتبقي {Math.max(0, totalOpen - parsedPaymentAmount).toFixed(2)}
              </p>
            )}
        </>
      )}
    </section>
  );
}
