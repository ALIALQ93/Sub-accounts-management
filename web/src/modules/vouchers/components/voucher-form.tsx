"use client";

import { useMemo, useState } from "react";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VoucherAllocations } from "@/modules/vouchers/components/voucher-allocations";
import { VoucherLinesTable } from "@/modules/vouchers/components/voucher-lines-table";
import type {
  SettlementMode,
  VoucherAllocation,
  VoucherLine,
  VoucherStatus,
  VoucherType,
} from "@/modules/vouchers/types";

const DEFAULT_LINES: VoucherLine[] = [];
const DEFAULT_ALLOCATIONS: VoucherAllocation[] = [];

interface VoucherFormProps {
  initialMode?: "create" | "edit";
  initialVoucherId?: string;
}

export function VoucherForm({
  initialMode = "create",
  initialVoucherId,
}: VoucherFormProps) {
  const [voucherNo, setVoucherNo] = useState(
    initialVoucherId ? `RCP-${initialVoucherId.slice(0, 8)}` : "",
  );
  const [voucherType, setVoucherType] = useState<VoucherType>("receipt");
  const [settlementMode, setSettlementMode] =
    useState<SettlementMode>("account");
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [status, setStatus] = useState<VoucherStatus>("draft");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [lines, setLines] = useState<VoucherLine[]>(DEFAULT_LINES);
  const [allocations, setAllocations] =
    useState<VoucherAllocation[]>(DEFAULT_ALLOCATIONS);
  const [feedback, setFeedback] = useState("");

  const readOnly = status === "posted" || status === "cancelled";

  const totals = useMemo(() => {
    const debit = lines
      .filter((line) => line.side === "debit")
      .reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const credit = lines
      .filter((line) => line.side === "credit")
      .reduce((sum, line) => sum + Number(line.amount || 0), 0);
    return { debit, credit, difference: debit - credit };
  }, [lines]);

  const isAllocationVisible =
    settlementMode === "invoice" &&
    (voucherType === "receipt" || voucherType === "payment");

  const canPost =
    !readOnly &&
    lines.length > 0 &&
    totals.difference === 0 &&
    (settlementMode !== "invoice" || allocations.length > 0);

  const onSaveDraft = () => {
    setStatus("draft");
    setFeedback("تم حفظ السند كمسودة.");
  };

  const onApprove = () => {
    if (readOnly) return;
    setStatus("approved");
    setFeedback("تم اعتماد السند.");
  };

  const onPost = () => {
    if (!canPost) {
      setFeedback("تعذر الترحيل. تحقق من توازن الاسطر والتخصيصات.");
      return;
    }
    setStatus("posted");
    setFeedback("تم ترحيل السند بنجاح.");
  };

  const onReverse = () => {
    if (status !== "posted") return;
    setFeedback("تم طلب عكس السند (ربط API لاحقا).");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            {initialMode === "create" ? "سند جديد" : "تعديل سند"}
          </h1>
          <StatusChip status={status} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">رقم السند</span>
            <input
              value={voucherNo}
              onChange={(event) => setVoucherNo(event.target.value)}
              disabled={readOnly}
              placeholder="RCP-2026-0001"
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">نوع السند</span>
            <select
              value={voucherType}
              onChange={(event) => setVoucherType(event.target.value as VoucherType)}
              disabled={readOnly}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
            >
              <option value="receipt">قبض</option>
              <option value="payment">دفع</option>
              <option value="settlement">تصفية</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">وضع التسوية</span>
            <select
              value={settlementMode}
              onChange={(event) =>
                setSettlementMode(event.target.value as SettlementMode)
              }
              disabled={readOnly}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
            >
              <option value="account">على الحساب</option>
              <option value="invoice">اغلاق حركات</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">التاريخ</span>
            <input
              type="date"
              value={voucherDate}
              onChange={(event) => setVoucherDate(event.target.value)}
              disabled={readOnly}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">مرجع عميل (اختياري)</span>
            <input
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                if (event.target.value) setVendorId("");
              }}
              disabled={readOnly}
              placeholder="customer_id"
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">مرجع مورد (اختياري)</span>
            <input
              value={vendorId}
              onChange={(event) => {
                setVendorId(event.target.value);
                if (event.target.value) setCustomerId("");
              }}
              disabled={readOnly}
              placeholder="vendor_id"
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
            />
          </label>
        </div>

        <label className="mt-3 block space-y-1 text-sm">
          <span className="font-medium text-slate-700">وصف السند</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={readOnly}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
          />
        </label>
      </section>

      <VoucherLinesTable lines={lines} onChange={setLines} readOnly={readOnly} />

      <VoucherAllocations
        allocations={allocations}
        onChange={setAllocations}
        readOnly={readOnly}
        visible={isAllocationVisible}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
          <p className="font-mono">مدين: {totals.debit.toFixed(2)}</p>
          <p className="font-mono">دائن: {totals.credit.toFixed(2)}</p>
          <p className="font-mono">فرق: {totals.difference.toFixed(2)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={readOnly}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            حفظ مسودة
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={readOnly}
            className="rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-50"
          >
            اعتماد
          </button>
          <button
            type="button"
            onClick={onPost}
            disabled={!canPost}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            ترحيل
          </button>
          <button
            type="button"
            onClick={onReverse}
            disabled={status !== "posted"}
            className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-50"
          >
            عكس
          </button>
        </div>
        {feedback && (
          <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            {feedback}
          </p>
        )}
      </section>
    </div>
  );
}
