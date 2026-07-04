"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DocumentActionLinks } from "@/components/open-in-new-tab-link";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { CustomerSearchField } from "@/modules/vouchers/components/customer-search-field";
import {
  validateLineCategory,
  lineCategoryPayload,
} from "@/modules/vouchers/components/voucher-line-category-fields";
import {
  buildReceiptVoucherLinesForSave,
  ReceiptVoucherLinesTable,
  splitReceiptVoucherLines,
} from "@/modules/vouchers/components/receipt-voucher-lines-table";
import { voucherLineCategoryApi } from "@/modules/vouchers/services/voucher-line-category-api";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VoucherFormFeedback } from "@/modules/vouchers/components/voucher-form-feedback";
import { VoucherAdminPostedNotice } from "@/modules/vouchers/components/voucher-admin-posted-notice";
import { VoucherViewModeBar } from "@/modules/vouchers/components/voucher-view-mode-bar";
import { VoucherAllocations } from "@/modules/vouchers/components/voucher-allocations";
import { VoucherCurrencyFields } from "@/modules/vouchers/components/voucher-currency-fields";
import { VoucherAttachmentsPanel } from "@/modules/vouchers/components/voucher-attachments-panel";
import { useVoucherAccounts } from "@/modules/vouchers/hooks/use-voucher-accounts";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type {
  Account,
  CostCenter,
  Customer,
  SettlementMode,
  VoucherAllocation,
  VoucherHeader,
  VoucherLine,
  VoucherLineCategory,
  VoucherStatus,
} from "@/modules/vouchers/types";
import type { Currency } from "@/modules/currencies/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import {
  formatVoucherAmount,
  getAmountStep,
  resolveVoucherExchangeRate,
  validateReceiptVoucherAccounts,
  validateVoucherExchangeRate,
} from "@/modules/vouchers/utils/voucher-currency-utils";
import { useVoucherFormPermissions } from "@/modules/vouchers/hooks/use-voucher-form-permissions";
import { useVoucherFeedback } from "@/modules/vouchers/hooks/use-voucher-feedback";
import { useVoucherSaveFlow } from "@/modules/vouchers/hooks/use-voucher-save-flow";
import {
  getVoucherSaveFeedback,
  resolveVoucherSaveStatus,
} from "@/modules/vouchers/utils/voucher-save-utils";
import { validateActiveCustomer } from "@/modules/vouchers/utils/voucher-party-validation";
import {
  approveWithOptionalAutoPost,
  getApproveButtonLabel,
} from "@/modules/vouchers/utils/voucher-auto-post-utils";

interface ReceiptVoucherFormProps {
  initialMode?: "create" | "edit";
  initialVoucherId?: string;
  forceViewMode?: boolean;
  /** عند "invoice" يُستخدم نموذج إغلاق الحركات المنفصل */
  lockedSettlementMode?: SettlementMode;
}

const EMPTY_LINES: VoucherLine[] = [];
const EMPTY_ALLOCATIONS: VoucherAllocation[] = [];

