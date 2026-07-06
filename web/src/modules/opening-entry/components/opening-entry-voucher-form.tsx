"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { branchApi, type BranchOption } from "@/modules/branches/services/branch-api";
import { openingEntryApi } from "@/modules/opening-entry/services/opening-entry-api";
import {
  buildOpeningEntryLinesForSave,
  computeOpeningEntryTotals,
  splitOpeningEntryLines,
  validateOpeningEntryBalance,
  type OpeningEntryLine,
} from "@/modules/opening-entry/utils/opening-entry-utils";
import { DocumentActionLinks } from "@/components/open-in-new-tab-link";
import {
  SettlementVoucherLinesTable,
} from "@/modules/vouchers/components/settlement-voucher-lines-table";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VoucherAdminPostedNotice } from "@/modules/vouchers/components/voucher-admin-posted-notice";
import { VoucherViewModeBar } from "@/modules/vouchers/components/voucher-view-mode-bar";
import { VoucherCurrencyFields } from "@/modules/vouchers/components/voucher-currency-fields";
import { VoucherAttachmentsPanel } from "@/modules/vouchers/components/voucher-attachments-panel";
import { useVoucherAccounts } from "@/modules/vouchers/hooks/use-voucher-accounts";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { CostCenter, VoucherHeader, VoucherStatus } from "@/modules/vouchers/types";
import type { Currency } from "@/modules/currencies/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import {
  formatVoucherAmount,
  getAmountStep,
  resolveVoucherExchangeRate,
  validateVoucherExchangeRate,
} from "@/modules/vouchers/utils/voucher-currency-utils";
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

interface OpeningEntryVoucherFormProps {
  initialMode?: "create" | "edit";
  initialVoucherId?: string;
  forceViewMode?: boolean;
}

const EMPTY_LINES: OpeningEntryLine[] = [];

