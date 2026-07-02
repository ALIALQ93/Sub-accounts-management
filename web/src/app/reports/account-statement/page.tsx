"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildUrlWithQuery,
  OpenInNewTabLink,
} from "@/components/open-in-new-tab-link";
import { AccountStatementSection } from "@/modules/accounts/components/account-statement-section";
import { ReportsNav } from "@/modules/reports/components/reports-nav";
import {
  buildAccountStatementShareParams,
  parseAccountStatementShareParams,
} from "@/modules/reports/utils/account-statement-utils";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
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
  const [accountId, setAccountId] = useState(initial.accountId);
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [costCenterId, setCostCenterId] = useState(initial.costCenterId);
  const [search, setSearch] = useState(initial.search);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const syncUrl = useCallback(
    (
      overrides?: Partial<
        ReturnType<typeof buildAccountStatementShareParams>
      >,
    ) => {
      const params = buildAccountStatementShareParams({
        accountId,
        fromDate,
        toDate,
        costCenterId,
        search,
        ...overrides,
      });
      const nextUrl = buildUrlWithQuery("/reports/account-statement", params);
      window.history.replaceState(null, "", nextUrl);
    },
    [accountId, fromDate, toDate, costCenterId, search],
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

  const selectedAccount = useMemo(
    () => postableAccounts.find((account) => account.id === accountId) ?? null,
    [postableAccounts, accountId],
  );

  const selectedCurrency = useMemo(() => {
    if (!selectedAccount?.currency_id) return undefined;
    return currencies.find((currency) => currency.id === selectedAccount.currency_id);
  }, [currencies, selectedAccount]);

  const shareParams = useMemo(
    () =>
      buildAccountStatementShareParams({
        accountId,
        fromDate,
        toDate,
        costCenterId,
        search,
      }),
    [accountId, fromDate, toDate, costCenterId, search],
  );

  const shareHref = useMemo(
    () => buildUrlWithQuery("/reports/account-statement", shareParams),
    [shareParams],
  );

  const trialBalanceHref = useMemo(
    () =>
      buildUrlWithQuery("/reports/trial-balance", {
        accountId: accountId || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        costCenterId: costCenterId || undefined,
      }),
    [accountId, fromDate, toDate, costCenterId],
  );

  const onAccountChange = (id: string) => {
    setAccountId(id);
    syncUrl({ accountId: id });
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
            اختر حساباً مرحّلاً لعرض حركاته — بدون المرور بدليل الحسابات.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accountId && (
            <Link
              href={trialBalanceHref}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ميزان المراجعة
            </Link>
          )}
          {accountId && (
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
          <p className="text-sm text-slate-600">جاري تحميل الحسابات...</p>
        )}
        {!isLoading && error && (
          <p className="text-sm text-rose-700">{error}</p>
        )}

        {!isLoading && !error && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_auto] md:items-end">
            <AccountSearchField
              label="الحساب"
              accounts={postableAccounts}
              currencies={currencies}
              value={accountId}
              onChange={(id) => onAccountChange(id)}
              placeholder="ابحث بالكود أو الاسم — حسابات مرحّلة فقط"
              required
            />
            {selectedAccount && selectedCurrency && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="font-mono text-xs text-slate-500">
                  {selectedAccount.code}
                </p>
                <p className="font-semibold text-slate-900">
                  {selectedAccount.name_ar}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {selectedCurrency.code} · {selectedCurrency.symbol}
                </p>
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

      {!accountId && !isLoading && (
        <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          اختر حساباً من القائمة أعلاه لعرض كشف الحركات.
        </section>
      )}

      {selectedAccount && selectedCurrency && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <AccountStatementSection
            accountId={selectedAccount.id}
            decimalPlaces={selectedCurrency.decimal_places}
            currencySymbol={selectedCurrency.symbol}
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

      {accountId && !selectedAccount && !isLoading && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          الحساب المحدد في الرابط غير متاح (قد يكون غير مرحّل أو غير نشط).
          اختر حساباً آخر.
        </section>
      )}
    </main>
  );
}
