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
  SettlementVoucherLinesTable,
  splitSettlementVoucherLines,
} from "@/modules/vouchers/components/settlement-voucher-lines-table";
import { voucherLineCategoryApi } from "@/modules/vouchers/services/voucher-line-category-api";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VoucherAdminPostedNotice } from "@/modules/vouchers/components/voucher-admin-posted-notice";
import { VoucherAttachmentsPanel } from "@/modules/vouchers/components/voucher-attachments-panel";
import {
  ApiError,
  voucherApi,
} from "@/modules/vouchers/services/voucher-api";
import type {
  Account,
  CostCenter,
  VoucherHeader,
  VoucherLine,
  VoucherLineCategory,
  VoucherStatus,
} from "@/modules/vouchers/types";
import type { Currency } from "@/modules/currencies/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import {
  accountMatchesVoucherCurrency,
  formatVoucherAmount,
  getAmountStep,
  validateSettlementVoucherAccounts,
} from "@/modules/vouchers/utils/voucher-currency-utils";
import { useVoucherFormPermissions } from "@/modules/vouchers/hooks/use-voucher-form-permissions";
import {
  getVoucherSaveFeedback,
  resolveVoucherSaveStatus,
} from "@/modules/vouchers/utils/voucher-save-utils";
import { validateCostCenterBalance } from "@/modules/vouchers/utils/voucher-cost-center-utils";

interface SettlementVoucherFormProps {
  initialMode?: "create" | "edit";
  initialVoucherId?: string;
}

const EMPTY_LINES: VoucherLine[] = [];