export function OpeningEntryVoucherForm({
  initialMode = "create",
  initialVoucherId,
  forceViewMode = false,
}: OpeningEntryVoucherFormProps) {
  const [voucherId, setVoucherId] = useState(initialVoucherId ?? "");
  const [voucherNo, setVoucherNo] = useState("");
  const [nextNumberPreview, setNextNumberPreview] = useState("");
  const [autoNumberEnabled, setAutoNumberEnabled] = useState(true);
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [journalEntryId, setJournalEntryId] = useState("");
  const [status, setStatus] = useState<VoucherStatus>("draft");
  const [description, setDescription] = useState("قيد افتتاحي");
  const [branchId, setBranchId] = useState("");
  const [userLines, setUserLines] = useState<OpeningEntryLine[]>(EMPTY_LINES);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const { accounts, isLoadingAccounts } = useVoucherAccounts();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [autoPostEnabled, setAutoPostEnabled] = useState(false);

  const { showError, showSuccess, showFromError } = useVoucherFeedback();
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

  const isCreate = initialMode === "create" && !voucherId;
  const { canSave, canPost: canPostPermission, canDeleteLine, formReadOnly, canEditPosted } =
    useVoucherFormPermissions(isCreate ? "create" : "edit", status);
  const readOnly = formReadOnly || forceViewMode;
  const voucherNoReadOnly =
    readOnly || (autoNumberEnabled && (Boolean(voucherId) || isCreate));

  const selectedCurrency = currencies.find((currency) => currency.id === currencyId);
  const amountStep = getAmountStep(selectedCurrency?.decimal_places ?? 2);
  const balanceError = useMemo(
    () => validateOpeningEntryBalance(userLines),
    [userLines],
  );
  const { totalDebit, totalCredit } = useMemo(
    () => computeOpeningEntryTotals(userLines),
    [userLines],
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.001;

  const canPost =
    !readOnly &&
    Boolean(currencyId) &&
    Boolean(branchId) &&
    isBalanced &&
    balanceError === null &&
    exchangeRate > 0;

  const buildHeaderPayload = (
    targetStatus: VoucherStatus,
    resolvedVoucherNo: string,
  ): Partial<VoucherHeader> => ({
    voucher_no: resolvedVoucherNo.trim(),
    voucher_type: "settlement",
    settlement_mode: "account",
    voucher_date: voucherDate,
    description: description.trim() || "قيد افتتاحي",
    status: targetStatus,
    customer_id: null,
    vendor_id: null,
    currency_id: currencyId || null,
    exchange_rate: exchangeRate > 0 ? exchangeRate : null,
    branch_id: branchId || null,
    is_opening_entry: true,
  });

  const resolveVoucherNo = async (): Promise<string | null> => {
    if (voucherNo.trim()) return voucherNo.trim();
    if (autoNumberEnabled) {
      const reserved = await voucherApi.reserveVoucherNo("settlement");
      setVoucherNo(reserved);
      setNextNumberPreview(reserved);
      return reserved;
    }
    showError("رقم السند مطلوب.");
    return null;
  };

  const syncVoucherLines = async (id: string) => {
    const linesToSave = buildOpeningEntryLinesForSave(userLines);
    await voucherApi.replaceVoucherLines(
      id,
      linesToSave.map((line) => ({
        account_id: line.account_id,
        side: line.side,
        amount: Number(line.amount),
        line_description: line.line_description?.trim() || null,
        cost_center_id: line.cost_center_id || null,
      })),
    );
  };

  const saveVoucher = async (
    targetStatus: VoucherStatus,
    options?: { suppressSuccessFeedback?: boolean },
  ) => {
    if (!beginSave()) return null;

    try {
      if (!currencyId) {
        showError("اختر عملة السند.");
        return null;
      }
      if (!branchId) {
        showError("اختر الفرع.");
        return null;
      }
      if (balanceError) {
        showError(balanceError);
        return null;
      }

      const rateError = validateVoucherExchangeRate({
        currencyId,
        exchangeRate,
        currencies,
      });
      if (rateError) {
        showError(rateError);
        return null;
      }

      const willPost =
        targetStatus === "posted" ||
        (targetStatus === "approved" && autoPostEnabled && canPostPermission);

      if (willPost) {
        try {
          await openingEntryApi.assertCanPostOpeningEntry({
            branchId,
            voucherDate,
            excludeVoucherId: voucherId || undefined,
          });
        } catch (error) {
          showError(
            error instanceof Error
              ? error.message
              : "يوجد قيد افتتاحي مرحّل لهذا الفرع في نفس السنة.",
          );
          return null;
        }
      }

      const resolvedNo = await resolveVoucherNo();
      if (!resolvedNo) return null;

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
        setUserLines(splitOpeningEntryLines(details.lines));
      }

      return activeId;
    } catch (error) {
      showFromError(error);
      return null;
    } finally {
      endSave();
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [costCentersData, currenciesData, settings, typeDefaults, branchesData] =
          await Promise.all([
            voucherApi.listCostCenters(),
            currencyApi.listActiveCurrencies(),
            voucherApi.getVoucherSettings(),
            voucherApi.getVoucherTypeDefaults("settlement"),
            branchApi.listBranchOptions(),
          ]);

        if (cancelled) return;

        setCostCenters(costCentersData);
        setCurrencies(currenciesData);
        setBranches(branchesData.filter((branch) => branch.is_active));
        setAutoNumberEnabled(settings.auto_number_enabled);
        setAutoPostEnabled(typeDefaults.auto_post_enabled ?? false);

        const baseCurrency =
          currenciesData.find((currency) => currency.is_base) ??
          currenciesData[0];
        const defaultCurrencyId =
          typeDefaults.default_currency_id ?? baseCurrency?.id ?? "";
        setCurrencyId(defaultCurrencyId);
        setBranchId(branchesData.find((branch) => branch.is_active)?.id ?? "");

        void resolveVoucherExchangeRate({
          currencyId: defaultCurrencyId,
          voucherDate: new Date().toISOString().split("T")[0],
          currencies: currenciesData,
        }).then((rate) => {
          if (!cancelled) setExchangeRate(rate);
        });

        if (initialMode !== "edit" || !initialVoucherId) {
          if (settings.auto_number_enabled) {
            const preview = await voucherApi.peekVoucherNo("settlement");
            if (!cancelled) setNextNumberPreview(preview);
          }
          setIsLoading(false);
          return;
        }

        const details = await voucherApi.getVoucherById(initialVoucherId);
        if (cancelled) return;

        setVoucherId(details.header.id);
        setVoucherNo(details.header.voucher_no);
        setNextNumberPreview(details.header.voucher_no);
        setVoucherDate(details.header.voucher_date);
        setCurrencyId(details.header.currency_id ?? defaultCurrencyId);
        setExchangeRate(
          details.header.exchange_rate ??
            baseCurrency?.exchange_rate ??
            1,
        );
        setBranchId(details.header.branch_id ?? "");
        setJournalEntryId(details.header.journal_entry_id ?? "");
        setStatus(details.header.status);
        setDescription(details.header.description ?? "قيد افتتاحي");
        setUserLines(splitOpeningEntryLines(details.lines));
      } catch (error) {
        if (!cancelled) showFromError(error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [initialMode, initialVoucherId, showFromError]);

  const refreshExchangeRate = async (nextCurrencyId: string, nextDate: string) => {
    if (!nextCurrencyId) return;
    setIsLoadingRate(true);
    try {
      const rate = await resolveVoucherExchangeRate({
        currencyId: nextCurrencyId,
        voucherDate: nextDate,
        currencies,
      });
      setExchangeRate(rate);
    } finally {
      setIsLoadingRate(false);
    }
  };

  if (isLoading || isLoadingAccounts) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        جاري تحميل قيد الافتتاح...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VoucherViewModeBar
        forceViewMode={forceViewMode}
        voucherId={voucherId || initialVoucherId || ""}
        status={status}
      />

      <div className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
        <p className="font-semibold">قيد افتتاحي</p>
        <p className="mt-0.5 opacity-90">
          ميزانية افتتاحية — أسطر مدين/دائن متوازنة per فرع. لا تخصيصات إغلاق
          حركات.
        </p>
      </div>

      <VoucherAdminPostedNotice visible={canEditPosted} />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">
            {initialMode === "create" ? "قيد افتتاحي جديد" : "تعديل قيد افتتاحي"}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={status} />
            {journalEntryId && (
              <Link
                href={`/journals/${journalEntryId}`}
                className="text-xs text-blue-800 hover:underline"
              >
                القيد: {journalEntryId.slice(0, 8)}…
              </Link>
            )}
            {voucherId && (
              <DocumentActionLinks href={`/vouchers/${voucherId}?mode=view`} />
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">رقم السند</span>
            <input
              value={voucherNo || nextNumberPreview}
              onChange={(event) => setVoucherNo(event.target.value)}
              readOnly={voucherNoReadOnly}
              className="rounded-md border border-slate-300 px-3 py-2 font-mono"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">التاريخ *</span>
            <input
              type="date"
              value={voucherDate}
              onChange={(event) => {
                setVoucherDate(event.target.value);
                void refreshExchangeRate(currencyId, event.target.value);
              }}
              disabled={readOnly || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">الفرع *</span>
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              disabled={readOnly || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">اختر فرعاً</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_code} — {branch.name_ar}
                </option>
              ))}
            </select>
          </label>
        </div>

        <VoucherCurrencyFields
          currencies={currencies}
          currencyId={currencyId}
          exchangeRate={exchangeRate}
          isLoadingRate={isLoadingRate}
          readOnly={readOnly || isSaving}
          onCurrencyChange={(nextCurrencyId) => {
            setCurrencyId(nextCurrencyId);
            void refreshExchangeRate(nextCurrencyId, voucherDate);
          }}
          onExchangeRateChange={setExchangeRate}
        />

        <label className="mt-3 block space-y-1 text-sm">
          <span className="font-medium text-slate-700">وصف السند</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={readOnly || isSaving}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </section>

      <SettlementVoucherLinesTable
        lines={userLines}
        accounts={accounts}
        costCenters={costCenters}
        lineCategories={[]}
        currencies={currencies}
        voucherCurrencyId={currencyId}
        amountStep={amountStep}
        onChange={setUserLines}
        readOnly={readOnly || isSaving}
        allowLineDelete={canDeleteLine}
      />

      <VoucherAttachmentsPanel
        voucherId={voucherId}
        canManage={canSave && !readOnly}
        readOnly={readOnly || isSaving}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="font-mono text-indigo-900">
            إجمالي المدين: {formatVoucherAmount(totalDebit, selectedCurrency)}
          </p>
          <p className="font-mono text-indigo-900">
            إجمالي الدائن: {formatVoucherAmount(totalCredit, selectedCurrency)}
          </p>
        </div>
        {balanceError && !readOnly && (
          <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {balanceError}
          </p>
        )}
        {!balanceError && isBalanced && totalDebit > 0 && (
          <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            القيد متوازن ✓
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {canSave && !canEditPosted && (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsSaving(true);
                  void saveVoucher("draft").finally(() => setIsSaving(false));
                }}
                disabled={isSaving}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
              >
                حفظ مسودة
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSaving(true);
                  void (async () => {
                    try {
                      const result = await approveWithOptionalAutoPost({
                        autoPostEnabled,
                        canPost,
                        canPostPermission,
                        saveApproved: () =>
                          saveVoucher("approved", {
                            suppressSuccessFeedback: autoPostEnabled,
                          }),
                        postVoucher: async (id) => {
                          await openingEntryApi.assertCanPostOpeningEntry({
                            branchId,
                            voucherDate,
                            excludeVoucherId: id,
                          });
                          return voucherApi.postVoucher(id);
                        },
                        showError,
                        postBlockedMessage:
                          balanceError ?? "تعذر الترحيل. تحقق من التوازن والفرع.",
                      });
                      if (!result) return;
                      if (result.posted) {
                        setStatus("posted");
                        setJournalEntryId(result.journalEntryId ?? "");
                        showSuccess(
                          `تم الاعتماد والترحيل. القيد: ${result.journalEntryNo ?? "—"}`,
                        );
                      }
                    } catch (error) {
                      showFromError(error);
                    }
                  })().finally(() => setIsSaving(false));
                }}
                disabled={isSaving || (autoPostEnabled && !canPost)}
                className="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-800 disabled:opacity-50"
              >
                {getApproveButtonLabel(autoPostEnabled)}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