export function ReceiptVoucherForm({
  initialMode = "create",
  initialVoucherId,
  forceViewMode = false,
  lockedSettlementMode,
}: ReceiptVoucherFormProps) {
  const [voucherId, setVoucherId] = useState(initialVoucherId ?? "");
  const [voucherNo, setVoucherNo] = useState("");
  const [nextNumberPreview, setNextNumberPreview] = useState("");
  const [autoNumberEnabled, setAutoNumberEnabled] = useState(true);
  const isCloseMovementsForm = lockedSettlementMode === "invoice";
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [journalEntryId, setJournalEntryId] = useState("");
  const [status, setStatus] = useState<VoucherStatus>("draft");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [creditLines, setCreditLines] = useState<VoucherLine[]>(EMPTY_LINES);
  const [allocations, setAllocations] =
    useState<VoucherAllocation[]>(EMPTY_ALLOCATIONS);

  const { accounts, isLoadingAccounts } = useVoucherAccounts();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [lineCategories, setLineCategories] = useState<VoucherLineCategory[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [openMovements, setOpenMovements] = useState<
    Awaited<ReturnType<typeof voucherApi.listOpenMovements>>
  >([]);

  const [receiptAccountId, setReceiptAccountId] = useState("");
  const [defaultReceiptAccountFromSettings, setDefaultReceiptAccountFromSettings] =
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
  const isInvoiceMode = isCloseMovementsForm;

  const selectedCurrency = currencies.find((currency) => currency.id === currencyId);
  const receiptAccountFallbackLabel = useMemo(() => {
    const account = accounts.find((item) => item.id === receiptAccountId);
    if (!account) return undefined;
    return `${account.code} — ${account.name_ar}`;
  }, [accounts, receiptAccountId]);
  const amountStep = getAmountStep(selectedCurrency?.decimal_places ?? 2);

  const totalCredit = useMemo(
    () =>
      creditLines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [creditLines],
  );

  const validCreditLines = useMemo(
    () =>
      creditLines.filter(
        (line) => line.account_id && Number(line.amount || 0) > 0,
      ),
    [creditLines],
  );

  const canPost =
    !readOnly &&
    Boolean(currencyId) &&
    Boolean(receiptAccountId) &&
    validCreditLines.length > 0 &&
    totalCredit > 0 &&
    exchangeRate > 0 &&
    (!isInvoiceMode || (allocations.length > 0 && Boolean(customerId)));

  const buildHeaderPayload = (
    targetStatus: VoucherStatus,
    resolvedVoucherNo: string,
  ): Partial<VoucherHeader> => ({
    voucher_no: resolvedVoucherNo.trim(),
    voucher_type: "receipt",
    settlement_mode: isCloseMovementsForm ? "invoice" : "account",
    voucher_date: voucherDate,
    description: description.trim() || null,
    status: targetStatus,
    customer_id: isInvoiceMode ? customerId || null : null,
    vendor_id: null,
    currency_id: currencyId || null,
    cost_center_id: null,
    exchange_rate: exchangeRate > 0 ? exchangeRate : null,
  });

  const resolveVoucherNo = async (): Promise<string | null> => {
    if (voucherNo.trim()) return voucherNo.trim();
    if (autoNumberEnabled) {
      const reserved = await voucherApi.reserveVoucherNo("receipt");
      setVoucherNo(reserved);
      setNextNumberPreview(reserved);
      return reserved;
    }
    showError("رقم السند مطلوب.");
    return null;
  };

  const syncVoucherLines = async (id: string) => {
    const linesToSave = buildReceiptVoucherLinesForSave(
      receiptAccountId,
      creditLines,
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

  const syncVoucherAllocations = async (id: string) => {
    await voucherApi.replaceVoucherAllocations(id, allocations);
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
      if (!receiptAccountId) {
        showError("حساب القبض غير معرّف. عيّنه من إعدادات السندات.");
        return null;
      }
      if (validCreditLines.length === 0) {
        showError("أضف سطراً دائنًا واحداً على الأقل.");
        return null;
      }

      const accountError = validateReceiptVoucherAccounts({
        currencyId,
        receiptAccountId,
        creditLines: validCreditLines,
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

      for (const line of validCreditLines) {
        const categoryError = validateLineCategory(line, lineCategories);
        if (categoryError) {
          showError(categoryError);
          return null;
        }
      }
      if (isInvoiceMode && !customerId) {
        showError("العميل مطلوب في وضع إغلاق الحركات.");
        return null;
      }
      if (isInvoiceMode) {
        const customerError = validateActiveCustomer(customerId, customers);
        if (customerError) {
          showError(customerError);
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
      if (isInvoiceMode) {
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
        const { receiptAccountId: loadedReceiptAccount, creditLines: loadedCredits } =
          splitReceiptVoucherLines(
            details.lines,
            defaultReceiptAccountFromSettings,
          );
        setReceiptAccountId(loadedReceiptAccount);
        setCreditLines(loadedCredits);
      }

      return activeId;
    } catch (error) {
      showFromError(error);
      return null;
    } finally {
      endSave();
    }
  };

  const onCustomerChange = (id: string, customer: Customer | null) => {
    setCustomerId(id);
    if (!customer?.receivable_account_id) return;

    const receivableAccount = accounts.find(
      (item) => item.id === customer.receivable_account_id,
    );

    const emptyLine = creditLines.find((line) => !line.account_id);
    if (emptyLine) {
      setCreditLines(
        creditLines.map((line) =>
          line.id === emptyLine.id
            ? {
                ...line,
                account_id: customer.receivable_account_id,
                account_code: receivableAccount?.code ?? "",
                account_name: receivableAccount?.name_ar ?? "",
              }
            : line,
        ),
      );
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
        const baseRequests = [
          voucherApi.listCustomers(),
          voucherApi.listCostCenters(),
          currencyApi.listActiveCurrencies(),
          voucherApi.getVoucherSettings(),
          voucherApi.getVoucherTypeDefaults("receipt"),
          voucherLineCategoryApi.listCategories("receipt", true),
        ] as const;

        const [
          customersData,
          costCentersData,
          currenciesData,
          settings,
          typeDefaults,
          categoriesData,
        ] = await Promise.all(baseRequests);

        let openMovementsData: Awaited<
          ReturnType<typeof voucherApi.listOpenMovements>
        > = [];
        if (isCloseMovementsForm) {
          openMovementsData = await voucherApi.listOpenMovements();
        }

        if (cancelled) return;

        setCustomers(customersData);
        setCostCenters(costCentersData);
        setLineCategories(categoriesData);
        setCurrencies(currenciesData);
        setOpenMovements(openMovementsData);
        setAutoNumberEnabled(settings.auto_number_enabled);

        const defaultReceiptAccount = typeDefaults.default_account_id ?? "";
        setDefaultReceiptAccountFromSettings(defaultReceiptAccount);
        setReceiptAccountId(defaultReceiptAccount);
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
            const preview = await voucherApi.peekVoucherNo("receipt");
            if (!cancelled) setNextNumberPreview(preview);
          }
          setIsLoading(false);
          return;
        }

        const details = await voucherApi.getVoucherById(initialVoucherId);
        if (cancelled) return;

        const loadedMode = details.header.settlement_mode;
        const expectsInvoice = isCloseMovementsForm;
        if ((expectsInvoice && loadedMode !== "invoice") || (!expectsInvoice && loadedMode === "invoice")) {
          showError(
            expectsInvoice
              ? "هذا السند ليس من نوع إغلاق الحركات."
              : "سند إغلاق الحركات يُفتح من نموذج إغلاق الحركات.",
          );
          setIsLoading(false);
          return;
        }

        const { receiptAccountId: loadedReceiptAccount, creditLines: loadedCredits } =
          splitReceiptVoucherLines(details.lines, defaultReceiptAccount);

        setVoucherId(details.header.id);
        setVoucherNo(details.header.voucher_no);
        setNextNumberPreview(details.header.voucher_no);
        setVoucherDate(details.header.voucher_date);
        setCurrencyId(
          details.header.currency_id ?? defaultCurrencyId,
        );
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
        setReceiptAccountId(loadedReceiptAccount);
        setJournalEntryId(details.header.journal_entry_id ?? "");
        setStatus(details.header.status);
        setDescription(details.header.description ?? "");
        setCustomerId(details.header.customer_id ?? "");
        setCreditLines(loadedCredits);
        setAllocations(details.allocations);
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
  }, [initialMode, initialVoucherId, isCloseMovementsForm]);

  if (isLoading || isLoadingAccounts) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        {isCloseMovementsForm
          ? "جاري تحميل إغلاق حركات القبض..."
          : "جاري تحميل سند القبض..."}
      </div>
    );
  }

  const formTitle =
    initialMode === "create"
      ? isCloseMovementsForm
        ? "إغلاق حركات قبض جديد"
        : "سند قبض جديد"
      : isCloseMovementsForm
        ? "تعديل إغلاق حركات قبض"
        : "تعديل سند قبض";

  return (
    <div className="space-y-4">
      <VoucherViewModeBar
        forceViewMode={forceViewMode}
        voucherId={voucherId || initialVoucherId || ""}
        status={status}
      />
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          isCloseMovementsForm
            ? "border-violet-300 bg-violet-50 text-violet-900"
            : "border-emerald-300 bg-emerald-50 text-emerald-900"
        }`}
      >
        <p className="font-semibold">
          {isCloseMovementsForm ? "إغلاق حركات — قبض" : "سند قبض"}
        </p>
        <p className="mt-0.5 opacity-90">
          {isCloseMovementsForm
            ? "تحصيل مرتبط بتخصيص حركات مفتوحة للعميل"
            : "استلام مبلغ — مدين حساب القبض تلقائياً، دائن حسابات مقابلة"}
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
          <h1 className="text-xl font-bold text-slate-900">{formTitle}</h1>
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
              label="حساب القبض (مدين — تلقائي)"
              accounts={accounts}
              currencies={currencies}
              value={receiptAccountId}
              fallbackLabel={receiptAccountFallbackLabel}
              onChange={(id) => setReceiptAccountId(id)}
              disabled={readOnly || isSaving}
            />
            <p className="mt-1 text-xs text-slate-500">
              الافتراضي من{" "}
              <Link href="/vouchers/settings" className="text-blue-800 underline">
                إعدادات السندات
              </Link>
              — يمكن تغييره لهذا السند. يُولَّد سطر مدين مقابل كل سطر دائن
              بنفس المبلغ ومركز الكلفة.
            </p>
          </div>

          {isInvoiceMode && (
            <div className="md:col-span-2 lg:col-span-3">
              <CustomerSearchField
                customers={customers}
                value={customerId}
                onChange={onCustomerChange}
                disabled={readOnly || isSaving}
                required
              />
            </div>
          )}
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

      <ReceiptVoucherLinesTable
        lines={creditLines}
        accounts={accounts}
        costCenters={costCenters}
        lineCategories={lineCategories}
        currencies={currencies}
        voucherCurrencyId={currencyId}
        amountStep={amountStep}
        onChange={setCreditLines}
        readOnly={readOnly || isSaving}
        allowLineDelete={canDeleteLine}
      />

      <VoucherAllocations
        allocations={allocations}
        openMovements={openMovements}
        onChange={setAllocations}
        readOnly={readOnly || isSaving}
        visible={isInvoiceMode}
      />

      <VoucherAttachmentsPanel
        voucherId={voucherId}
        canManage={canSave && !readOnly}
        readOnly={readOnly || isSaving}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="font-mono text-emerald-900">
            إجمالي الدائن: {formatVoucherAmount(totalCredit, selectedCurrency)}
          </p>
          <p className="font-mono text-emerald-900">
            مدين حساب القبض: {formatVoucherAmount(totalCredit, selectedCurrency)}
          </p>
        </div>
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
                          "تعذر الترحيل. تحقق من حساب القبض والأسطر والعميل والتخصيصات.",
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
                      "تعذر الترحيل. تحقق من حساب القبض والأسطر والعميل والتخصيصات.",
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
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
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
