"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildUrlWithQuery,
  OpenInNewTabLink,
} from "@/components/open-in-new-tab-link";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { CostCenterSearchField } from "@/modules/vouchers/components/cost-center-search-field";
import { ReportsNav } from "@/modules/reports/components/reports-nav";
import {
  aggregateTrialBalanceTree,
  applyHideZeroRows,
  applyTrialBalanceCurrencyDisplay,
  buildTrialBalanceShareParams,
  computeTrialBalanceTotals,
  countDistinctTrialBalanceCurrencies,
  filterTrialBalanceSearch,
  parseTrialBalanceShareParams,
  type TrialBalanceCurrencyMode,
} from "@/modules/reports/utils/trial-balance-utils";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import type { Currency } from "@/modules/currencies/types";
import { formatCurrencyAmount } from "@/modules/currencies/utils/convert-amount";
import {
  accountingPeriodApi,
  type AccountingPeriod,
} from "@/modules/accounting-periods/services/accounting-period-api";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, CostCenter, TrialBalanceRow } from "@/modules/vouchers/types";

function readInitialParams() {
  if (typeof window === "undefined") {
    return parseTrialBalanceShareParams(new URLSearchParams());
  }
  return parseTrialBalanceShareParams(new URLSearchParams(window.location.search));
}

function formatAmount(value: number, currency?: Currency): string {
  const decimalPlaces = currency?.decimal_places ?? 2;
  return formatCurrencyAmount(
    value,
    decimalPlaces,
    currency?.symbol ?? currency?.code,
  );
}

