"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { CostCenterSearchField } from "@/modules/vouchers/components/cost-center-search-field";
import { CustomerSearchField } from "@/modules/vouchers/components/customer-search-field";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VoucherAllocations } from "@/modules/vouchers/components/voucher-allocations";
import { VoucherLinesTable } from "@/modules/vouchers/components/voucher-lines-table";
import {
  ApiError,
  voucherApi,
} from "@/modules/vouchers/services/voucher-api";
import type {
  Account,
  CostCenter,
  Customer,
  SettlementMode,
  VoucherAllocation,
  VoucherHeader,
  VoucherLine,
  VoucherStatus,
} from "@/modules/vouchers/types";
import { getSettlementModeLabel } from "@/modules/vouchers/utils/voucher-type-config";
import type { Currency } from "@/modules/currencies/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";

interface ReceiptVoucherFormProps {
  initialMode?: "create" | "edit";
  initialVoucherId?: string;
}

const EMPTY_LINES: VoucherLine[] = [];
const EMPTY_ALLOCATIONS: VoucherAllocation[] = [];

export function ReceiptVoucherForm({
  initialMode = "create",
  initialVoucherId,
}: ReceiptVoucherFormProps) {
  const [voucherId, setVoucherId] = useState(initialVoucherId ?? "");
  const [voucherNo, setVoucherNo] = useState("");
  const [nextNumberPreview, setNextNumberPreview] = useState("");
  const [autoNumberEnabled, setAutoNumberEnabled] = useState(true);
  const [settlementMode, setSettlementMode] = useState<SettlementMode>("account");
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [currencyId, setCurrencyId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [journalEntryId, setJournalEntryId] = useState("");
  const [status, setStatus] = useState<VoucherStatus>("draft");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<VoucherLine[]>(EMPTY_LINES);
  const [allocations, setAllocations] =
    useState<VoucherAllocation[]>(EMPTY_ALLOCATIONS);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [openMovements, setOpenMovements] = useState<
    Awaited<ReturnType<typeof voucherApi.listOpenMovements>>
  >([]);

  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [quickAmount, setQuickAmount] = useState<number>(0);

  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(initialMode === "edit");
  const [isSaving, setIsSaving] = useState(false);

  const readOnly = status === "posted" || status === "cancelled";
  const isCreate = initialMode === "create" && !voucherId;
  const voucherNoReadOnly =
    readOnly || (autoNumberEnabled && (Boolean(voucherId) || isCreate));
  const isInvoiceMode = settlementMode === "invoice";

  const totals = useMemo(() => {
    const debit = lines
      .filter((line) => line.side === "debit")
      .reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const credit = lines
      .filter((line) => line.side === "credit")
      .reduce((sum, line) => sum + Number(line.amount || 0), 0);
    return { debit, credit, difference: debit - credit };
  }, [lines]);

  const canPost =
    !readOnly &&
    lines.length > 0 &&
    totals.difference === 0 &&
    (!isInvoiceMode || (allocations.length > 0 && Boolean(customerId)));

  const selectedCurrency = currencies.find((currency) => currency.id === currencyId);

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
    voucher_type: "receipt",
    settlement_mode: settlementMode,
    voucher_date: voucherDate,
    description: description.trim() || null,
    status: targetStatus,
    customer_id: isInvoiceMode ? customerId || null : null,
    vendor_id: null,
    currency_id: currencyId || null,
    cost_center_id: costCenterId || null,
  });

  const resolveVoucherNo = async (): Promise<string | null> => {
    if (voucherNo.trim()) return voucherNo.trim();
    if (autoNumberEnabled) {
      const reserved = await voucherApi.reserveVoucherNo("receipt");
      setVoucherNo(reserved);
      setNextNumberPreview(reserved);
      return reserved;
    }
    setFeedback("رقم السند مطلوب.");
    return null;
  };

  const syncVoucherLines = async (id: string) => {
    const details = await voucherApi.getVoucherById(id);
    for (const existingLine of details.lines) {
      await voucherApi.deleteVoucherLine(id, existingLine.id);
    }

    for (const line of lines) {
      if (!line.account_id || Number(line.amount || 0) <= 0) continue;
      await voucherApi.addVoucherLine(id, {
        account_id: line.account_id,
        side: line.side,
        amount: Number(line.amount),
        line_description: line.line_description?.trim() || null,
        cost_center_id: line.cost_center_id || costCenterId || null,
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
    if (isInvoiceMode && !customerId) {
      setFeedback("العميل مطلوب في وضع إغلاق الحركات.");
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

  const applyQuickLines = () => {
    if (!debitAccountId || !creditAccountId || quickAmount <= 0) {
      setFeedback("أدخل المبلغ وحسابي المدين والدائن.");
      return;
    }

    const debitAccount = accounts.find((account) => account.id === debitAccountId);
    const creditAccount = accounts.find((account) => account.id === creditAccountId);

    setLines([
      {
        id: crypto.randomUUID(),
        voucher_id: voucherId || "draft",
        account_id: debitAccountId,
        account_code: debitAccount?.code,
        account_name: debitAccount?.name_ar,
        side: "debit",
        amount: quickAmount,
        line_description: "قبض — مدين",
        cost_center_id: costCenterId || null,
      },
      {
        id: crypto.randomUUID(),
        voucher_id: voucherId || "draft",
        account_id: creditAccountId,
        account_code: creditAccount?.code,
        account_name: creditAccount?.name_ar,
        side: "credit",
        amount: quickAmount,
        line_description: "قبض — دائن",
        cost_center_id: costCenterId || null,
      },
    ]);
    setFeedback("تم بناء سطري السند من الإدخال السريع.");
  };

  const onCustomerChange = (id: string, customer: Customer | null) => {
    setCustomerId(id);
    if (customer?.receivable_account_id) {
      setCreditAccountId(customer.receivable_account_id);
    }
  };

  useEffect(() => {
    if (!isInvoiceMode) {
      setCustomerId("");
      setAllocations(EMPTY_ALLOCATIONS);
    }
  }, [isInvoiceMode]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [
          accountsData,
          customersData,
          costCentersData,
          currenciesData,
          openMovementsData,
          settings,
          typeDefaults,
        ] = await Promise.all([
          voucherApi.listAccounts(),
          voucherApi.listCustomers(),
          voucherApi.listCostCenters(),
          currencyApi.listActiveCurrencies(),
          voucherApi.listOpenMovements(),
          voucherApi.getVoucherSettings(),
          voucherApi.getVoucherTypeDefaults("receipt"),
        ]);

        if (cancelled) return;

        setAccounts(accountsData);
        setCustomers(customersData);
        setCostCenters(costCentersData);
        setCurrencies(currenciesData);
        setOpenMovements(openMovementsData);
        setAutoNumberEnabled(settings.auto_number_enabled);

        const baseCurrency =
          currenciesData.find((currency) => currency.is_base) ??
          currenciesData[0];
        setCurrencyId(
          typeDefaults.default_currency_id ?? baseCurrency?.id ?? "",
        );
        setCostCenterId(typeDefaults.default_cost_center_id ?? "");
        setDebitAccountId(typeDefaults.default_account_id ?? "");

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

        setVoucherId(details.header.id);
        setVoucherNo(details.header.voucher_no);
        setNextNumberPreview(details.header.voucher_no);
        setSettlementMode(details.header.settlement_mode);
        setVoucherDate(details.header.voucher_date);
        setCurrencyId(details.header.currency_id ?? typeDefaults.default_currency_id ?? "");
        setCostCenterId(details.header.cost_center_id ?? "");
        setJournalEntryId(details.header.journal_entry_id ?? "");
        setStatus(details.header.status);
        setDescription(details.header.description ?? "");
        setCustomerId(details.header.customer_id ?? "");
        setLines(details.lines);
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
        جاري تحميل سند القبض...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <p className="font-semibold">سند قبض</p>
        <p className="mt-0.5 opacity-90">استلام مبلغ — مدين صندوق/بنك، دائن حساب مقابل</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">
            {initialMode === "create" ? "سند قبض جديد" : "تعديل سند قبض"}
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
                  ? "bg-emerald-800 text-white"
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
              onChange={(event) => setCurrencyId(event.target.value)}
              disabled={readOnly || isSaving}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">اختر العملة</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} — {currency.name_ar}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2">
            <CostCenterSearchField
              costCenters={costCenters}
              value={costCenterId}
              onChange={(id) => setCostCenterId(id)}
              disabled={readOnly || isSaving}
            />
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

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">إدخال سريع</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">المبلغ</span>
            <input
              type="number"
              min={0}
              step={selectedCurrency?.decimal_places ? 0.01 : 1}
              value={quickAmount || ""}
              onChange={(event) => setQuickAmount(Number(event.target.value))}
              disabled={readOnly || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2 font-mono"
            />
          </label>
          <AccountSearchField
            label="حساب القبض (مدين)"
            accounts={accounts}
            value={debitAccountId}
            onChange={(id) => setDebitAccountId(id)}
            disabled={readOnly || isSaving}
          />
          <AccountSearchField
            label="حساب الدائن"
            accounts={accounts}
            value={creditAccountId}
            onChange={(id) => setCreditAccountId(id)}
            disabled={readOnly || isSaving}
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyQuickLines}
              disabled={readOnly || isSaving}
              className="w-full rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              بناء الأسطر
            </button>
          </div>
        </div>
        {selectedCurrency && (
          <p className="mt-2 text-xs text-slate-500">
            العملة: {selectedCurrency.code} ({selectedCurrency.symbol})
          </p>
        )}
      </section>

      <VoucherLinesTable
        lines={lines}
        accounts={accounts}
        costCenters={costCenters}
        defaultCostCenterId={costCenterId}
        onChange={setLines}
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
        <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
          <p className="font-mono">مدين: {totals.debit.toFixed(2)}</p>
          <p className="font-mono">دائن: {totals.credit.toFixed(2)}</p>
          <p className="font-mono text-blue-900">فرق: {totals.difference.toFixed(2)}</p>
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
                  setFeedback("تعذر الترحيل. تحقق من التوازن والعميل والتخصيصات.");
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
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
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
