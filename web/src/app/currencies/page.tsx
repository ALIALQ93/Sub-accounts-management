"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import type { Currency, CurrencyRateHistoryEntry } from "@/modules/currencies/types";
import { getCurrencyRateChangeSourceLabel } from "@/modules/currencies/utils/currency-rate-history-labels";

export default function CurrenciesPage() {
  const { hasPermission } = useAuth();
  const canEditCurrency = hasPermission("currencies.edit");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rateHistory, setRateHistory] = useState<CurrencyRateHistoryEntry[]>([]);
  const [historyFilterCurrencyId, setHistoryFilterCurrencyId] = useState("");
  const [baseCurrencyLocked, setBaseCurrencyLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRateHistory = useCallback(async (currencyId?: string) => {
    const history = await currencyApi.listRateHistory({
      currencyId: currencyId || undefined,
      limit: 100,
    });
    setRateHistory(history);
  }, []);

  const loadCurrencies = async () => {
    const [data, locked] = await Promise.all([
      currencyApi.listCurrencies(),
      currencyApi.hasAccountingActivity(),
    ]);
    setCurrencies(data);
    setBaseCurrencyLocked(locked);
    await loadRateHistory(historyFilterCurrencyId || undefined);
    return data;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [data, locked, history] = await Promise.all([
          currencyApi.listCurrencies(),
          currencyApi.hasAccountingActivity(),
          currencyApi.listRateHistory({ limit: 100 }),
        ]);
        if (!cancelled) {
          setCurrencies(data);
          setBaseCurrencyLocked(locked);
          setRateHistory(history);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل العملات.");
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

  useEffect(() => {
    if (isLoading) return;
    void loadRateHistory(historyFilterCurrencyId || undefined).catch((err) => {
      setError(err instanceof Error ? err.message : "فشل تحميل السجل التاريخي.");
    });
  }, [historyFilterCurrencyId, isLoading, loadRateHistory]);

  const toggleActive = async (currency: Currency) => {
    if (currency.is_base) return;

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await currencyApi.updateCurrency(currency.id, {
        is_active: !currency.is_active,
      });
      await loadCurrencies();
      setSuccess("تم تحديث حالة العملة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحديث العملة.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveRate = async (
    currency: Currency,
    rateValue: string,
    effectiveFrom: string,
  ) => {
    if (currency.is_base) return;

    const exchange_rate = Number(rateValue);
    if (!Number.isFinite(exchange_rate) || exchange_rate <= 0) {
      setError("سعر الصرف يجب أن يكون رقمًا أكبر من صفر.");
      return;
    }
    if (!effectiveFrom) {
      setError("تاريخ السريان مطلوب.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await currencyApi.updateExchangeRate(
        currency.id,
        exchange_rate,
        effectiveFrom,
      );
      await loadCurrencies();
      setSuccess(`تم تحديث سعر ${currency.code} وتسجيله في السجل التاريخي.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحديث سعر الصرف.");
    } finally {
      setIsSaving(false);
    }
  };

  const setAsBase = async (currency: Currency) => {
    if (currency.is_base || baseCurrencyLocked) return;

    const confirmed = window.confirm(
      `تعيين ${currency.code} — ${currency.name_ar} كعملة أساسية؟\n\n` +
        "• سعر العملة الأساسية يصبح = 1\n" +
        "• تُعاد حسابة أسعار باقي العملات مقابلها\n" +
        "• تُفعَّل العملة تلقائياً إن كانت معطّلة\n" +
        "• يُسجَّل التغيير في السجل التاريخي\n\n" +
        "لا يمكن التراجع بعد ترحيل أول عملية محاسبية.",
    );
    if (!confirmed) return;

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await currencyApi.setBaseCurrency(currency.id);
      await loadCurrencies();
      setSuccess(`تم تعيين ${currency.code} كعملة أساسية وتسجيل الأسعار في السجل.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "فشل تعيين العملة الأساسية.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const baseCurrency = currencies.find((currency) => currency.is_base);
  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">العملات</h1>
        <p className="mt-1 text-sm text-slate-600">
          العملة الأساسية سعرها = 1. كل تعديل لسعر الصرف يُسجَّل تاريخياً
          بتاريخ سريان — للتقارير والسندات القديمة.
        </p>
      </section>

      {baseCurrency && (
        <section className="rounded-xl border border-[var(--brand-navy)]/20 bg-[var(--brand-navy)]/5 p-4 text-sm text-[var(--brand-navy)]">
          العملة الأساسية الحالية:{" "}
          <strong>
            {baseCurrency.code} — {baseCurrency.name_ar}
          </strong>
        </section>
      )}

      {baseCurrencyLocked ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">العملة الأساسية مقفلة</p>
          <p className="mt-1">
            وُجدت عمليات محاسبية مُرحّلة. لا يمكن تغيير العملة الأساسية —
            يمكنك تعديل أسعار الصرف وتُسجَّل في السجل التاريخي.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">يمكن تعيين العملة الأساسية</p>
          <p className="mt-1">
            لم تُرحَّل عمليات محاسبية بعد. اختر العملة المناسبة قبل البدء.
          </p>
        </section>
      )}

      {error && (
        <p className="rounded-md border border-[var(--danger)]/25 bg-[var(--danger)]/8 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-[var(--success)]/25 bg-[var(--success)]/8 px-3 py-2 text-sm text-[var(--success)]">
          {success}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}

        {!isLoading && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الاسم</th>
                  <th>الرمز</th>
                  <th>سعر مقابل الأساس</th>
                  <th>ساري من</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((currency) => (
                  <CurrencyRow
                    key={currency.id}
                    currency={currency}
                    defaultEffectiveFrom={today}
                    isSaving={isSaving}
                    baseCurrencyLocked={baseCurrencyLocked}
                    canEdit={canEditCurrency}
                    onToggleActive={toggleActive}
                    onSaveRate={saveRate}
                    onSetAsBase={setAsBase}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--brand-navy)]">السجل التاريخي للأسعار</h2>
            <p className="text-xs text-slate-500">
              كل تغيير لسعر الصرف أو للعملة الأساسية — مع السعر السابق والجديد.
            </p>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">فلتر العملة</span>
            <select
              value={historyFilterCurrencyId}
              onChange={(event) => setHistoryFilterCurrencyId(event.target.value)}
              className="min-w-[180px] rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">كل العملات</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} — {currency.name_ar}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-600">جاري التحميل...</p>
        ) : rateHistory.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد سجلات بعد.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[880px]">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>العملة</th>
                  <th>السعر السابق</th>
                  <th>السعر الجديد</th>
                  <th>المصدر</th>
                  <th>ملاحظة</th>
                  <th>وقت التسجيل</th>
                </tr>
              </thead>
              <tbody>
                {rateHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-mono tabular-nums">
                      {entry.effective_from}
                    </td>
                    <td>
                      <span className="font-mono">{entry.currency_code}</span>
                      <span className="mr-2 text-slate-600">{entry.currency_name_ar}</span>
                    </td>
                    <td className="font-mono tabular-nums">
                      {entry.previous_rate == null ? "—" : entry.previous_rate}
                    </td>
                    <td className="font-mono tabular-nums">
                      {entry.exchange_rate}
                    </td>
                    <td>
                      {getCurrencyRateChangeSourceLabel(entry.change_source)}
                    </td>
                    <td className="text-slate-600">
                      {entry.note ?? "—"}
                    </td>
                    <td className="font-mono text-xs text-slate-500">
                      {new Date(entry.created_at).toLocaleString("ar-IQ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function CurrencyRow({
  currency,
  defaultEffectiveFrom,
  isSaving,
  baseCurrencyLocked,
  canEdit,
  onToggleActive,
  onSaveRate,
  onSetAsBase,
}: {
  currency: Currency;
  defaultEffectiveFrom: string;
  isSaving: boolean;
  baseCurrencyLocked: boolean;
  canEdit: boolean;
  onToggleActive: (currency: Currency) => void;
  onSaveRate: (currency: Currency, rate: string, effectiveFrom: string) => void;
  onSetAsBase: (currency: Currency) => void;
}) {
  const [rate, setRate] = useState(String(currency.exchange_rate));
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffectiveFrom);

  return (
    <tr className="odd:bg-white even:bg-slate-50/60">
      <td className="border-b border-slate-100 p-2 font-mono">{currency.code}</td>
      <td className="border-b border-slate-100 p-2">
        {currency.name_ar}
        <span className="mr-2 text-xs text-slate-500" dir="ltr">
          {currency.name_en}
        </span>
      </td>
      <td className="border-b border-slate-100 p-2">{currency.symbol}</td>
      <td className="border-b border-slate-100 p-2">
        {currency.is_base ? (
          "1 (أساس)"
        ) : (
          <input
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            disabled={!canEdit || isSaving}
            className="w-28 rounded-md border border-slate-300 px-2 py-1 font-mono text-sm disabled:bg-slate-50"
            dir="ltr"
          />
        )}
      </td>
      <td className="border-b border-slate-100 p-2">
        {currency.is_base ? (
          "—"
        ) : (
          <input
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            disabled={!canEdit || isSaving}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
          />
        )}
      </td>
      <td className="border-b border-slate-100 p-2">
        {currency.is_base ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
            أساس
          </span>
        ) : currency.is_active ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
            مفعّلة
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            غير مفعّلة
          </span>
        )}
      </td>
      <td className="border-b border-slate-100 p-2">
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {!currency.is_base && !baseCurrencyLocked && (
              <button
                type="button"
                onClick={() => onSetAsBase(currency)}
                disabled={isSaving}
                className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-800 disabled:opacity-50"
              >
                تعيين كأساس
              </button>
            )}
            {!currency.is_base && (
              <>
                <button
                  type="button"
                  onClick={() => onSaveRate(currency, rate, effectiveFrom)}
                  disabled={isSaving}
                  className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-50"
                >
                  حفظ السعر
                </button>
                <button
                  type="button"
                  onClick={() => onToggleActive(currency)}
                  disabled={isSaving}
                  className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50"
                >
                  {currency.is_active ? "تعطيل" : "تفعيل"}
                </button>
              </>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-500">عرض فقط</span>
        )}
      </td>
    </tr>
  );
}