export function SettlementVoucherForm({
  initialMode = "create",
  initialVoucherId,
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
  const [journalEntryId, setJournalEntryId] = useState("");
  const [status, setStatus] = useState<VoucherStatus>("draft");
  const [description, setDescription] = useState("");
  const [userLines, setUserLines] = useState<VoucherLine[]>(EMPTY_LINES);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [lineCategories, setLineCategories] = useState<VoucherLineCategory[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const [clearingAccountId, setClearingAccountId] = useState("");
  const [defaultClearingAccountFromSettings, setDefaultClearingAccountFromSettings] =
    useState("");

  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(initialMode === "edit");
  const [isSaving, setIsSaving] = useState(false);

  const isCreate = initialMode === "create" && !voucherId;
  const { canSave, canPost: canPostPermission, canDeleteLine, formReadOnly, canEditPosted } =
    useVoucherFormPermissions(isCreate ? "create" : "edit", status);
  const readOnly = formReadOnly;
  const voucherNoReadOnly =
    readOnly || (autoNumberEnabled && (Boolean(voucherId) || isCreate));

  const selectedCurrency = currencies.find((currency) => currency.id === currencyId);
  const clearingAccount = accounts.find((account) => account.id === clearingAccountId);
  const isBaseCurrency = selectedCurrency?.is_base ?? false;
  const amountStep = getAmountStep(selectedCurrency?.decimal_places ?? 2);

  const clearingAccountCurrencyMismatch =
    Boolean(currencyId && clearingAccount) &&
    !accountMatchesVoucherCurrency(clearingAccount, currencyId);

  const totalUserDebit = useMemo(
    () =>
      userLines
        .filter((line) => line.side === "debit")
        .reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [userLines],
  );

  const totalUserCredit = useMemo(
    () =>
      userLines
        .filter((line) => line.side === "credit")
        .reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [userLines],
  );

  const validUserLines = useMemo(
    () =>
      userLines.filter(
        (line) =>
          line.account_id &&
          line.cost_center_id &&
          Number(line.amount || 0) > 0,
      ),
    [userLines],
  );

  const costCenterBalanceError = useMemo(
    () =>
      validateCostCenterBalance({
        lines: validUserLines,
        costCenters,
        requireCostCenter: true,
        excludeNullCostCenter: true,
      }),
    [validUserLines, costCenters],
  );

  const canPost =
    !readOnly &&
    Boolean(currencyId) &&
    Boolean(clearingAccountId) &&
    !clearingAccountCurrencyMismatch &&
    validUserLines.length > 0 &&
    (totalUserDebit > 0 || totalUserCredit > 0) &&
    exchangeRate > 0 &&
    !costCenterBalanceError;

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
    setFeedback("رقم السند مطلوب.");
    return null;
  };

  const syncVoucherLines = async (id: string) => {
    const linesToSave = buildSettlementVoucherLinesForSave(
      clearingAccountId,
      userLines,
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

  const saveVoucher = async (targetStatus: VoucherStatus) => {
    if (!currencyId) {
      setFeedback("اختر عملة السند.");
      return null;
    }
    if (!clearingAccountId) {
      setFeedback("الحساب الوسيط غير معرّف. عيّنه من إعدادات السندات.");
      return null;
    }
    if (validUserLines.length === 0) {
      setFeedback("أضف سطراً واحداً على الأقل (مدين أو دائن).");
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
      setFeedback(accountError);
      return null;
    }

    const costCenterError = validateCostCenterBalance({
      lines: validUserLines,
      costCenters,
      requireCostCenter: true,
      excludeNullCostCenter: true,
    });
    if (costCenterError) {
      setFeedback(costCenterError);
      return null;
    }

    for (const line of validUserLines) {
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

    try {
      const resolvedNo = await resolveVoucherNo();
      if (!resolvedNo) return null;

      const effectiveStatus = resolveVoucherSaveStatus(status, targetStatus);
      const payload = buildHeaderPayload(effectiveStatus, resolvedNo);
      const savedHeader = voucherId
        ? await voucherApi.updateVoucher(voucherId, payload)
        : await voucherApi.createVoucher(payload);

      const activeId = savedHeader.id;
      if (!voucherId) setVoucherId(activeId);

      await syncVoucherLines(activeId);

      if (effectiveStatus === "posted") {
        await voucherApi.syncPostedVoucherJournal(activeId);
      }

      setVoucherNo(savedHeader.voucher_no);
      setStatus(savedHeader.status);
      setFeedback(getVoucherSaveFeedback(status, targetStatus));
      return activeId;
    } catch (error) {
      setFeedback(getErrorMessage(error));
      return null;
    }
  };

  const onCurrencyChange = (nextCurrencyId: string) => {
    setCurrencyId(nextCurrencyId);
    const currency = currencies.find((item) => item.id === nextCurrencyId);
    if (currency) {
      setExchangeRate(currency.is_base ? 1 : currency.exchange_rate);
    }

    setUserLines((current) =>
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

    const currentClearingAccount = accounts.find(
      (item) => item.id === clearingAccountId,
    );
    if (accountMatchesVoucherCurrency(currentClearingAccount, nextCurrencyId)) {
      return;
    }

    const settingsAccount = accounts.find(
      (item) => item.id === defaultClearingAccountFromSettings,
    );
    if (accountMatchesVoucherCurrency(settingsAccount, nextCurrencyId)) {
      setClearingAccountId(defaultClearingAccountFromSettings);
    } else {
      setClearingAccountId("");
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [
          accountsData,
          costCentersData,
          currenciesData,
          settings,
          typeDefaults,
          categoriesData,
        ] = await Promise.all([
          voucherApi.listAccounts(),
          voucherApi.listCostCenters(),
          currencyApi.listActiveCurrencies(),
          voucherApi.getVoucherSettings(),
          voucherApi.getVoucherTypeDefaults("settlement"),
          voucherLineCategoryApi.listCategories("settlement", true),
        ]);

        if (cancelled) return;

        setAccounts(accountsData);
        setCostCenters(costCentersData);
        setLineCategories(categoriesData);
        setCurrencies(currenciesData);
        setAutoNumberEnabled(settings.auto_number_enabled);

        const defaultClearingAccount = typeDefaults.default_account_id ?? "";
        setDefaultClearingAccountFromSettings(defaultClearingAccount);
        setClearingAccountId(defaultClearingAccount);

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
        جاري تحميل سند التصفية...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-semibold">سند تصفية</p>
        <p className="mt-0.5 opacity-90">
          تسوية بين حسابات عبر حساب وسيط — كل سطر له مقابل على الوسيط، مع
          توازن المدين والدائن لكل مركز كلفة
        </p>
      </div>

      <VoucherAdminPostedNotice visible={canEditPosted} />

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
              label="الحساب الوسيط (مقابل تلقائي)"
              accounts={accounts}
              currencies={currencies}
              filterCurrencyId={currencyId || undefined}
              value={clearingAccountId}
              onChange={(id) => setClearingAccountId(id)}
              disabled={readOnly || isSaving || !currencyId}
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
            {clearingAccountCurrencyMismatch && (
              <p className="mt-1 text-xs text-amber-800">
                عملة الحساب الوسيط لا تطابق عملة السند.
              </p>
            )}
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
                  void saveVoucher("approved").finally(() => setIsSaving(false));
                }}
                disabled={isSaving}
                className="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-800 disabled:opacity-50"
              >
                اعتماد
              </button>
            </>
          )}
          {canPostPermission && !canEditPosted && (
            <button
              type="button"
              onClick={() => {
                setIsSaving(true);
                void (async () => {
                  if (!canPost) {
                    setFeedback(
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
                  setFeedback(`تم الترحيل. القيد: ${response.journal_entry_no}`);
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
        {feedback && (
          <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{feedback}</p>
        )}
      </section>
    </div>
  );
}
