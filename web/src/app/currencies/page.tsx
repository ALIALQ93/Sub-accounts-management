"use client";

import { useEffect, useState } from "react";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import type { Currency } from "@/modules/currencies/types";

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCurrencies = async () => {
    const data = await currencyApi.listCurrencies();
    setCurrencies(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await currencyApi.listCurrencies();
        if (!cancelled) setCurrencies(data);
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

  const saveRate = async (currency: Currency, rateValue: string) => {
    if (currency.is_base) return;

    const exchange_rate = Number(rateValue);
    if (!Number.isFinite(exchange_rate) || exchange_rate <= 0) {
      setError("سعر الصرف يجب أن يكون رقمًا أكبر من صفر.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await currencyApi.updateCurrency(currency.id, { exchange_rate });
      await loadCurrencies();
      setSuccess(`تم تحديث سعر ${currency.code}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحديث سعر الصرف.");
    } finally {
      setIsSaving(false);
    }
  };

  const baseCurrency = currencies.find((currency) => currency.is_base);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <section>
        <h1 className="text-2xl font-bold text-slate-900">العملات</h1>
        <p className="mt-1 text-sm text-slate-600">
          العملة الأساسية سعرها = 1. باقي العملات تُنسب إليها. فعّل ما تحتاجه
          فقط.
        </p>
      </section>

      {baseCurrency && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          العملة الأساسية الحالية:{" "}
          <strong>
            {baseCurrency.code} — {baseCurrency.name_ar}
          </strong>
        </section>
      )}

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}

        {!isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">الكود</th>
                  <th className="border-b border-slate-200 p-2">الاسم</th>
                  <th className="border-b border-slate-200 p-2">الرمز</th>
                  <th className="border-b border-slate-200 p-2">سعر مقابل الأساس</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  <th className="border-b border-slate-200 p-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((currency) => (
                  <CurrencyRow
                    key={currency.id}
                    currency={currency}
                    isSaving={isSaving}
                    onToggleActive={toggleActive}
                    onSaveRate={saveRate}
                  />
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
  isSaving,
  onToggleActive,
  onSaveRate,
}: {
  currency: Currency;
  isSaving: boolean;
  onToggleActive: (currency: Currency) => void;
  onSaveRate: (currency: Currency, rate: string) => void;
}) {
  const [rate, setRate] = useState(String(currency.exchange_rate));

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
            className="w-28 rounded-md border border-slate-300 px-2 py-1 font-mono text-sm"
            dir="ltr"
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
        <div className="flex flex-wrap gap-2">
          {!currency.is_base && (
            <>
              <button
                type="button"
                onClick={() => onSaveRate(currency, rate)}
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
      </td>
    </tr>
  );
}
