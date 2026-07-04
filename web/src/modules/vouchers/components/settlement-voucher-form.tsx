"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DocumentActionLinks } from "@/components/open-in-new-tab-link";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import {
  validateLineCategory,
  lineCategoryPayload,
} from "@/modules/vouchers/components/voucher-line-category-fields";
import {
  buildSettlementVoucherLinesForSave,
  isValidSettlementUserLine,
  SettlementVoucherLinesTable,
  settlementLineHasBothSides,
  splitSettlementVoucherLines,
  toCostCenterBalanceLines,
  type SettlementUserLine,
} from "@/modules/vouchers/components/settlement-voucher-lines-table";
import { voucherLineCategoryApi } from "@/modules/vouchers/services/voucher-line-category-api";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VoucherFormFeedback } from "@/modules/vouchers/components/voucher-form-feedback";
import { VoucherAdminPostedNotice } from "@/modules/vouchers/components/voucher-admin-posted-notice";
import { VoucherViewModeBar } from "@/modules/vouchers/components/voucher-view-mode-bar";
import { VoucherCurrencyFields } from "@/modules/vouchers/components/voucher-currency-fields";
import { VoucherAttachmentsPanel } from "@/modules/vouchers/components/voucher-attachments-panel";
import { useVoucherAccounts } from "@/modules/vouchers/hooks/use-voucher-accounts";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type {
  Account,
  CostCenter,
  VoucherHeader,
  VoucherLineCategory,
  VoucherStatus,
} from "@/modules/vouchers/types";
import type { Currency } from "@/modules/currencies/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import {
  formatVoucherAmount,
  getAmountStep,
  resolveVoucherExchangeRate,
  validateSettlementVoucherAccounts,
  validateVoucherExchangeRate,
} from "@/modules/vouchers/utils/voucher-currency-utils";
import { useVoucherFeedback } from "@/modules/vouchers/hooks/use-voucher-feedback";
import { useVoucherFormPermissions } from "@/modules/vouchers/hooks/use-voucher-form-permissions";
import { useVoucherSaveFlow } from "@/modules/vouchers/hooks/use-voucher-save-flow";
import {
  getVoucherSaveFeedback,
  resolveVoucherSaveStatus,
} from "@/modules/vouchers/utils/voucher-save-utils";
import { validateCostCenterBalance } from "@/modules/vouchers/utils/voucher-cost-center-utils";
import {
  approveWithOptionalAutoPost,
  getApproveButtonLabel,
} from "@/modules/vouchers/utils/voucher-auto-post-utils";

interface SettlementVoucherFormProps {
  initialMode?: "create" | "edit";
  initialVoucherId?: string;
  forceViewMode?: boolean;
}

const EMPTY_LINES: SettlementUserLine[] = [];

