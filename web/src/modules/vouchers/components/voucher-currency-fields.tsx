"use client";

import Link from "next/link";
import type { Currency } from "@/modules/currencies/types";
import { getCurrencyById } from "@/modules/vouchers/utils/voucher-currency-utils";

interface VoucherCurrencyFieldsProps {
  currencies: Currency[];
  currencyId: string;
  exchangeRate: number;
  readOnly?: boolean;
  isSaving?: boolean;
  isLoadingRate?: boolean;
  onCurrencyChange: (currencyId: string) => void;
  onExchangeRateChange: (rate: number) => void;
  onRefreshRate?: () => void;
}

export function VoucherCurrencyFields({
  currencies,
  currencyId,
  exchangeRate,
  readOnly = false,
  isSaving = false,
  isLoadingRate = false,
  onCurrencyChange,
  onExchangeRateChange,
  onRefreshRate,
}: VoucherCurrencyFieldsProps) {
  const selectedCurrency = getCurrencyById(currencies, currencyId);
  const isBaseCurrency = selectedCurrency?.is_base ?? false;
  const baseCurrency = currencies.find((currency) => currency.is_base);

  return (
    <>
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
            عملة المبالغ في السند — قد تختلف عن عملة الحساب. من{" "}
            <Link href="/currencies" className="text-blue-800 underline">
              قسم العملات
            </Link>
            {selectedCurrency && (
              <>
                {" "}
                — {selectedCurrency.symbol} · {selectedCurrency.decimal_places}{" "}
                خانات عشرية
              </>
            )}
          </p>
        )}
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-medium text-slate-700">سعر الصرف</span>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            step="0.000001"
            value={exchangeRate || ""}
            onChange={(event) => onExchangeRateChange(Number(event.target.value))}
            disabled={readOnly || isSaving || isBaseCurrency || isLoadingRate}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono disabled:bg-slate-50"
          />
          {onRefreshRate && !readOnly && !isBaseCurrency && currencyId ? (
            <button
              type="button"
              onClick={onRefreshRate}
              disabled={isSaving || isLoadingRate}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="جلب السعر من سجل العملات بتاريخ السند"
            >
              {isLoadingRate ? "..." : "تحديث"}
            </button>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          {isBaseCurrency
            ? "العملة الأساسية — سعر الصرف ثابت = 1"
            : `سعر مقابل ${baseCurrency?.code ?? "العملة الأساسية"} بتاريخ السند — يُستخدم للتقارير والتحويل.`}
        </p>
      </label>
    </>
  );
}
