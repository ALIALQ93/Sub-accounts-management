"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VoucherAllocations } from "@/modules/vouchers/components/voucher-allocations";
import { VoucherLinesTable } from "@/modules/vouchers/components/voucher-lines-table";
import {
  ApiError,
  voucherApi,
} from "@/modules/vouchers/services/voucher-api";
import type {
  SettlementMode,
  VoucherAllocation,
  VoucherHeader,
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
  const [voucherId, setVoucherId] = useState(initialVoucherId ?? "");
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
  const [isLoading, setIsLoading] = useState(initialMode === "edit");
  const [isSaving, setIsSaving] = useState(false);

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

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error) return error.message;
    return "حدث خطأ غير متوقع.";
  };

  const buildHeaderPayload = (
    targetStatus: VoucherStatus,
  ): Partial<VoucherHeader> => ({
    voucher_no: voucherNo.trim(),
    voucher_type: voucherType,
    settlement_mode: settlementMode,
    voucher_date: voucherDate,
    description: description.trim() || null,
    status: targetStatus,
    customer_id: customerId.trim() || null,
    vendor_id: vendorId.trim() || null,
  });

  const normalizeLine = (line: VoucherLine): Partial<VoucherLine> => ({
    account_id: line.account_id || line.account_code || "",
    side: line.side,
    amount: Number(line.amount || 0),
    line_description: line.line_description?.trim() || null,
  });

  const normalizeAllocation = (
    allocation: VoucherAllocation,
  ): Partial<VoucherAllocation> => ({
    target_journal_line_id:
      allocation.target_journal_line_id || allocation.target_reference || "",
    applied_amount: Number(allocation.applied_amount || 0),
    note: allocation.note?.trim() || null,
  });

  const syncVoucherLines = async (id: string) => {
    const details = await voucherApi.getVoucherById(id);
    for (const existingLine of details.lines) {
      await voucherApi.deleteVoucherLine(id, existingLine.id);
    }

    for (const line of lines) {
      const payload = normalizeLine(line);
      if (!payload.account_id || Number(payload.amount || 0) <= 0) continue;
      await voucherApi.addVoucherLine(id, payload);
    }
  };

  const syncVoucherAllocations = async (id: string) => {
    const details = await voucherApi.getVoucherById(id);
    for (const existingAllocation of details.allocations) {
      await voucherApi.deleteAllocation(id, existingAllocation.id);
    }

    for (const allocation of allocations) {
      const payload = normalizeAllocation(allocation);
      if (
        !payload.target_journal_line_id ||
        Number(payload.applied_amount || 0) <= 0
      ) {
        continue;
      }
      await voucherApi.addAllocation(id, payload);
    }
  };

  const saveVoucher = async (targetStatus: VoucherStatus) => {
    if (!voucherNo.trim()) {
      setFeedback("رقم السند مطلوب.");
      return null;
    }

    try {
      const payload = buildHeaderPayload(targetStatus);

      const savedHeader = voucherId
        ? await voucherApi.updateVoucher(voucherId, payload)
        : await voucherApi.createVoucher(payload);

      const activeId = savedHeader.id;
      if (!voucherId) setVoucherId(activeId);

      await syncVoucherLines(activeId);
      if (settlementMode === "invoice") {
        await syncVoucherAllocations(activeId);
      }

      setStatus(savedHeader.status);
      setFeedback(
        targetStatus === "approved" ? "تم حفظ واعتماد السند." : "تم حفظ السند بنجاح.",
      );

      return activeId;
    } catch (error) {
      setFeedback(getErrorMessage(error));
      return null;
    }
  };

  const onSaveDraft = async () => {
    setIsSaving(true);
    try {
      await saveVoucher("draft");
    } finally {
      setIsSaving(false);
    }
  };

  const onApprove = async () => {
    if (readOnly) return;
    setIsSaving(true);
    try {
      await saveVoucher("approved");
    } finally {
      setIsSaving(false);
    }
  };

  const onPost = async () => {
    if (!canPost) {
      setFeedback("تعذر الترحيل. تحقق من توازن الاسطر والتخصيصات.");
      return;
    }

    setIsSaving(true);
    try {
      const activeId = await saveVoucher("approved");
      if (!activeId) return;

      const response = await voucherApi.postVoucher(activeId);
      setStatus("posted");
      setFeedback(`تم ترحيل السند بنجاح. رقم القيد: ${response.journal_entry_no}`);
    } catch (error) {
      setFeedback(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const onReverse = async () => {
    if (status !== "posted") return;
    if (!voucherId) return;

    setIsSaving(true);
    try {
      await voucherApi.reverseVoucher(voucherId);
      setFeedback("تم إرسال طلب عكس السند بنجاح.");
    } catch (error) {
      setFeedback(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadVoucher = async () => {
      if (initialMode !== "edit" || !initialVoucherId) {
        setIsLoading(false);
        return;
      }

      try {
        const details = await voucherApi.getVoucherById(initialVoucherId);
        if (cancelled) return;

        setVoucherId(details.header.id);
        setVoucherNo(details.header.voucher_no);
        setVoucherType(details.header.voucher_type);
        setSettlementMode(details.header.settlement_mode);
        setVoucherDate(details.header.voucher_date);
        setStatus(details.header.status);
        setDescription(details.header.description ?? "");
        setCustomerId(details.header.customer_id ?? "");
        setVendorId(details.header.vendor_id ?? "");
        setLines(details.lines);
        setAllocations(details.allocations);
      } catch (error) {
        if (!cancelled) setFeedback(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadVoucher();
    return () => {
      cancelled = true;
    };
  }, [initialMode, initialVoucherId]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        جاري تحميل السند...
      </div>
    );
  }

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
              disabled={readOnly || isSaving}
              placeholder="RCP-2026-0001"
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">نوع السند</span>
            <select
              value={voucherType}
              onChange={(event) => setVoucherType(event.target.value as VoucherType)}
              disabled={readOnly || isSaving}
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
              disabled={readOnly || isSaving}
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
              disabled={readOnly || isSaving}
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
              disabled={readOnly || isSaving}
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
              disabled={readOnly || isSaving}
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
            disabled={readOnly || isSaving}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
          />
        </label>
      </section>

      <VoucherLinesTable
        lines={lines}
        onChange={setLines}
        readOnly={readOnly || isSaving}
      />

      <VoucherAllocations
        allocations={allocations}
        onChange={setAllocations}
        readOnly={readOnly || isSaving}
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
            disabled={readOnly || isSaving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            حفظ مسودة
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={readOnly || isSaving}
            className="rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-50"
          >
            اعتماد
          </button>
          <button
            type="button"
            onClick={onPost}
            disabled={!canPost || isSaving}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            ترحيل
          </button>
          <button
            type="button"
            onClick={onReverse}
            disabled={status !== "posted" || isSaving}
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
