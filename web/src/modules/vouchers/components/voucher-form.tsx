"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VoucherFormFeedback } from "@/modules/vouchers/components/voucher-form-feedback";
import { VoucherAdminPostedNotice } from "@/modules/vouchers/components/voucher-admin-posted-notice";
import { VoucherViewModeBar } from "@/modules/vouchers/components/voucher-view-mode-bar";
import { VoucherAllocations } from "@/modules/vouchers/components/voucher-allocations";
import { VoucherAttachmentsPanel } from "@/modules/vouchers/components/voucher-attachments-panel";
import { VoucherLinesTable } from "@/modules/vouchers/components/voucher-lines-table";
import {
  validateLineCategory,
  lineCategoryPayload,
} from "@/modules/vouchers/components/voucher-line-category-fields";
import { voucherLineCategoryApi } from "@/modules/vouchers/services/voucher-line-category-api";
import { useVoucherAccounts } from "@/modules/vouchers/hooks/use-voucher-accounts";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type {
  Account,
  OpenMovement,
  SettlementMode,
  VoucherAllocation,
  VoucherHeader,
  VoucherLine,
  VoucherLineCategory,
  VoucherStatus,
  VoucherType,
} from "@/modules/vouchers/types";
import {
  getSettlementModeLabel,
  getVoucherTypeLabel,
  isSettlementModeAllowed,
  VOUCHER_TYPE_CONFIG,
} from "@/modules/vouchers/utils/voucher-type-config";
import { useVoucherFeedback } from "@/modules/vouchers/hooks/use-voucher-feedback";
import { useVoucherFormPermissions } from "@/modules/vouchers/hooks/use-voucher-form-permissions";
import { useVoucherSaveFlow } from "@/modules/vouchers/hooks/use-voucher-save-flow";
import {
  getVoucherSaveFeedback,
  resolveVoucherSaveStatus,
} from "@/modules/vouchers/utils/voucher-save-utils";
import {
  approveWithOptionalAutoPost,
  getApproveButtonLabel,
} from "@/modules/vouchers/utils/voucher-auto-post-utils";

const DEFAULT_LINES: VoucherLine[] = [];
const DEFAULT_ALLOCATIONS: VoucherAllocation[] = [];

interface VoucherFormProps {
  initialMode?: "create" | "edit";
  initialVoucherId?: string;
  lockedVoucherType?: VoucherType;
  forceViewMode?: boolean;
}

