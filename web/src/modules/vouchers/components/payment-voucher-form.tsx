"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { VoucherAllocations } from "@/modules/vouchers/components/voucher-allocations";
import {
  ApiError,
  voucherApi,
} from "@/modules/vouchers/services/voucher-api";
import type {
  Account,
  CostCenter,
  SettlementMode,
  Vendor,
  VoucherAllocation,
  VoucherHeader,
  VoucherLine,
  VoucherLineCategory,
  VoucherStatus,
} from "@/modules/vouchers/types";
import { getSettlementModeLabel } from "@/modules/vouchers/utils/voucher-type-config";
import type { Currency } from "@/modules/currencies/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import {
  accountMatchesVoucherCurrency,
  formatVoucherAmount,
  getAmountStep,
  getCurrencyById,
  validatePaymentVoucherAccounts,
} from "@/modules/vouchers/utils/voucher-currency-utils";

interface PaymentVoucherFormProps {
  initialMode?: "create" | "edit";
  initialVoucherId?: string;
}

const EMPTY_LINES: VoucherLine[] = [];
const EMPTY_ALLOCATIONS: VoucherAllocation[] = [];

export function PaymentVoucherForm({
  initialMode = "create",
  initialVoucherId,
}: PaymentVoucherFormProps) {
  const [voucherId, setVoucherId] = useState(initialVoucherId ?? "");
  const [voucherNo, setVoucherNo] = useState("");
  const [nextNumberPreview, setNextNumberPreview] = useState("");
  const [autoNumberEnabled, setAutoNumberEnabled] = useState(true);
  const [settlementMode, setSettlementMode] = useState<SettlementMode>("account");
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [journalEntryId, setJournalEntryId] = useState("");
  const [status, setStatus] = useState<VoucherStatus>("draft");
  const [description, setDescription] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [debitLines, setDebitLines] = useState<VoucherLine[]>(EMPTY_LINES);
  const [allocations, setAllocations] =
    useState<VoucherAllocation[]>(EMPTY_ALLOCATIONS);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [lineCategories, setLineCategories] = useState<VoucherLineCategory[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [openMovements, setOpenMovements] = useState<
    Awaited<ReturnType<typeof voucherApi.listOpenMovements>>
  >([]);

  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [defaultPaymentAccountFromSettings, setDefaultPaymentAccountFromSettings] =
    useState("");

  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(initialMode === "edit");
  const [isSaving, setIsSaving] = useState(false);

  const readOnly = status === "posted" || status === "cancelled";
  const isCreate = initialMode === "create" && !voucherId;
  const voucherNoReadOnly =
    readOnly || (autoNumberEnabled && (Boolean(voucherId) || isCreate));
  const isInvoiceMode = settlementMode === "invoice";

  const selectedCurrency = currencies.find((currency) => currency.id === currencyId);
  const paymentAccount = accounts.find((account) => account.id === paymentAccountId);
  const isBaseCurrency = selectedCurrency?.is_base ?? false;
  const amountStep = getAmountStep(selectedCurrency?.decimal_places ?? 2);

  const paymentAccountCurrencyMismatch =
    Boolean(currencyId && paymentAccount) &&
    !accountMatchesVoucherCurrency(paymentAccount, currencyId);

  const totalDebit = useMemo(
    () =>
      debitLines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [debitLines],
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
    !paymentAccountCurrencyMismatch &&
    validDebitLines.length > 0 &&
    totalDebit > 0 &&
    exchangeRate > 0 &&
    (!isInvoiceMode || (allocations.length > 0 && Boolean(vendorId)));

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error) return error.message;
    return "حدث خطأ غير متوقع.";
  };

  const buildHeaderPayload = (
    targetStatus: VoucherStatus,
    resolvedVoucherNo: string,
  ): Partial<VoucherHeader> => ({
    voucher_no: resolvedVoucherNo.trim(),
    voucher_type: "payment",
    settlement_mode: settlementMode,
    voucher_date: voucherDate,
    description: description.trim() || null,
    status: targetStatus,
    customer_id: null,
    vendor_id: isInvoiceMode ? vendorId || null : null,
    currency_id: currencyId || null,
    cost_center_id: null,
    exchange_rate: exchangeRate > 0 ? exchangeRate : null,
  });

  const resolveVoucherNo = async (): Promise<string | null> => {
    if (voucherNo.trim()) return voucherNo.trim();
    if (autoNumberEnabled) {
      const reserved = await voucherApi.reserveVoucherNo("payment");
      setVoucherNo(reserved);
      setNextNumberPreview(reserved);
      return reserved;
    }
    setFeedback("رقم السند مطلوب.");
    return null;
  };

  const syncVoucherLines = async (id: string) => {
    const linesToSave = buildPaymentVoucherLinesForSave(
      paymentAccountId,
      debitLines,
    );

    const details = await voucherApi.getVoucherById(id);
    for (const existingLine of details.lines) {
      await voucherApi.deleteVoucherLine(id, existingLine.id);
    }

    for (const line of linesToSave) {
      if (!line.account_id || Number(line.amount || 0) <= 0) continue;
      await voucherApi.addVoucherLine(id, {
        account_id: line.account_id,
        side: line.side,
        amount: Number(line.amount),
        line_description: line.line_description?.trim() || null,
        cost_center_id: line.cost_center_id || null,
        ...lineCategoryPayload(line),
      });
    }
  };

  const syncVoucherAllocations = async (id: string) => {
    const details = await voucherApi.getVoucherById(id);
    for (const existingAllocation of details.allocations) {
      await voucherApi.deleteAllocation(id, existingAllocation.id);
    }

    for (const allocation of allocations) {
      const targetId =
        allocation.target_journal_line_id || allocation.target_reference || "";
      const amount = Number(allocation.applied_amount || 0);
      if (!targetId || amount <= 0) continue;
      await voucherApi.addAllocation(id, {
        target_journal_line_id: targetId,
        applied_amount: amount,
        note: allocation.note?.trim() || null,
      });
    }
  };

  const saveVoucher = async (targetStatus: VoucherStatus) => {
    if (!currencyId) {
      setFeedback("اختر عملة السند.");
      return null;
    }
    if (!paymentAccountId) {
      setFeedback("حساب الدفع غير معرّف. عيّنه من إعدادات السندات.");
      return null;
    }
    if (validDebitLines.length === 0) {
      setFeedback("أضف سطراً مديناً واحداً على الأقل.");
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
      setFeedback(accountError);
      return null;
    }

    for (const line of validDebitLines) {
      const categoryError = validateLineCategory(line, lineCategories);
      if (categoryError) {
        setFeedback(categoryError);
        return null;
      }
    }
    if (exchangeRate <= 0) {
      setFeedback("سعر الصرف يجب أن يكون أكبر من صفر.");
      return null;
    }
    if (isInvoiceMode && !vendorId) {
      setFeedback("المورد مطلوب في وضع إغلاق الحركات.");
      return null;
    }

    try {
      const resolvedNo = await resolveVoucherNo();
      if (!resolvedNo) return null;

      const payload = buildHeaderPayload(targetStatus, resolvedNo);
      const savedHeader = voucherId
        ? await voucherApi.updateVoucher(voucherId, payload)
        : await voucherApi.createVoucher(payload);

      const activeId = savedHeader.id;
      if (!voucherId) setVoucherId(activeId);

      await syncVoucherLines(activeId);
      if (isInvoiceMode) {
        await syncVoucherAllocations(activeId);
      }

      setVoucherNo(savedHeader.voucher_no);
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

  const onVendorChange = (id: string, vendor: Vendor | null) => {
    setVendorId(id);
    if (!vendor?.payable_account_id) return;

    const payableAccount = accounts.find(
      (item) => item.id === vendor.payable_account_id,
    );
    if (
      currencyId &&
      payableAccount &&
      !accountMatchesVoucherCurrency(payableAccount, currencyId)
    ) {
      const accountCurrency = getCurrencyById(
        currencies,
        payableAccount.currency_id ?? "",
      );
      setFeedback(
        `حساب ذمم المورد (${payableAccount.code}) بعملة ${
          accountCurrency?.code ?? "—"
        } لا يطابق عملة السند (${selectedCurrency?.code ?? "—"}).`,
      );
      return;
    }

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

  const onCurrencyChange = (nextCurrencyId: string) => {
    setCurrencyId(nextCurrencyId);
    const currency = currencies.find((item) => item.id === nextCurrencyId);
    if (currency) {
      setExchangeRate(currency.is_base ? 1 : currency.exchange_rate);
    }

    setDebitLines((current) =>
      current.map((line) => {
        if (!line.account_id) return line;
        const account = accounts.find((item) => item.id === line.account_id);
        if (accountMatchesVoucherCurrency(account, nextCurrencyId)) {
          return line;
        }
        return {
          ...line,
          account_id: "",
          account_code: "",
          account_name: "",
        };
      }),
    );

    const currentPaymentAccount = accounts.find(
      (item) => item.id === paymentAccountId,
    );
    if (accountMatchesVoucherCurrency(currentPaymentAccount, nextCurrencyId)) {
      return;
    }

    const settingsAccount = accounts.find(
      (item) => item.id === defaultPaymentAccountFromSettings,
    );
    if (accountMatchesVoucherCurrency(settingsAccount, nextCurrencyId)) {
      setPaymentAccountId(defaultPaymentAccountFromSettings);
    } else {
      setPaymentAccountId("");
    }
  };

  useEffect(() => {
    if (!isInvoiceMode) {
      setVendorId("");
      setAllocations(EMPTY_ALLOCATIONS);
    }
  }, [isInvoiceMode]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [
          accountsData,
          vendorsData,
          costCentersData,
          currenciesData,
          openMovementsData,
          settings,
          typeDefaults,
          categoriesData,
        ] = await Promise.all([
          voucherApi.listAccounts(),
          voucherApi.listVendors(),
          voucherApi.listCostCenters(),
          currencyApi.listActiveCurrencies(),
          voucherApi.listOpenMovements(),
          voucherApi.getVoucherSettings(),
          voucherApi.getVoucherTypeDefaults("payment"),
          voucherLineCategoryApi.listCategories("payment", true),
        ]);

        if (cancelled) return;

        setAccounts(accountsData);
        setVendors(vendorsData);
        setCostCenters(costCentersData);
        setLineCategories(categoriesData);
        setCurrencies(currenciesData);
        setOpenMovements(openMovementsData);
        setAutoNumberEnabled(settings.auto_number_enabled);

        const defaultPaymentAccount = typeDefaults.default_account_id ?? "";
        setDefaultPaymentAccountFromSettings(defaultPaymentAccount);
        setPaymentAccountId(defaultPaymentAccount);

        const baseCurrency =
          currenciesData.find((currency) => currency.is_base) ??
          currenciesData[0];
        const defaultCurrencyId =
          typeDefaults.default_currency_id ?? baseCurrency?.id ?? "";
        setCurrencyId(defaultCurrencyId);
        const defaultCurrency = currenciesData.find(
          (currency) => currency.id === defaultCurrencyId,
        );
        setExchangeRate(
          defaultCurrency?.is_base ? 1 : defaultCurrency?.exchange_rate ?? 1,
        );

        if (initialMode !== "edit" || !initialVoucherId) {
          if (settings.auto_number_enabled) {
            const preview = await voucherApi.peekVoucherNo("payment");
            if (!cancelled) setNextNumberPreview(preview);
          }
          setIsLoading(false);
          return;
        }

        const details = await voucherApi.getVoucherById(initialVoucherId);
        if (cancelled) return;

        const { paymentAccountId: loadedPaymentAccount, debitLines: loadedDebits } =
          splitPaymentVoucherLines(details.lines, defaultPaymentAccount);

        setVoucherId(details.header.id);
        setVoucherNo(details.header.voucher_no);
        setNextNumberPreview(details.header.voucher_no);
        setSettlementMode(details.header.settlement_mode);
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
        setDebitLines(loadedDebits);
        setAllocations(details.allocations);
      } catch (error) {
        if (!cancelled) setFeedback(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [initialMode, initialVoucherId]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        جاري تحميل سند الدفع...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        <p className="font-semibold">سند دفع</p>
        <p className="mt-0.5 opacity-90">
          صرف مبلغ — دائن حساب الدفع تلقائياً، مدين حسابات مقابلة
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">
            {initialMode === "create" ? "سند دفع جديد" : "تعديل سند دفع"}
          </h1>
          <StatusChip status={status} />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(["account", "invoice"] as SettlementMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={readOnly || isSaving}
              onClick={() => setSettlementMode(mode)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                settlementMode === mode
                  ? "bg-rose-800 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              {getSettlementModeLabel(mode)}
            </button>
          ))}
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
              onChange={(event) => setVoucherDate(event.target.value)}
              disabled={readOnly || isSaving}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">عملة السند</span>
            <select
              value={currencyId}
              onChange={(event) => onCurrencyChange(event.target.value)}
              disabled={readOnly || isSaving || currencies.length === 0}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">اختر العملة</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} — {currency.name_ar}
                  {currency.is_base ? " (أساسية)" : ""}
                </option>
              ))}
            </select>
            {currencies.length === 0 ? (
              <p className="text-xs text-amber-700">
                لا توجد عملات نشطة.{" "}
                <Link href="/currencies" className="underline">
                  إدارة العملات
                </Link>
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                من{" "}
                <Link href="/currencies" className="text-blue-800 underline">
                  قسم العملات
                </Link>
                {selectedCurrency && (
                  <>
                    {" "}
                    — {selectedCurrency.symbol} ·{" "}
                    {selectedCurrency.decimal_places} خانات عشرية
                  </>
                )}
              </p>
            )}
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">سعر الصرف</span>
            <input
              type="number"
              min={0}
              step="0.000001"
              value={exchangeRate || ""}
              onChange={(event) => setExchangeRate(Number(event.target.value))}
              disabled={readOnly || isSaving || isBaseCurrency}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono disabled:bg-slate-50"
            />
            <p className="text-xs text-slate-500">
              {isBaseCurrency
                ? "العملة الأساسية — سعر الصرف ثابت = 1"
                : "يُحمَّل من قسم العملات ويمكن تعديله لهذا السند."}
            </p>
          </label>

          <div className="md:col-span-2">
            <AccountSearchField
              label="حساب الدفع (دائن — تلقائي)"
              accounts={accounts}
              currencies={currencies}
              filterCurrencyId={currencyId || undefined}
              value={paymentAccountId}
              onChange={(id) => setPaymentAccountId(id)}
              disabled={readOnly || isSaving || !currencyId}
            />
            <p className="mt-1 text-xs text-slate-500">
              الافتراضي من{" "}
              <Link href="/vouchers/settings" className="text-blue-800 underline">
                إعدادات السندات
              </Link>
              — يمكن تغييره لهذا السند. يُولَّد سطر دائن مقابل كل سطر مدين
              بنفس المبلغ ومركز الكلفة.
            </p>
            {paymentAccountCurrencyMismatch && (
              <p className="mt-1 text-xs text-amber-800">
                عملة حساب الدفع لا تطابق عملة السند.
              </p>
            )}
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
      />

      <VoucherAllocations
        allocations={allocations}
        openMovements={openMovements}
        onChange={setAllocations}
        readOnly={readOnly || isSaving}
        visible={isInvoiceMode}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="font-mono text-rose-900">
            إجمالي المدين: {formatVoucherAmount(totalDebit, selectedCurrency)}
          </p>
          <p className="font-mono text-rose-900">
            دائن حساب الدفع: {formatVoucherAmount(totalDebit, selectedCurrency)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setIsSaving(true);
              void saveVoucher("draft").finally(() => setIsSaving(false));
            }}
            disabled={readOnly || isSaving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            حفظ مسودة
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSaving(true);
              void saveVoucher("approved").finally(() => setIsSaving(false));
            }}
            disabled={readOnly || isSaving}
            className="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-800 disabled:opacity-50"
          >
            اعتماد
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSaving(true);
              void (async () => {
                if (!canPost) {
                  setFeedback(
                    "تعذر الترحيل. تحقق من حساب الدفع والأسطر والمورد والتخصيصات.",
                  );
                  return;
                }
                const activeId = await saveVoucher("approved");
                if (!activeId) return;
                const response = await voucherApi.postVoucher(activeId);
                setStatus("posted");
                setJournalEntryId(response.journal_entry_id);
                setFeedback(`تم الترحيل. القيد: ${response.journal_entry_no}`);
              })().finally(() => setIsSaving(false));
            }}
            disabled={!canPost || isSaving}
            className="rounded-md bg-rose-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            ترحيل
          </button>
          <Link href="/vouchers" className="rounded-md border border-slate-300 px-4 py-2 text-sm">
            قائمة السندات
          </Link>
          {journalEntryId && (
            <Link
              href={`/journals/${journalEntryId}`}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
            >
              فتح القيد
            </Link>
          )}
        </div>
        {feedback && (
          <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{feedback}</p>
        )}
      </section>
    </div>
  );
}