export default function TrialBalancePage() {
  const initial = readInitialParams();
  const [rawRows, setRawRows] = useState<TrialBalanceRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState(initial.search ?? "");
  const [fromDate, setFromDate] = useState(initial.fromDate ?? "");
  const [toDate, setToDate] = useState(initial.toDate ?? "");
  const [currencyMode, setCurrencyMode] = useState<TrialBalanceCurrencyMode>(
    initial.currencyMode ?? "native",
  );
  const [currencyId, setCurrencyId] = useState(initial.currencyId ?? "");
  const [accountId, setAccountId] = useState(initial.accountId ?? "");
  const [accountSubtree, setAccountSubtree] = useState(
    initial.accountSubtree !== false,
  );
  const [costCenterId, setCostCenterId] = useState(initial.costCenterId ?? "");
  const [periodId, setPeriodId] = useState(initial.periodId ?? "");
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [aggregateTree, setAggregateTree] = useState(initial.aggregateTree ?? false);
  const [hideZero, setHideZero] = useState(initial.hideZero ?? false);

  const syncUrl = useCallback(
    (overrides?: Partial<ReturnType<typeof buildTrialBalanceShareParams>>) => {
      const params = buildTrialBalanceShareParams({
        fromDate,
        toDate,
        search: query,
        currencyMode,
        currencyId: currencyMode === "native" ? currencyId : undefined,
        accountId,
        accountSubtree,
        costCenterId,
        periodId,
        aggregateTree,
        hideZero,
        ...overrides,
      });
      const nextUrl = buildUrlWithQuery("/reports/trial-balance", params);
      window.history.replaceState(null, "", nextUrl);
    },
    [
      fromDate,
      toDate,
      query,
      currencyMode,
      currencyId,
      accountId,
      accountSubtree,
      costCenterId,
      periodId,
      aggregateTree,
      hideZero,
    ],
  );

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const rpcCurrencyId =
        currencyMode === "native" && currencyId ? currencyId : undefined;

      const data = await voucherApi.listTrialBalanceRows({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        currencyId: rpcCurrencyId,
        accountId: accountId || undefined,
        accountSubtree,
        costCenterId: costCenterId || undefined,
      });
      setRawRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل ميزان المراجعة.");
    } finally {
      setIsLoading(false);
    }
  }, [
    fromDate,
    toDate,
    currencyMode,
    currencyId,
    accountId,
    accountSubtree,
    costCenterId,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
      try {
        const [accountsData, currenciesData, centersData, periodsData] =
          await Promise.all([
          voucherApi.listAllAccounts(),
          currencyApi.listActiveCurrencies(),
          voucherApi.listCostCenters(),
          accountingPeriodApi.listActivePeriodOptions(),
        ]);
        if (cancelled) return;
        setAccounts(accountsData);
        setCurrencies(currenciesData);
        setCostCenters(centersData);
        setPeriods(periodsData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل البيانات.");
          setIsLoading(false);
        }
      }
    };

    void loadMeta();
    void loadRows();

    return () => {
      cancelled = true;
    };
  }, [loadRows]);

  const displayRows = useMemo(() => {
    let rows = [...rawRows];

    if (aggregateTree) {
      rows = aggregateTrialBalanceTree(rows, accounts);
    } else {
      rows = rows.map((row) => ({ ...row, depth: 0, is_aggregated: false }));
    }

    if (hideZero) {
      rows = applyHideZeroRows(rows);
    }

    const { rows: currencyRows } = applyTrialBalanceCurrencyDisplay(
      rows,
      currencies,
      currencyMode,
    );

    return filterTrialBalanceSearch(currencyRows, query);
  }, [
    rawRows,
    aggregateTree,
    accounts,
    hideZero,
    currencies,
    currencyMode,
    query,
  ]);

  const displayCurrency = useMemo(() => {
    if (currencyMode === "base") {
      return currencies.find((currency) => currency.is_base) ?? currencies[0];
    }
    if (currencyId) {
      return currencies.find((currency) => currency.id === currencyId);
    }
    return undefined;
  }, [currencyMode, currencyId, currencies]);

  const showMovementOpening = Boolean(fromDate);
  const showOpeningEntry = true;
  const mixedCurrencies =
    currencyMode === "native" &&
    !currencyId &&
    countDistinctTrialBalanceCurrencies(displayRows) > 1;

  const totals = useMemo(
    () => computeTrialBalanceTotals(displayRows, true),
    [displayRows],
  );

  const shareHref = useMemo(
    () =>
      buildUrlWithQuery(
        "/reports/trial-balance",
        buildTrialBalanceShareParams({
          fromDate,
          toDate,
          search: query,
          currencyMode,
          currencyId: currencyMode === "native" ? currencyId : undefined,
          accountId,
          accountSubtree,
          costCenterId,
          periodId,
          aggregateTree,
          hideZero,
        }),
      ),
    [
      fromDate,
      toDate,
      query,
      currencyMode,
      currencyId,
      accountId,
      accountSubtree,
      costCenterId,
      periodId,
      aggregateTree,
      hideZero,
    ],
  );

  const applyFilters = async () => {
    syncUrl();
    await loadRows();
  };

  const resetFilters = async () => {
    setFromDate("");
    setToDate("");
    setCurrencyMode("native");
    setCurrencyId("");
    setAccountId("");
    setAccountSubtree(true);
    setCostCenterId("");
    setPeriodId("");
    setAggregateTree(false);
    setHideZero(false);
    setQuery("");
    syncUrl({
      from: undefined,
      to: undefined,
      currency: undefined,
      accountId: undefined,
      accountSubtree: undefined,
      costCenterId: undefined,
      periodId: undefined,
      tree: undefined,
      hideZero: undefined,
      q: undefined,
    });
    setIsLoading(true);
    setError("");
    try {
      const data = await voucherApi.listTrialBalanceRows({});
      setRawRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل ميزان المراجعة.");
    } finally {
      setIsLoading(false);
    }
  };

  const balanceDiff = totals.debit - totals.credit;
  const isBalanced = Math.abs(balanceDiff) <= 0.000001;

  return (
    <main className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            ميزان المراجعة
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            حسابات مرحّلة — عمود افتتاحي منفصل عن حركة الفترة — فلاتر عملة
            وحساب ومركز كلفة وفترة محاسبية.
          </p>
        </div>
        <OpenInNewTabLink href={shareHref} className="btn btn-sm btn-outline">
          ↗ نسخة في تبويب جديد
        </OpenInNewTabLink>
      </div>

      <ReportsNav active="trial-balance" />

      <section className="mb-4 mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              syncUrl({ q: event.target.value || undefined });
            }}
            placeholder="بحث بكود الحساب أو الاسم"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
          />
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            title="من تاريخ"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            title="إلى تاريخ"
          />
        </div>

        <div className="mt-3">
          <label className="grid max-w-xl gap-1 text-sm">
            <span className="font-medium text-slate-700">فترة محاسبية (اختياري)</span>
            <select
              value={periodId}
              onChange={(event) => {
                const nextId = event.target.value;
                setPeriodId(nextId);
                const period = periods.find((item) => item.id === nextId);
                if (period) {
                  setFromDate(period.start_date);
                  setToDate(period.end_date);
                  syncUrl({
                    periodId: nextId,
                    from: period.start_date,
                    to: period.end_date,
                  });
                } else {
                  syncUrl({ periodId: undefined });
                }
              }}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">— تواريخ يدوية —</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.period_code} · {period.start_date} → {period.end_date}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">عملة العرض</span>
            <select
              value={currencyMode === "base" ? "base" : currencyId || "all"}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "base") {
                  setCurrencyMode("base");
                  setCurrencyId("");
                } else if (value === "all") {
                  setCurrencyMode("native");
                  setCurrencyId("");
                } else {
                  setCurrencyMode("native");
                  setCurrencyId(value);
                }
              }}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="all">كل العملات (أصلية لكل حساب)</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} — {currency.name_ar}
                </option>
              ))}
              <option value="base">محوّلة للعملة الأساسية</option>
            </select>
          </label>

          <AccountSearchField
            label="حساب محدد (اختياري)"
            accounts={accounts.filter((account) => account.is_active)}
            currencies={currencies}
            value={accountId}
            onChange={(id) => setAccountId(id)}
            placeholder="الكل — أو اختر حساباً"
          />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <CostCenterSearchField
            label="مركز الكلفة (اختياري)"
            costCenters={costCenters}
            value={costCenterId}
            onChange={(id) => setCostCenterId(id)}
          />
          <div className="flex flex-wrap items-end gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={accountSubtree}
                onChange={(event) => setAccountSubtree(event.target.checked)}
                disabled={!accountId}
              />
              <span>يشمل فروع الحساب</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={aggregateTree}
                onChange={(event) => setAggregateTree(event.target.checked)}
              />
              <span>تجميع شجري (حسابات أب)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hideZero}
                onChange={(event) => setHideZero(event.target.checked)}
              />
              <span>إخفاء الأرصدة الصفرية</span>
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void applyFilters()}
            disabled={isLoading}
            className="btn btn-primary"
          >
            تطبيق
          </button>
          <button
            type="button"
            onClick={() => void resetFilters()}
            disabled={isLoading}
            className="btn btn-outline"
          >
            إعادة ضبط
          </button>
        </div>
      </section>

      {mixedCurrencies && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          التقرير يعرض عدة عملات — الإجماليات في الأسفل قد لا تكون معنىً
          محاسبياً. اختر عملة واحدة أو «محوّلة للعملة الأساسية».
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        {!isLoading && !error && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="data-table min-w-[1100px]">
                <thead>
                  <tr>
                    <th>كود</th>
                    <th>اسم الحساب</th>
                    <th>عملة</th>
                    {showOpeningEntry && <th>رصيد افتتاحي</th>}
                    {showMovementOpening && <th>رصيد سابق</th>}
                    <th>مدين الفترة</th>
                    <th>دائن الفترة</th>
                    <th>رصيد ختامي</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => {
                    const rowCurrency =
                      displayCurrency ??
                      currencies.find((currency) => currency.id === row.currency_id);
                    const depth = row.depth ?? 0;
                    const statementHref = buildUrlWithQuery(
                      "/reports/account-statement",
                      {
                        accountId: row.account_id,
                        from: fromDate || undefined,
                        to: toDate || undefined,
                        costCenterId: costCenterId || undefined,
                      },
                    );

                    return (
                      <tr
                        key={row.account_id}
                        className={`odd:bg-white even:bg-slate-50/60 ${
                          row.is_aggregated ? "bg-blue-50/40" : ""
                        }`}
                      >
                        <td className="border-b border-slate-100 p-2 font-mono">
                          {row.account_code}
                        </td>
                        <td
                          className="border-b border-slate-100 p-2"
                          style={{ paddingRight: `${depth * 1.25 + 0.5}rem` }}
                        >
                          <span className={row.is_aggregated ? "font-semibold" : ""}>
                            {row.account_name}
                          </span>
                          {row.is_aggregated && (
                            <span className="mr-2 text-xs text-blue-800">مجمّع</span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 p-2 font-mono text-xs">
                          {row.currency_code ?? rowCurrency?.code ?? "—"}
                        </td>
                        {showOpeningEntry && (
                          <td className="border-b border-slate-100 p-2 font-mono">
                            {formatAmount(row.opening_entry_balance ?? 0, rowCurrency)}
                          </td>
                        )}
                        {showMovementOpening && (
                          <td className="border-b border-slate-100 p-2 font-mono">
                            {formatAmount(row.opening_balance, rowCurrency)}
                          </td>
                        )}
                        <td className="border-b border-slate-100 p-2 font-mono">
                          {formatAmount(row.period_debit, rowCurrency)}
                        </td>
                        <td className="border-b border-slate-100 p-2 font-mono">
                          {formatAmount(row.period_credit, rowCurrency)}
                        </td>
                        <td className="border-b border-slate-100 p-2 font-mono">
                          {formatAmount(row.closing_balance, rowCurrency)}
                        </td>
                        <td className="border-b border-slate-100 p-2">
                          {row.is_postable && !row.is_aggregated ? (
                            <Link
                              href={statementHref}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              كشف
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {displayRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={
                          5 +
                          (showOpeningEntry ? 1 : 0) +
                          (showMovementOpening ? 1 : 0) +
                          1
                        }
                        className="border-b border-slate-100 p-4 text-center text-slate-500"
                      >
                        لا توجد بيانات للفلاتر المحددة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div
              className={`mt-3 grid gap-2 rounded-md p-3 text-sm ${
                isBalanced
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-rose-50 text-rose-900"
              } ${
                showOpeningEntry && showMovementOpening
                  ? "sm:grid-cols-2 lg:grid-cols-6"
                  : showOpeningEntry || showMovementOpening
                    ? "sm:grid-cols-2 lg:grid-cols-5"
                    : "sm:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              {showOpeningEntry && (
                <p className="font-mono">
                  رصيد افتتاحي: {formatAmount(totals.openingEntry, displayCurrency)}
                </p>
              )}
              {showMovementOpening && (
                <p className="font-mono">
                  رصيد سابق: {formatAmount(totals.opening, displayCurrency)}
                </p>
              )}
              <p className="font-mono">
                مدين الفترة: {formatAmount(totals.debit, displayCurrency)}
              </p>
              <p className="font-mono">
                دائن الفترة: {formatAmount(totals.credit, displayCurrency)}
              </p>
              <p className="font-mono">
                رصيد ختامي: {formatAmount(totals.closing, displayCurrency)}
              </p>
              <p className="font-mono">
                فرق مدين−دائن: {formatAmount(balanceDiff, displayCurrency)}
                {isBalanced ? " ✓" : " ⚠"}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              الإجماليات من الحسابات المرحّلة فقط (بدون صفوف التجميع الشجري).
            </p>
          </>
        )}
      </section>
    </main>
  );
}