export function VoucherForm({
  initialMode = "create",
  initialVoucherId,
  lockedVoucherType,
  forceViewMode = false,
}: VoucherFormProps) {
  const typeConfig = lockedVoucherType
    ? VOUCHER_TYPE_CONFIG[lockedVoucherType]
    : null;

  const [voucherId, setVoucherId] = useState(initialVoucherId ?? "");
  const [voucherNo, setVoucherNo] = useState("");
  const [nextNumberPreview, setNextNumberPreview] = useState("");
  const [autoNumberEnabled, setAutoNumberEnabled] = useState(true);
  const [allowManualOverride, setAllowManualOverride] = useState(false);
  const [voucherType, setVoucherType] = useState<VoucherType>(
    lockedVoucherType ?? "receipt",
  );
  const [settlementMode, setSettlementMode] = useState<SettlementMode>(
    typeConfig?.defaultSettlementMode ?? "account",
  );
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [journalEntryId, setJournalEntryId] = useState("");
  const [status, setStatus] = useState<VoucherStatus>("draft");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [lines, setLines] = useState<VoucherLine[]>(DEFAULT_LINES);
  const [allocations, setAllocations] =
    useState<VoucherAllocation[]>(DEFAULT_ALLOCATIONS);
  const { accounts, isLoadingAccounts } = useVoucherAccounts();
  const [openMovements, setOpenMovements] = useState<OpenMovement[]>([]);
  const [lineCategories, setLineCategories] = useState<VoucherLineCategory[]>([]);
  const { feedback, feedbackRef, showError, showSuccess, showFromError, clearFeedback } =
    useVoucherFeedback();
  const {
    beginSave,
    endSave,
    resolveVoucherIdForSave,
    updateSavedVoucherId,
    redirectAfterDraftSave,
  } = useVoucherSaveFlow({
    initialMode,
    voucherId,
    showSuccess,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [autoPostEnabled, setAutoPostEnabled] = useState(false);

  const isCreate = initialMode === "create" && !voucherId;
  const { canSave, canPost: canPostPermission, canDeleteLine, formReadOnly, canEditPosted } =
    useVoucherFormPermissions(isCreate ? "create" : "edit", status);
  const readOnly = formReadOnly || forceViewMode;
  const voucherNoReadOnly =
    readOnly ||
    (autoNumberEnabled && !allowManualOverride && (Boolean(voucherId) || isCreate));

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

  const pageTitle = useMemo(() => {
    if (initialMode === "edit") {
      return `تعديل ${getVoucherTypeLabel(voucherType)}`;
    }
    if (lockedVoucherType) {
      return VOUCHER_TYPE_CONFIG[lockedVoucherType].labelAr + " جديد";
    }
    return "سند جديد";
  }, [initialMode, lockedVoucherType, voucherType]);

  const buildHeaderPayload = (
    targetStatus: VoucherStatus,
    resolvedVoucherNo: string,
  ): Partial<VoucherHeader> => ({
    voucher_no: resolvedVoucherNo.trim(),
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
    cost_center_id: line.cost_center_id || null,
    ...lineCategoryPayload(line),
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
    const payloads = lines
      .map((line) => normalizeLine(line))
      .filter(
        (payload) =>
          payload.account_id && Number(payload.amount || 0) > 0,
      );

    await voucherApi.replaceVoucherLines(id, payloads);
  };

  const syncVoucherAllocations = async (id: string) => {
    const payloads = allocations
      .map((allocation) => normalizeAllocation(allocation))
      .filter(
        (payload) =>
          payload.target_journal_line_id &&
          Number(payload.applied_amount || 0) > 0,
      );

    await voucherApi.replaceVoucherAllocations(
      id,
      payloads.map((payload) => ({
        target_journal_line_id: payload.target_journal_line_id!,
        applied_amount: payload.applied_amount!,
        note: payload.note ?? null,
      })),
    );
  };

  const resolveVoucherNo = async (): Promise<string | null> => {
    if (voucherNo.trim()) {
      return voucherNo.trim();
    }

    if (autoNumberEnabled) {
      const reserved = await voucherApi.reserveVoucherNo(voucherType);
      setVoucherNo(reserved);
      setNextNumberPreview(reserved);
      return reserved;
    }

    showError("رقم السند مطلوب.");
    return null;
  };

  const saveVoucher = async (
    targetStatus: VoucherStatus,
    options?: { suppressSuccessFeedback?: boolean },
  ) => {
    if (!beginSave()) return null;

    try {
      for (const line of lines) {
        if (!line.account_id || Number(line.amount || 0) <= 0) continue;
        const categoryError = validateLineCategory(line, lineCategories);
        if (categoryError) {
          showError(categoryError);
          return null;
        }
      }

      let resolvedNo = voucherNo.trim();
      if (!resolvedNo) {
        const reserved = await resolveVoucherNo();
        if (!reserved) return null;
        resolvedNo = reserved;
      }

      const effectiveStatus = resolveVoucherSaveStatus(status, targetStatus);
      const payload = buildHeaderPayload(effectiveStatus, resolvedNo);

      const currentVoucherId = resolveVoucherIdForSave();
      const savedHeader = currentVoucherId
        ? await voucherApi.updateVoucher(currentVoucherId, payload)
        : await voucherApi.createVoucher(payload);

      const activeId = savedHeader.id;
      if (!currentVoucherId) {
        updateSavedVoucherId(activeId);
        setVoucherId(activeId);
      }

      await syncVoucherLines(activeId);
      if (settlementMode === "invoice") {
        await syncVoucherAllocations(activeId);
      }

      if (effectiveStatus === "posted") {
        await voucherApi.syncPostedVoucherJournal(activeId);
      }

      const feedbackMessage = getVoucherSaveFeedback(status, targetStatus);
      if (redirectAfterDraftSave(activeId, feedbackMessage, targetStatus)) {
        return activeId;
      }

      setVoucherNo(savedHeader.voucher_no);
      setStatus(savedHeader.status);
      if (!options?.suppressSuccessFeedback) {
        showSuccess(feedbackMessage);
      }

      if (initialMode === "edit") {
        const details = await voucherApi.getVoucherById(activeId);
        setLines(details.lines);
      }

      return activeId;
    } catch (error) {
      showFromError(error);
      return null;
    } finally {
      endSave();
    }
  };

  const onAdminSavePosted = async () => {
    setIsSaving(true);
    try {
      await saveVoucher("posted");
    } finally {
      setIsSaving(false);
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
      const result = await approveWithOptionalAutoPost({
        autoPostEnabled,
        canPost,
        canPostPermission,
        saveApproved: () =>
          saveVoucher("approved", { suppressSuccessFeedback: autoPostEnabled }),
        postVoucher: voucherApi.postVoucher,
        showError,
        postBlockedMessage: "تعذر الترحيل. تحقق من توازن الاسطر والتخصيصات.",
      });
      if (!result) return;
      if (result.posted) {
        setStatus("posted");
        setJournalEntryId(result.journalEntryId ?? "");
        showSuccess(`تم الاعتماد والترحيل. القيد: ${result.journalEntryNo ?? "—"}`);
      }
    } catch (error) {
      showFromError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const onPost = async () => {
    if (!canPost) {
      showError("تعذر الترحيل. تحقق من توازن الاسطر والتخصيصات.");
      return;
    }

    setIsSaving(true);
    try {
      const activeId = await saveVoucher("approved");
      if (!activeId) return;

      const response = await voucherApi.postVoucher(activeId);
      setStatus("posted");
      setJournalEntryId(response.journal_entry_id);
      showSuccess(`تم ترحيل السند بنجاح. رقم القيد: ${response.journal_entry_no}`);
    } catch (error) {
      showFromError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const onReverse = async () => {
    if (status !== "posted") return;
    if (!voucherId) return;

    setIsSaving(true);
    try {
      const reversal = await voucherApi.reverseVoucher(voucherId);
      showSuccess(
        `تم عكس السند بنجاح. رقم السند العكسي: ${reversal.reversed_voucher_id}`,
      );
    } catch (error) {
      showFromError(error);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (lockedVoucherType) {
      setVoucherType(lockedVoucherType);
      setSettlementMode(VOUCHER_TYPE_CONFIG[lockedVoucherType].defaultSettlementMode);
    }
  }, [lockedVoucherType]);

  useEffect(() => {
    if (!isSettlementModeAllowed(voucherType, settlementMode)) {
      setSettlementMode(VOUCHER_TYPE_CONFIG[voucherType].defaultSettlementMode);
    }
  }, [voucherType, settlementMode]);

  useEffect(() => {
    let cancelled = false;
    void voucherApi.getVoucherTypeDefaults(voucherType).then((defaults) => {
      if (!cancelled) setAutoPostEnabled(defaults.auto_post_enabled ?? false);
    });
    return () => {
      cancelled = true;
    };
  }, [voucherType]);

  useEffect(() => {
    let cancelled = false;
    void voucherLineCategoryApi.listCategories(voucherType, true).then((data) => {
      if (!cancelled) setLineCategories(data);
    });
    return () => {
      cancelled = true;
    };
  }, [voucherType]);

  useEffect(() => {
    let cancelled = false;

    const loadVoucher = async () => {
      try {
        const [openMovementsData, settings] = await Promise.all([
          voucherApi.listOpenMovements(),
          voucherApi.getVoucherSettings(),
        ]);
        if (!cancelled) {
          setOpenMovements(openMovementsData);
          setAutoNumberEnabled(settings.auto_number_enabled);
          setAllowManualOverride(settings.allow_manual_override);
        }

        if (initialMode !== "edit" || !initialVoucherId) {
          if (!cancelled && settings.auto_number_enabled) {
            const type = lockedVoucherType ?? "receipt";
            const preview = await voucherApi.peekVoucherNo(type);
            if (!cancelled) setNextNumberPreview(preview);
          }
          if (!cancelled) setIsLoading(false);
          return;
        }

        const details = await voucherApi.getVoucherById(initialVoucherId);
        if (cancelled) return;

        setVoucherId(details.header.id);
        setVoucherNo(details.header.voucher_no);
        setNextNumberPreview(details.header.voucher_no);
        setVoucherType(details.header.voucher_type);
        setSettlementMode(details.header.settlement_mode);
        setVoucherDate(details.header.voucher_date);
        setJournalEntryId(details.header.journal_entry_id ?? "");
        setStatus(details.header.status);
        setDescription(details.header.description ?? "");
        setCustomerId(details.header.customer_id ?? "");
        setVendorId(details.header.vendor_id ?? "");
        setLines(details.lines);
        setAllocations(details.allocations);
      } catch (error) {
        if (!cancelled) showFromError(error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadVoucher();
    return () => {
      cancelled = true;
    };
  }, [initialMode, initialVoucherId, lockedVoucherType]);

  useEffect(() => {
    if (initialMode === "edit" || voucherId || !autoNumberEnabled) return;

    let cancelled = false;
    const loadPreview = async () => {
      try {
        const preview = await voucherApi.peekVoucherNo(voucherType);
        if (!cancelled) setNextNumberPreview(preview);
      } catch {
        if (!cancelled) setNextNumberPreview("");
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [voucherType, initialMode, voucherId, autoNumberEnabled]);

  if (isLoading || isLoadingAccounts) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        جاري تحميل السند...
      </div>
    );
  }

  const allowedSettlementModes =
    VOUCHER_TYPE_CONFIG[voucherType].allowedSettlementModes;

  return (
    <div className="space-y-4">
      <VoucherViewModeBar
        forceViewMode={forceViewMode}
        voucherId={voucherId || initialVoucherId || ""}
        status={status}
      />
      {typeConfig && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${typeConfig.colorClass}`}
        >
          <p className="font-semibold">{typeConfig.labelAr}</p>
          <p className="mt-0.5 opacity-90">{typeConfig.descriptionAr}</p>
        </div>
      )}

      <VoucherAdminPostedNotice visible={canEditPosted} />

      <VoucherFormFeedback
        feedback={feedback}
        feedbackRef={feedbackRef}
        onDismiss={clearFeedback}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
          <StatusChip status={status} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">رقم السند</span>
            <input
              value={voucherNo || nextNumberPreview}
              onChange={(event) => setVoucherNo(event.target.value)}
              disabled={voucherNoReadOnly || isSaving}
              placeholder={nextNumberPreview || "RCP-2026-0001"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono outline-none focus:border-blue-900 disabled:bg-slate-50"
            />
            {isCreate && autoNumberEnabled && !voucherNo && (
              <span className="text-xs text-slate-500">
                يُحجز الرقم تلقائياً عند الحفظ
              </span>
            )}
          </label>

          {!lockedVoucherType && (
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">نوع السند</span>
              <select
                value={voucherType}
                onChange={(event) =>
                  setVoucherType(event.target.value as VoucherType)
                }
                disabled={readOnly || isSaving || Boolean(voucherId)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900"
              >
                <option value="receipt">قبض</option>
                <option value="payment">دفع</option>
                <option value="settlement">تصفية</option>
              </select>
            </label>
          )}

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
              {allowedSettlementModes.map((mode) => (
                <option key={mode} value={mode}>
                  {getSettlementModeLabel(mode)}
                </option>
              ))}
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
        accounts={accounts}
        lineCategories={lineCategories}
        onChange={setLines}
        readOnly={readOnly || isSaving}
        allowLineDelete={canDeleteLine}
      />

      <VoucherAllocations
        allocations={allocations}
        openMovements={openMovements}
        onChange={setAllocations}
        readOnly={readOnly || isSaving}
        visible={isAllocationVisible}
      />

      <VoucherAttachmentsPanel
        voucherId={voucherId}
        canManage={canSave && !readOnly}
        readOnly={readOnly || isSaving}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
          <p className="font-mono">مدين: {totals.debit.toFixed(2)}</p>
          <p className="font-mono">دائن: {totals.credit.toFixed(2)}</p>
          <p className="font-mono">فرق: {totals.difference.toFixed(2)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditPosted && (
            <button
              type="button"
              onClick={() => void onAdminSavePosted()}
              disabled={isSaving}
              className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              حفظ التعديلات (مدير)
            </button>
          )}
          {canSave && !canEditPosted && (
            <>
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={isSaving}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                حفظ مسودة
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={isSaving || (autoPostEnabled && !canPost)}
                className="rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-50"
              >
                {getApproveButtonLabel(autoPostEnabled)}
              </button>
            </>
          )}
          {canPostPermission && !canEditPosted && !autoPostEnabled && (
            <button
              type="button"
              onClick={onPost}
              disabled={!canPost || isSaving}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              ترحيل
            </button>
          )}
          {canPostPermission && (
            <button
              type="button"
              onClick={onReverse}
              disabled={status !== "posted" || isSaving}
              className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-50"
            >
              عكس
            </button>
          )}
          <Link
            href="/vouchers"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            قائمة السندات
          </Link>
          {journalEntryId && (
            <Link
              href={`/journals/${journalEntryId}`}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              فتح القيد الناتج
            </Link>
          )}
        </div>
        <VoucherFormFeedback feedback={feedback} onDismiss={clearFeedback} className="mt-3" />
      </section>
    </div>
  );
}
