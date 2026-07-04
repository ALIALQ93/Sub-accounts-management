"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildUrlWithQuery,
  OpenInNewTabLink,
} from "@/components/open-in-new-tab-link";
import { AccountMultiSelectField } from "@/modules/accounts/components/account-multi-select-field";
import { AccountStatementSection } from "@/modules/accounts/components/account-statement-section";
import { ReportsNav } from "@/modules/reports/components/reports-nav";
import {
  buildAccountStatementShareParams,
  parseAccountStatementShareParams,
  resolveDisplayCurrency,
} from "@/modules/reports/utils/account-statement-utils";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import type { Currency } from "@/modules/currencies/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, CostCenter } from "@/modules/vouchers/types";

function readInitialParams() {
  if (typeof window === "undefined") {
    return parseAccountStatementShareParams(new URLSearchParams());
  }
  return parseAccountStatementShareParams(
    new URLSearchParams(window.location.search),
  );
}

export default function AccountStatementReportPage() {
  const initial = readInitialParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>(initial.accountIds);
  const [displayCurrencyId, setDisplayCurrencyId] = useState(
    initial.displayCurrencyId,
  );
  const [onlyDisplayCurrency, setOnlyDisplayCurrency] = useState(
    initial.onlyDisplayCurrency,
  );
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [costCenterId, setCostCenterId] = useState(initial.costCenterId);
  const [search, setSearch] = useState(initial.search);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const syncUrl = useCallback(
    (
      overrides?: Partial<{
        accountIds: string[];
        fromDate: string;
        toDate: string;
        costCenterId: string;
        search: string;
        displayCurrencyId: string;
        onlyDisplayCurrency: boolean;
      }>,
    ) => {
      const params = buildAccountStatementShareParams({
        accountIds,
        fromDate,
        toDate,
        costCenterId,
        search,
        displayCurrencyId,
        onlyDisplayCurrency,
        ...overrides,
      });
      const nextUrl = buildUrlWithQuery("/reports/account-statement", params);
      window.history.replaceState(null, "", nextUrl);
    },
    [
      accountIds,
      fromDate,
      toDate,
      costCenterId,
      search,
      displayCurrencyId,
      onlyDisplayCurrency,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [accountsData, currenciesData, costCentersData] =
          await Promise.all([
            voucherApi.listAccounts(),
            currencyApi.listActiveCurrencies(),
            voucherApi.listCostCenters(),
          ]);
        if (cancelled) return;
        setAccounts(accountsData);
        setCurrencies(currenciesData);
        setCostCenters(costCentersData);

        if (!initial.displayCurrencyId) {
          const base =
            currenciesData.find((currency) => currency.is_base) ??
            currenciesData[0];
          if (base) setDisplayCurrencyId(base.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "تعذّر تحميل البيانات.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const postableAccounts = useMemo(
    () => accounts.filter((account) => account.is_postable && account.is_active),
    [accounts],
  );

  const selectedAccounts = useMemo(
    () =>
      accountIds
        .map((id) => postableAccounts.find((account) => account.id === id))
        .filter((account): account is Account => Boolean(account)),
    [postableAccounts, accountIds],
  );

  const displayCurrency = useMemo(
    () =>
      resolveDisplayCurrency(
        currencies,
        displayCurrencyId,
        selectedAccounts[0]?.currency_id,
      ),
    [currencies, displayCurrencyId, selectedAccounts],
  );

  const shareParams = useMemo(
    () =>
      buildAccountStatementShareParams({
        accountIds,
        fromDate,
        toDate,
        costCenterId,
        search,
        displayCurrencyId,
        onlyDisplayCurrency,
      }),
    [
      accountIds,
      fromDate,
      toDate,
      costCenterId,
      search,
      displayCurrencyId,
      onlyDisplayCurrency,
    ],
  );

  const shareHref = useMemo(
    () => buildUrlWithQuery("/reports/account-statement", shareParams),
    [shareParams],
  );

  const trialBalanceHref = useMemo(
    () =>
      buildUrlWithQuery("/reports/trial-balance", {
        accountId: accountIds[0] || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        costCenterId: costCenterId || undefined,
        currency: displayCurrencyId || undefined,
      }),
    [accountIds, fromDate, toDate, costCenterId, displayCurrencyId],
  );

  const onAccountsChange = (ids: string[]) => {
    setAccountIds(ids);
    syncUrl({ accountIds: ids });
  };

  const onDisplayCurrencyChange = (id: string) => {
    setDisplayCurrencyId(id);
    syncUrl({ displayCurrencyId: id });
  };

  const onOnlyDisplayCurrencyChange = (checked: boolean) => {
    setOnlyDisplayCurrency(checked);
    syncUrl({ onlyDisplayCurrency: checked });
  };

  const onPeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    syncUrl({ fromDate: from, toDate: to });
  };

  const onCostCenterChange = (id: string) => {
    setCostCenterId(id);
    syncUrl({ costCenterId: id });
  };

  const onSearchChange = (value: string) => {
    setSearch(value);
    syncUrl({ search: value });
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">كشف حساب</h1>
          <p className="mt-1 text-sm text-slate-600">
            اختر حساباً أو أكثر، وحدّد عملة العرض وفلاتر الفترة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accountIds.length > 0 && (
            <Link
              href={trialBalanceHref}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ميزان المراجعة
            </Link>
          )}
          {accountIds.length > 0 && (
            <OpenInNewTabLink
              href={shareHref}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ↗ نسخة في تبويب جديد
            </OpenInNewTabLink>
          )}
        </div>
      </div>

      <ReportsNav active="account-statement" />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && (
          <p className="text-sm text-slate-600">جاري تحميل البيانات...</p>
        )}
        {!isLoading && error && (
          <p className="text-sm text-rose-700">{error}</p>
        )}

        {!isLoading && !error && (
          <div className="grid gap-4">
            <AccountMultiSelectField
              accounts={postableAccounts}
              currencies={currencies}
              selectedIds={accountIds}
              onChange={onAccountsChange}
              placeholder="ابحث بالكود أو الاسم — حسابات مرحّلة فقط"
            />

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">عملة العرض</span>
                <select
                  value={displayCurrencyId}
                  onChange={(event) => onDisplayCurrencyChange(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  {currencies.map((currency) => (
                    <option key={currency.id} value={currency.id}>
                      {currency.code} — {currency.name_ar}
                      {currency.is_base ? " (أساسية)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  تُحوَّل المبالغ إلى هذه العملة عند الاختلاف.
                </p>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={onlyDisplayCurrency}
                  onChange={(event) =>
                    onOnlyDisplayCurrencyChange(event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-slate-800">
                    حركات العملة المحددة فقط
                  </span>
                  <span className="mt-1 block text-xs text-slate-600">
                    إخفاء حسابات وحركاتها إذا كانت عملة الحساب تختلف عن عملة
                    العرض.
                  </span>
                </span>
              </label>
            </div>

            {selectedAccounts.length > 0 && displayCurrency && (
              <div className="flex flex-wrap gap-2">
                {selectedAccounts.map((account) => (
                  <span
                    key={account.id}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                  >
                    {account.code} — {account.name_ar}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!isLoading && postableAccounts.length === 0 && !error && (
          <p className="mt-3 text-sm text-amber-800">
            لا توجد حسابات مرحّلة نشطة.{" "}
            <Link href="/accounts" className="underline">
              دليل الحسابات
            </Link>
          </p>
        )}
      </section>

      {!accountIds.length && !isLoading && (
        <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          اختر حساباً واحداً على الأقل لعرض كشف الحركات.
        </section>
      )}

      {accountIds.length > 0 && displayCurrency && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <AccountStatementSection
            accountIds={accountIds}
            displayCurrency={displayCurrency}
            onlyDisplayCurrency={onlyDisplayCurrency}
            initialFromDate={fromDate}
            initialToDate={toDate}
            initialCostCenterId={costCenterId}
            initialSearch={search}
            costCenters={costCenters}
            onPeriodChange={onPeriodChange}
            onCostCenterChange={onCostCenterChange}
            onSearchChange={onSearchChange}
            showCostCenterFilter
            fullHeight
          />
        </section>
      )}

      {accountIds.length > 0 && selectedAccounts.length === 0 && !isLoading && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          الحسابات المحددة في الرابط غير متاحة (قد تكون غير مرحّلة أو غير نشطة).
          اختر حسابات أخرى.
        </section>
      )}
    </main>
  );
}
