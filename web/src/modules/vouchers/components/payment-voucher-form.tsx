"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InvoiceSettlementLinkBanner } from "@/modules/invoices/components/invoice-settlement-link-banner";
import { invoiceSettlementApi } from "@/modules/invoices/services/invoice-settlement-api";
import { buildVoucherAllocationsFromOpenItems } from "@/modules/invoices/utils/build-voucher-allocations-from-invoice";
import { DocumentActionLinks } from "@/components/open-in-new-tab-link";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { VendorSearchField } from "@/modules/vouchers/components/vendor-search-field";
import {
  validateLineCategory,
  lineCategoryPayload,
} from "@/modules/vouchers/components/voucher-line-category-fields";
import {
  buildPaymentVoucherLinesForSave,
  PaymentVoucherLinesTable,
  splitPaymentVoucherLines,
} from "@/modules/vouchers/components/payment-voucher-lines-table";
import { voucherLineCategoryApi } from "@/modules/vouchers/services/voucher-line-category-api";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VoucherAdminPostedNotice } from "@/modules/vouchers/components/voucher-admin-posted-notice";
import { VoucherViewModeBar } from "@/modules/vouchers/components/voucher-view-mode-bar";
import { CloseMovementSections } from "@/modules/vouchers/components/close-movement-sections";
import { VoucherCurrencyFields } from "@/modules/vouchers/components/voucher-currency-fields";
import { VoucherAttachmentsPanel } from "@/modules/vouchers/components/voucher-attachments-panel";
import { useVoucherAccounts } from "@/modules/vouchers/hooks/use-voucher-accounts";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type {
  Account,
  CostCenter,
  OpenMovement,
  SettlementMode,
  Vendor,
  VoucherAllocation,
  VoucherHeader,
  VoucherLine,
  VoucherLineCategory,
  VoucherNettingLine,
  VoucherStatus,
} from "@/modules/vouchers/types";
import type { Currency } from "@/modules/currencies/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import {
  formatVoucherAmount,
  getAmountStep,
  resolveVoucherExchangeRate,
  validatePaymentVoucherAccounts,
  validateVoucherExchangeRate,
} from "@/modules/vouchers/utils/voucher-currency-utils";
import { useVoucherFeedback } from "@/modules/vouchers/hooks/use-voucher-feedback";
import { useVoucherFormPermissions } from "@/modules/vouchers/hooks/use-voucher-form-permissions";
import { useVoucherSaveFlow } from "@/modules/vouchers/hooks/use-voucher-save-flow";
import {
  getVoucherSaveFeedback,
  resolveVoucherSaveStatus,
} from "@/modules/vouchers/utils/voucher-save-utils";
import { validateActiveVendor } from "@/modules/vouchers/utils/voucher-party-validation";
import {
  approveWithOptionalAutoPost,
  getApproveButtonLabel,
} from "@/modules/vouchers/utils/voucher-auto-post-utils";
import {
  closeMovementLinesMatchAllocations,
  sumVoucherAllocationTotal,
  syncCloseMovementLinesWithAllocations,
} from "@/modules/vouchers/utils/sync-close-movement-lines";
import {
  buildOpenAmountMapFromMovements,
  parseOptionalPaymentAmount,
  validateVoucherAllocations,
} from "@/modules/vouchers/utils/validate-voucher-allocations";
import { validateVoucherNettingLines } from "@/modules/vouchers/utils/validate-voucher-netting";

interface PaymentVoucherFormProps {
  initialMode?: "create" | "edit";
  initialVoucherId?: string;
  forceViewMode?: boolean;
  /** عند "invoice" يُستخدم نموذج إغلاق الحركات المنفصل */
  lockedSettlementMode?: SettlementMode;
}

const EMPTY_LINES: VoucherLine[] = [];
const EMPTY_ALLOCATIONS: VoucherAllocation[] = [];
const EMPTY_NETTING_LINES: VoucherNettingLine[] = [];