export function SettlementVoucherForm({
  initialMode = "create",
  initialVoucherId,
  forceViewMode = false,
}: SettlementVoucherFormProps) {
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
  const [description, setDescription] = useState("");
  const [userLines, setUserLines] = useState<SettlementUserLine[]>(EMPTY_LINES);

  const { accounts, isLoadingAccounts } = useVoucherAccounts();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [lineCategories, setLineCategories] = useState<VoucherLineCategory[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const [clearingAccountId, setClearingAccountId] = useState("");
  const [defaultClearingAccountFromSettings, setDefaultClearingAccountFromSettings] =
    useState("");
  const [autoPostEnabled, setAutoPostEnabled] = useState(false);

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

  const isCreate = initialMode === "create" && !voucherId;
  const { canSave, canPost: canPostPermission, canDeleteLine, formReadOnly, canEditPosted } =
    useVoucherFormPermissions(isCreate ? "create" : "edit", status);
  const readOnly = formReadOnly || forceViewMode;
  const voucherNoReadOnly =
    readOnly || (autoNumberEnabled && (Boolean(voucherId) || isCreate));

  const selectedCurrency = currencies.find((currency) => currency.id === currencyId);
  const clearingAccountFallbackLabel = useMemo(() => {
    const account = accounts.find((item) => item.id === clearingAccountId);
    if (!account) return undefined;
    return `${account.code} — ${account.name_ar}`;
  }, [accounts, clearingAccountId]);
  const amountStep = getAmountStep(selectedCurrency?.decimal_places ?? 2);

  const totalUserDebit = useMemo(
    () =>
      userLines.reduce((sum, line) => sum + Number(line.debit_amount || 0), 0),
    [userLines],
  );

  const totalUserCredit = useMemo(
    () =>
      userLines.reduce((sum, line) => sum + Number(line.credit_amount || 0), 0),
    [userLines],
  );

  const validUserLines = useMemo(
    () => userLines.filter(isValidSettlementUserLine),
    [userLines],
  );

  const hasDualSideRows = useMemo(
    () => userLines.some((line) => settlementLineHasBothSides(line)),
    [userLines],
  );

  const costCenterBalanceError = useMemo(
    () =>
      validateCostCenterBalance({
        lines: toCostCenterBalanceLines(userLines),
        costCenters,
        requireCostCenter: true,
        excludeNullCostCenter: true,
      }),
    [userLines, costCenters],
  );

  const canPost =
    !readOnly &&
    Boolean(currencyId) &&
    Boolean(clearingAccountId) &&
    validUserLines.length > 0 &&
    (totalUserDebit > 0 || totalUserCredit > 0) &&
    exchangeRate > 0 &&
    !costCenterBalanceError;

  const buildHeaderPayload = (
    targetStatus: VoucherStatus,
    resolvedVoucherNo: string,
  ): Partial<VoucherHeader> => ({
    voucher_no: resolvedVoucherNo.trim(),
    voucher_type: "settlement",
    settlement_mode: "account",
    voucher_date: voucherDate,
    description: description.trim() || null,
    status: targetStatus,
    customer_id: null,
    vendor_id: null,
    currency_id: currencyId || null,
    cost_center_id: null,
    exchange_rate: exchangeRate > 0 ? exchangeRate : null,
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
    const linesToSave = buildSettlementVoucherLinesForSave(
      clearingAccountId,
      userLines,
    );

    await voucherApi.replaceVoucherLines(
      id,
      linesToSave.map((line) => ({
        account_id: line.account_id,
        side: line.side,
        amount: Number(line.amount),
        line_description: line.line_description?.trim() || null,
        cost_center_id: line.cost_center_id || null,
        ...lineCategoryPayload(line),
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
      if (!clearingAccountId) {
        showError("الحساب الوسيط غير معرّف. عيّنه من إعدادات السندات.");
        return null;
      }
      if (validUserLines.length === 0) {
        showError("أضف سطراً واحداً على الأقل بمبلغ في المدين أو الدائن.");
        return null;
      }
      if (hasDualSideRows) {
        showError("لا يمكن تعبئة المدين والدائن في نفس السطر.");
        return null;
      }

      const accountError = validateSettlementVoucherAccounts({
        currencyId,
        clearingAccountId,
        userLines: validUserLines,
        accounts,
        currencies,
      });
      if (accountError) {
        showError(accountError);
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

    const costCenterError = validateCostCenterBalance({
      lines: toCostCenterBalanceLines(validUserLines),
      costCenters,
      requireCostCenter: true,
      excludeNullCostCenter: true,
    });
      if (costCenterError) {
        showError(costCenterError);
        return null;
      }

      for (const line of validUserLines) {
        const categoryError = validateLineCategory(
          {
            id: line.id,
            voucher_id: line.voucher_id,
            account_id: line.account_id,
            side: Number(line.debit_amount || 0) > 0 ? "debit" : "credit",
            amount:
              Number(line.debit_amount || 0) > 0
                ? Number(line.debit_amount)
                : Number(line.credit_amount),
            line_description: line.line_description,
            cost_center_id: line.cost_center_id,
            line_category_id: line.line_category_id,
            category_quantity: line.category_quantity,
          },
          lineCategories,
        );
        if (categoryError) {
          showError(categoryError);
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
        const { clearingAccountId: loadedClearingAccount, userLines: loadedLines } =
          splitSettlementVoucherLines(
            details.lines,
            defaultClearingAccountFromSettings,
          );
        setClearingAccountId(loadedClearingAccount);
        setUserLines(loadedLines);
      }

      return activeId;
    } catch (error) {
      showFromError(error);
      return null;
    } finally {
      endSave();
    }
  };

  const refreshExchangeRate = async (
    nextCurrencyId: string,
    nextDate: string,
  ) => {
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

  const onCurrencyChange = (nextCurrencyId: string) => {
    setCurrencyId(nextCurrencyId);
    void refreshExchangeRate(nextCurrencyId, voucherDate);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [
          costCentersData,
          currenciesData,
          settings,
          typeDefaults,
          categoriesData,
        ] = await Promise.all([
          voucherApi.listCostCenters(),
          currencyApi.listActiveCurrencies(),
          voucherApi.getVoucherSettings(),
          voucherApi.getVoucherTypeDefaults("settlement"),
          voucherLineCategoryApi.listCategories("settlement", true),
        ]);

        if (cancelled) return;

        setCostCenters(costCentersData);
        setLineCategories(categoriesData);
        setCurrencies(currenciesData);
        setAutoNumberEnabled(settings.auto_number_enabled);

        const defaultClearingAccount = typeDefaults.default_account_id ?? "";
        setDefaultClearingAccountFromSettings(defaultClearingAccount);
        setClearingAccountId(defaultClearingAccount);
        setAutoPostEnabled(typeDefaults.auto_post_enabled ?? false);

        const baseCurrency =
          currenciesData.find((currency) => currency.is_base) ??
          currenciesData[0];
        const defaultCurrencyId =
          typeDefaults.default_currency_id ?? baseCurrency?.id ?? "";
        setCurrencyId(defaultCurrencyId);
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

        const { clearingAccountId: loadedClearing, userLines: loadedUserLines } =
          splitSettlementVoucherLines(details.lines, defaultClearingAccount);

        setVoucherId(details.header.id);
        setVoucherNo(details.header.voucher_no);
        setNextNumberPreview(details.header.voucher_no);
        setVoucherDate(details.header.voucher_date);
        setCurrencyId(details.header.currency_id ?? defaultCurrencyId);
        const loadedCurrency = currenciesData.find(
          (currency) =>
            currency.id === (details.header.currency_id ?? defaultCurrencyId),
        );
        setExchangeRate(
          loadedCurrency?.is_base
            ? 1
            : details.header.exchange_rate ??
                loadedCurrency?.exchange_rate ??
                1,
        );
        setClearingAccountId(loadedClearing);
        setJournalEntryId(details.header.journal_entry_id ?? "");
        setStatus(details.header.status);
        setDescription(details.header.description ?? "");
        setUserLines(loadedUserLines);
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
  }, [initialMode, initialVoucherId]);

  if (isLoading || isLoadingAccounts) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        جاري تحميل سند التصفية...
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
      <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-semibold">سند تصفية</p>
        <p className="mt-0.5 opacity-90">
          تسوية بين حسابات عبر حساب وسيط — أدخل المبلغ في عمود المدين أو الدائن
          لكل سطر، مع توازن مراكز الكلفة
        </p>
      </div>

      <VoucherAdminPostedNotice visible={canEditPosted} />

      <VoucherFormFeedback
        feedback={feedback}
        feedbackRef={feedbackRef}
        onDismiss={clearFeedback}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">
            {initialMode === "create" ? "سند تصفية جديد" : "تعديل سند تصفية"}
          </h1>
          <StatusChip status={status} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">رقم السند</span>
            <input
              value={voucherNo || nextNumberPreview}
              onChange={(event) => setVoucherNo(event.target.value)}
              disabled={voucherNoReadOnly || isSaving}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono disabled:bg-slate-50"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">التاريخ</span>
            <input
              type="date"
              value={voucherDate}
              onChange={(event) => {
                const nextDate = event.target.value;
                setVoucherDate(nextDate);
                if (currencyId && !readOnly) {
                  void refreshExchangeRate(currencyId, nextDate);
                }
              }}
              disabled={readOnly || isSaving}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <VoucherCurrencyFields
            currencies={currencies}
            currencyId={currencyId}
            exchangeRate={exchangeRate}
            readOnly={readOnly}
            isSaving={isSaving}
            isLoadingRate={isLoadingRate}
            onCurrencyChange={onCurrencyChange}
            onExchangeRateChange={setExchangeRate}
            onRefreshRate={() => void refreshExchangeRate(currencyId, voucherDate)}
          />

          <div className="md:col-span-2">
            <AccountSearchField
              label="الحساب الوسيط (مقابل تلقائي)"
              accounts={accounts}
              currencies={currencies}
              value={clearingAccountId}
              fallbackLabel={clearingAccountFallbackLabel}
              onChange={(id) => setClearingAccountId(id)}
              disabled={readOnly || isSaving}
            />
            <p className="mt-1 text-xs text-slate-500">
              الافتراضي من{" "}
              <Link href="/vouchers/settings" className="text-blue-800 underline">
                إعدادات السندات
              </Link>
              — يمكن تغييره لهذا السند. يُولَّد سطر مقابل على هذا الحساب لكل
              سطر (بدون مركز كلفة على الوسيط). مراكز الكلفة في أسطر السند يجب
              أن تتوازن مديناً ودائناً.
            </p>
          </div>
        </div>

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
        lineCategories={lineCategories}
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
        <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p className="font-mono text-blue-900">
            مدين الأسطر: {formatVoucherAmount(totalUserDebit, selectedCurrency)}
          </p>
          <p className="font-mono text-blue-900">
            دائن الأسطر: {formatVoucherAmount(totalUserCredit, selectedCurrency)}
          </p>
          <p className="font-mono text-blue-900">
            مدين الوسيط: {formatVoucherAmount(totalUserCredit, selectedCurrency)}
          </p>
          <p className="font-mono text-blue-900">
            دائن الوسيط: {formatVoucherAmount(totalUserDebit, selectedCurrency)}
          </p>
        </div>
        {costCenterBalanceError && !readOnly && (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {costCenterBalanceError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {canEditPosted && (
            <button
              type="button"
              onClick={() => {
                setIsSaving(true);
                void saveVoucher("posted").finally(() => setIsSaving(false));
              }}
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
                        postVoucher: voucherApi.postVoucher,
                        showError,
                        postBlockedMessage:
                          costCenterBalanceError ??
                          "تعذر الترحيل. تحقق من الحساب الوسيط والأسطر ومراكز الكلفة والعملة.",
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
          {canPostPermission && !canEditPosted && !autoPostEnabled && (
            <button
              type="button"
              onClick={() => {
                setIsSaving(true);
                void (async () => {
                  if (!canPost) {
                    showError(
                      costCenterBalanceError ??
                        "تعذر الترحيل. تحقق من الحساب الوسيط والأسطر ومراكز الكلفة والعملة.",
                    );
                    return;
                  }
                  const activeId = await saveVoucher("approved");
                  if (!activeId) return;
                  const response = await voucherApi.postVoucher(activeId);
                  setStatus("posted");
                  setJournalEntryId(response.journal_entry_id);
                  showSuccess(`تم الترحيل. القيد: ${response.journal_entry_no}`);
                })().finally(() => setIsSaving(false));
              }}
              disabled={!canPost || isSaving}
              className="rounded-md bg-blue-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              ترحيل
            </button>
          )}
          <Link href="/vouchers" className="rounded-md border border-slate-300 px-4 py-2 text-sm">
            قائمة السندات
          </Link>
          {journalEntryId && (
            <DocumentActionLinks
              href={`/journals/${journalEntryId}`}
              openLabel="فتح القيد"
            />
          )}
        </div>
        <VoucherFormFeedback feedback={feedback} onDismiss={clearFeedback} className="mt-3" />
      </section>
    </div>
  );
}