function PaymentVoucherFormInner({
  initialMode = "create",
  initialVoucherId,
  forceViewMode = false,
  lockedSettlementMode,
}: PaymentVoucherFormProps) {
  const [voucherId, setVoucherId] = useState(initialVoucherId ?? "");
  const [voucherNo, setVoucherNo] = useState("");
  const [nextNumberPreview, setNextNumberPreview] = useState("");
  const [autoNumberEnabled, setAutoNumberEnabled] = useState(true);
  const isCloseMovementsForm = lockedSettlementMode === "invoice";
  const searchParams = useSearchParams();
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [journalEntryId, setJournalEntryId] = useState("");
  const [status, setStatus] = useState<VoucherStatus>("draft");
  const [description, setDescription] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [debitLines, setDebitLines] = useState<VoucherLine[]>(EMPTY_LINES);
  const [allocations, setAllocations] =
    useState<VoucherAllocation[]>(EMPTY_ALLOCATIONS);
  const [nettingLines, setNettingLines] =
    useState<VoucherNettingLine[]>(EMPTY_NETTING_LINES);

  const { accounts, isLoadingAccounts } = useVoucherAccounts();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [lineCategories, setLineCategories] = useState<VoucherLineCategory[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [closeOpenMovements, setCloseOpenMovements] = useState<OpenMovement[]>([]);
  const [allocationOpenLimits, setAllocationOpenLimits] = useState<
    Record<string, number>
  >({});

  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [defaultPaymentAccountFromSettings, setDefaultPaymentAccountFromSettings] =
    useState("");
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
  const isInvoiceMode = isCloseMovementsForm;

  const selectedCurrency = currencies.find((currency) => currency.id === currencyId);
  const paymentAccountFallbackLabel = useMemo(() => {
    const account = accounts.find((item) => item.id === paymentAccountId);
    if (!account) return undefined;
    return `${account.code} — ${account.name_ar}`;
  }, [accounts, paymentAccountId]);
  const amountStep = getAmountStep(selectedCurrency?.decimal_places ?? 2);

  const totalDebit = useMemo(
    () =>
      debitLines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [debitLines],
  );
  const allocationTotal = useMemo(
    () => sumVoucherAllocationTotal(allocations),
    [allocations],
  );
  const openAmountByLineId = useMemo(
    () => ({
      ...buildOpenAmountMapFromMovements(closeOpenMovements),
      ...allocationOpenLimits,
    }),
    [closeOpenMovements, allocationOpenLimits],
  );

  const validDebitLines = useMemo(
    () =>
      debitLines.filter(
        (line) => line.account_id && Number(line.amount || 0) > 0,
      ),
    [debitLines],
  );

  const canPost =
    !readOnly &&
    Boolean(currencyId) &&
    Boolean(paymentAccountId) &&
    validDebitLines.length > 0 &&
    totalDebit > 0 &&
    exchangeRate > 0 &&
    (!isInvoiceMode || (allocations.length > 0 && Boolean(vendorId)));

  const buildHeaderPayload = (
    targetStatus: VoucherStatus,
    resolvedVoucherNo: string,
  ): Partial<VoucherHeader> => ({
    voucher_no: resolvedVoucherNo.trim(),
    voucher_type: "payment",
    settlement_mode: isCloseMovementsForm ? "invoice" : "account",
    voucher_date: voucherDate,
    description: description.trim() || null,
    status: targetStatus,
    customer_id: null,
    vendor_id: isInvoiceMode ? vendorId || null : null,
    currency_id: currencyId || null,
    cost_center_id: null,
    exchange_rate: exchangeRate > 0 ? exchangeRate : null,
    branch_id: isInvoiceMode ? branchId || null : null,
  });

  const resolveVoucherNo = async (): Promise<string | null> => {
    if (voucherNo.trim()) return voucherNo.trim();
    if (autoNumberEnabled) {
      const reserved = await voucherApi.reserveVoucherNo("payment");
      setVoucherNo(reserved);
      setNextNumberPreview(reserved);
      return reserved;
    }
    showError("رقم السند مطلوب.");
    return null;
  };

  const syncVoucherLines = async (id: string) => {
    const linesToSave = buildPaymentVoucherLinesForSave(
      paymentAccountId,
      debitLines,
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

  const syncVoucherNettingLines = async (id: string) => {
    await voucherApi.replaceVoucherNettingLines(id, nettingLines);
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
      if (!paymentAccountId) {
        showError("حساب الدفع غير معرّف. عيّنه من إعدادات السندات.");
        return null;
      }
      if (validDebitLines.length === 0) {
        showError("أضف سطراً مديناً واحداً على الأقل.");
        return null;
      }

      const accountError = validatePaymentVoucherAccounts({
        currencyId,
        paymentAccountId,
        debitLines: validDebitLines,
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

      for (const line of validDebitLines) {
        const categoryError = validateLineCategory(line, lineCategories);
        if (categoryError) {
          showError(categoryError);
          return null;
        }
      }
      if (isInvoiceMode && !vendorId) {
        showError("المورد مطلوب في وضع إغلاق الحركات.");
        return null;
      }
      if (isInvoiceMode) {
        const vendorError = validateActiveVendor(vendorId, vendors);
        if (vendorError) {
          showError(vendorError);
          return null;
        }
        if (!closeMovementLinesMatchAllocations(validDebitLines, allocations)) {
          showError(
            "إجمالي أسطر المدين يجب أن يساوي مجموع التخصيصات في إغلاق الحركات.",
          );
          return null;
        }
        const allocationError = validateVoucherAllocations(
          allocations,
          openAmountByLineId,
        );
        if (allocationError) {
          showError(allocationError);
          return null;
        }
        const nettingError = validateVoucherNettingLines(
          nettingLines,
          closeOpenMovements,
        );
        if (nettingError) {
          showError(nettingError);
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
        await syncVoucherNettingLines(activeId);
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
        const { paymentAccountId: loadedPaymentAccount, debitLines: loadedDebits } =
          splitPaymentVoucherLines(
            details.lines,
            defaultPaymentAccountFromSettings,
          );
        setPaymentAccountId(loadedPaymentAccount);
        setDebitLines(loadedDebits);
      }

      return activeId;
    } catch (error) {
      showFromError(error);
      return null;
    } finally {
      endSave();
    }
  };

  const onVendorChange = (id: string, vendor: Vendor | null) => {
    setVendorId(id);
    if (!vendor?.payable_account_id) return;

    const payableAccount = accounts.find(
      (item) => item.id === vendor.payable_account_id,
    );

    const emptyLine = debitLines.find((line) => !line.account_id);
    if (emptyLine) {
      setDebitLines(
        debitLines.map((line) =>
          line.id === emptyLine.id
            ? {
                ...line,
                account_id: vendor.payable_account_id,
                account_code: payableAccount?.code ?? "",
                account_name: payableAccount?.name_ar ?? "",
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
    if (initialMode !== "create" || !isCloseMovementsForm) return;
    const fromQuery = searchParams.get("vendorId");
    if (fromQuery) setVendorId(fromQuery);
  }, [initialMode, isCloseMovementsForm, searchParams]);

  useEffect(() => {
    if (!isInvoiceMode || readOnly || isLoading || isLoadingAccounts) return;
    if (allocations.length === 0) return;

    const vendor = vendors.find((item) => item.id === vendorId);

    setDebitLines((previous) => {
      const nextLines = syncCloseMovementLinesWithAllocations({
        lines: previous,
        allocations,
        side: "debit",
        counterAccountId: vendor?.payable_account_id ?? "",
        accounts,
      });

      if (closeMovementLinesMatchAllocations(previous, allocations)) {
        const previousPrimary = previous[0];
        const nextPrimary = nextLines[0];
        if (
          previous.length === nextLines.length &&
          previousPrimary?.account_id === nextPrimary?.account_id &&
          previousPrimary?.amount === nextPrimary?.amount
        ) {
          return previous;
        }
      }
      return nextLines;
    });
  }, [
    isInvoiceMode,
    readOnly,
    isLoading,
    isLoadingAccounts,
    allocations,
    vendorId,
    vendors,
    accounts,
  ]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [
          vendorsData,
          costCentersData,
          currenciesData,
          settings,
          typeDefaults,
          categoriesData,
        ] = await Promise.all([
          voucherApi.listVendors(),
          voucherApi.listCostCenters(),
          currencyApi.listActiveCurrencies(),
          voucherApi.getVoucherSettings(),
          voucherApi.getVoucherTypeDefaults("payment"),
          voucherLineCategoryApi.listCategories("payment", true),
        ]);

        let openMovementsData: OpenMovement[] = [];
        if (isCloseMovementsForm) {
          openMovementsData = [];
        }

        if (cancelled) return;

        setVendors(vendorsData);
        setCostCenters(costCentersData);
        setLineCategories(categoriesData);
        setCurrencies(currenciesData);
        setCloseOpenMovements(openMovementsData);
        setAutoNumberEnabled(settings.auto_number_enabled);

        const defaultPaymentAccount = typeDefaults.default_account_id ?? "";
        setDefaultPaymentAccountFromSettings(defaultPaymentAccount);
        setPaymentAccountId(defaultPaymentAccount);
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
          if (isCloseMovementsForm) {
            const invoiceId = searchParams.get("invoiceId");
            const autoAllocate = searchParams.get("autoAllocate") === "1";
            if (invoiceId && autoAllocate) {
              const invoiceItems =
                await invoiceSettlementApi.listOpenItemsForInvoice(invoiceId);
              if (!cancelled && invoiceItems.length > 0) {
                const paymentAmount = parseOptionalPaymentAmount(
                  searchParams.get("payAmount"),
                );
                setAllocationOpenLimits(
                  Object.fromEntries(
                    invoiceItems.map((item) => [
                      item.journal_line_id,
                      item.open_amount,
                    ]),
                  ),
                );
                setAllocations(
                  buildVoucherAllocationsFromOpenItems(invoiceItems, {
                    paymentAmount,
                  }),
                );
              }
            }
          }

          if (settings.auto_number_enabled) {
            const preview = await voucherApi.peekVoucherNo("payment");
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

        const { paymentAccountId: loadedPaymentAccount, debitLines: loadedDebits } =
          splitPaymentVoucherLines(details.lines, defaultPaymentAccount);

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
        setPaymentAccountId(loadedPaymentAccount);
        setJournalEntryId(details.header.journal_entry_id ?? "");
        setStatus(details.header.status);
        setDescription(details.header.description ?? "");
        setVendorId(details.header.vendor_id ?? "");
        setBranchId(details.header.branch_id ?? "");
        setDebitLines(loadedDebits);
        setAllocations(details.allocations);
        setNettingLines(details.netting_lines ?? []);
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
          ? "جاري تحميل إغلاق حركات الدفع..."
          : "جاري تحميل سند الدفع..."}
      </div>
    );
  }

  const formTitle =
    initialMode === "create"
      ? isCloseMovementsForm
        ? "إغلاق حركات دفع جديد"
        : "سند دفع جديد"
      : isCloseMovementsForm
        ? "تعديل إغلاق حركات دفع"
        : "تعديل سند دفع";

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
            : "border-rose-300 bg-rose-50 text-rose-900"
        }`}
      >
        <p className="font-semibold">
          {isCloseMovementsForm ? "إغلاق حركات — دفع" : "سند دفع"}
        </p>
        <p className="mt-0.5 opacity-90">
          {isCloseMovementsForm
            ? "سداد مرتبط بتخصيص حركات مفتوحة للمورد"
            : "صرف مبلغ — دائن حساب الدفع تلقائياً، مدين حسابات مقابلة"}
        </p>
      </div>

      {isCloseMovementsForm && initialMode === "create" && (
        <InvoiceSettlementLinkBanner />
      )}

      <VoucherAdminPostedNotice visible={canEditPosted} />

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
              label="حساب الدفع (دائن — تلقائي)"
              accounts={accounts}
              currencies={currencies}
              value={paymentAccountId}
              fallbackLabel={paymentAccountFallbackLabel}
              onChange={(id) => setPaymentAccountId(id)}
              disabled={readOnly || isSaving}
            />
            <p className="mt-1 text-xs text-slate-500">
              الافتراضي من{" "}
              <Link href="/vouchers/settings" className="text-blue-800 underline">
                إعدادات السندات
              </Link>
              — يمكن تغييره لهذا السند. يُولَّد سطر دائن مقابل كل سطر مدين
              بنفس المبلغ ومركز الكلفة.
            </p>
          </div>

          {isInvoiceMode && (
            <div className="md:col-span-2 lg:col-span-3">
              <VendorSearchField
                vendors={vendors}
                value={vendorId}
                onChange={onVendorChange}
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

      <PaymentVoucherLinesTable
        lines={debitLines}
        accounts={accounts}
        costCenters={costCenters}
        lineCategories={lineCategories}
        currencies={currencies}
        voucherCurrencyId={currencyId}
        amountStep={amountStep}
        onChange={setDebitLines}
        readOnly={readOnly || isSaving}
        allowLineDelete={canDeleteLine}
      />

      <CloseMovementSections
        partyType="vendor"
        partyId={vendorId}
        defaultOpenSide="credit"
        branchId={branchId}
        onBranchIdChange={setBranchId}
        costCenters={costCenters}
        accounts={accounts}
        voucherType="payment"
        counterAccountId={paymentAccountId}
        voucherLines={debitLines}
        allocations={allocations}
        onAllocationsChange={setAllocations}
        nettingLines={nettingLines}
        onNettingLinesChange={setNettingLines}
        openAmountByLineId={openAmountByLineId}
        onOpenMovementsChange={setCloseOpenMovements}
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
          <p className="font-mono text-rose-900">
            إجمالي المدين: {formatVoucherAmount(totalDebit, selectedCurrency)}
          </p>
          <p className="font-mono text-rose-900">
            دائن حساب الدفع: {formatVoucherAmount(totalDebit, selectedCurrency)}
          </p>
          {isInvoiceMode && (
            <p className="font-mono text-blue-900 sm:col-span-2">
              مجموع التخصيصات:{" "}
              {formatVoucherAmount(allocationTotal, selectedCurrency)}
              {!closeMovementLinesMatchAllocations(debitLines, allocations) && (
                <span className="ms-2 text-rose-700">
                  — لا يطابق إجمالي المدين
                </span>
              )}
            </p>
          )}
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
                          "تعذر الترحيل. تحقق من حساب الدفع والأسطر والمورد والتخصيصات.",
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
                      "تعذر الترحيل. تحقق من حساب الدفع والأسطر والمورد والتخصيصات.",
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
              className="rounded-md bg-rose-700 px-4 py-2 text-sm text-white disabled:opacity-50"
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
      </section>
    </div>
  );
}

function PaymentVoucherFormFallback() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
      جاري تحميل سند الدفع...
    </div>
  );
}

export function PaymentVoucherForm(props: PaymentVoucherFormProps) {
  return (
    <Suspense fallback={<PaymentVoucherFormFallback />}>
      <PaymentVoucherFormInner {...props} />
    </Suspense>
  );
}
