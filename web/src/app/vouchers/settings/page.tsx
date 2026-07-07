"use client";

import { useEffect, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { useAuth } from "@/modules/auth/auth-context";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { CostCenterSearchField } from "@/modules/vouchers/components/cost-center-search-field";
import { VoucherSettingsNav } from "@/modules/vouchers/components/voucher-settings-nav";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, VoucherTypeDefaults } from "@/modules/vouchers/types";
import type { VoucherNumberSequence, VoucherSettings } from "@/modules/vouchers/types/voucher-settings";
import type { VoucherType } from "@/modules/vouchers/types";
import {
  getVoucherTypeLabel,
  VOUCHER_TYPES,
} from "@/modules/vouchers/utils/voucher-type-config";
import { formatVoucherNo, computeNextSequencePreview } from "@/modules/vouchers/utils/format-voucher-no";
import type { Currency } from "@/modules/currencies/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import type { CostCenter } from "@/modules/vouchers/types";

export default function VoucherSettingsPage() {
  const { hasPermission } = useAuth();
  const formDisabled = !hasPermission("vouchers.settings");
  const [settings, setSettings] = useState<VoucherSettings>({
    auto_number_enabled: true,
    allow_manual_override: false,
  });
  const [sequences, setSequences] = useState<VoucherNumberSequence[]>([]);
  const [typeDefaults, setTypeDefaults] = useState<VoucherTypeDefaults[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [previews, setPreviews] = useState<Record<VoucherType, string>>({
    receipt: "",
    payment: "",
    settlement: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [settingsData, sequencesData, defaultsData, accountsData, currenciesData, centersData] =
          await Promise.all([
          voucherApi.getVoucherSettings(),
          voucherApi.listVoucherNumberSequences(),
          voucherApi.listVoucherTypeDefaults(),
          voucherApi.listAccounts(),
          currencyApi.listActiveCurrencies(),
          voucherApi.listCostCenters(),
        ]);
        if (cancelled) return;
        setSettings(settingsData);
        setSequences(sequencesData);
        setTypeDefaults(defaultsData);
        setAccounts(accountsData);
        setCurrencies(currenciesData);
        setCostCenters(centersData);

        const nextPreviews = {} as Record<VoucherType, string>;
        for (const type of VOUCHER_TYPES) {
          const row = sequencesData.find((item) => item.voucher_type === type);
          if (row) {
            const year = new Date().getFullYear();
            const next = computeNextSequencePreview(
              row.last_number,
              row.sequence_year,
              row.include_year,
              year,
            );
            nextPreviews[type] = formatVoucherNo(
              row.prefix,
              row.include_year,
              year,
              next,
              row.padding,
            );
          } else {
            nextPreviews[type] = await voucherApi.peekVoucherNo(type);
          }
        }
        setPreviews(nextPreviews);
      } catch (err) {
        if (!cancelled) {
          setFeedback(
            err instanceof Error ? err.message : "تعذّر تحميل إعدادات السندات.",
          );
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

  const updateSequence = (
    type: VoucherType,
    field: keyof Pick<VoucherNumberSequence, "prefix" | "padding" | "include_year">,
    value: string | number | boolean,
  ) => {
    setSequences((current) =>
      current.map((row) =>
        row.voucher_type === type ? { ...row, [field]: value } : row,
      ),
    );
  };

  const updateTypeDefault = (
    type: VoucherType,
    field: keyof Omit<VoucherTypeDefaults, "voucher_type">,
    value: string | null | boolean,
  ) => {
    setTypeDefaults((current) =>
      current.map((row) =>
        row.voucher_type === type ? { ...row, [field]: value } : row,
      ),
    );
  };

  const onSave = async () => {
    setIsSaving(true);
    setFeedback("");
    try {
      await voucherApi.updateVoucherSettings(settings);
      for (const row of sequences) {
        await voucherApi.updateVoucherNumberSequence(row.voucher_type, {
          prefix: row.prefix,
          padding: row.padding,
          include_year: row.include_year,
        });
      }
      for (const row of typeDefaults) {
        await voucherApi.updateVoucherTypeDefaults(row.voucher_type, {
          default_account_id: row.default_account_id,
          default_currency_id: row.default_currency_id,
          default_cost_center_id: row.default_cost_center_id,
          auto_post_enabled: row.auto_post_enabled,
        });
      }
      setFeedback("تم حفظ إعدادات السندات.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "فشل حفظ الإعدادات.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section>
        <h1 className="text-xl font-bold tracking-tight text-[var(--brand-navy)]">إعدادات السندات</h1>
        <p className="text-xs text-slate-600">
          الترقيم التلقائي وبادئات كل نوع سند.
        </p>
      </section>

      <VouchersNav />
      <VoucherSettingsNav />

      {isLoading && (
        <p className="text-sm text-slate-600">جاري تحميل الإعدادات...</p>
      )}

      {!isLoading && (
        <>
          {formDisabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              عرض فقط — التعديل يتطلب صلاحية «إعدادات السندات والترقيم».
            </p>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-[var(--brand-navy)]">
              الترقيم العام
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.auto_number_enabled}
                  disabled={formDisabled || isSaving}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      auto_number_enabled: event.target.checked,
                    }))
                  }
                />
                تفعيل الترقيم التلقائي
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.allow_manual_override}
                  disabled={formDisabled || isSaving}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      allow_manual_override: event.target.checked,
                    }))
                  }
                />
                السماح بتعديل الرقم يدوياً
              </label>
            </div>
          </section>

          <section className="grid gap-4">
            <h2 className="text-base font-semibold text-[var(--brand-navy)]">
              الافتراضيات لكل نوع سند
            </h2>
            {typeDefaults.map((row) => (
              <article
                key={row.voucher_type}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="mb-3 font-semibold text-[var(--brand-navy)]">
                  {getVoucherTypeLabel(row.voucher_type)}
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <AccountSearchField
                    label={
                      row.voucher_type === "settlement"
                        ? "الحساب الوسيط (تصفية)"
                        : row.voucher_type === "receipt"
                          ? "حساب القبض الافتراضي"
                          : row.voucher_type === "payment"
                            ? "حساب الدفع الافتراضي"
                            : "الحساب الافتراضي"
                    }
                    accounts={accounts}
                    value={row.default_account_id ?? ""}
                    onChange={(id) =>
                      updateTypeDefault(row.voucher_type, "default_account_id", id || null)
                    }
                    disabled={formDisabled || isSaving}
                  />
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">العملة الافتراضية</span>
                    <select
                      value={row.default_currency_id ?? ""}
                      disabled={formDisabled || isSaving}
                      onChange={(event) =>
                        updateTypeDefault(
                          row.voucher_type,
                          "default_currency_id",
                          event.target.value || null,
                        )
                      }
                      className="rounded-md border border-slate-300 px-3 py-2"
                    >
                      <option value="">—</option>
                      {currencies.map((currency) => (
                        <option key={currency.id} value={currency.id}>
                          {currency.code} — {currency.name_ar}
                        </option>
                      ))}
                    </select>
                  </label>
                  <CostCenterSearchField
                    costCenters={costCenters}
                    value={row.default_cost_center_id ?? ""}
                    onChange={(id) =>
                      updateTypeDefault(
                        row.voucher_type,
                        "default_cost_center_id",
                        id || null,
                      )
                    }
                    disabled={formDisabled || isSaving}
                  />
                </div>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.auto_post_enabled}
                    disabled={formDisabled || isSaving}
                    onChange={(event) =>
                      updateTypeDefault(
                        row.voucher_type,
                        "auto_post_enabled",
                        event.target.checked,
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-800">ترحيل تلقائي عند الاعتماد</span>
                    <span className="mt-0.5 block text-xs text-slate-600">
                      عند التفعيل، زر «اعتماد» يُرحّل السند مباشرة إلى قيد اليومية (يتطلب صلاحية
                      الترحيل).
                    </span>
                  </span>
                </label>
              </article>
            ))}
          </section>

          <section className="grid gap-4">
            <h2 className="text-base font-semibold text-[var(--brand-navy)]">
              ترقيم كل نوع سند
            </h2>
            {sequences.map((row) => (
              <article
                key={row.voucher_type}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-[var(--brand-navy)]">
                    {getVoucherTypeLabel(row.voucher_type)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    الرقم التالي:{" "}
                    <span className="font-mono font-medium tabular-nums text-[var(--brand-navy)]">
                      {previews[row.voucher_type] || "—"}
                    </span>
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="grid gap-1 text-sm">
                    <span>البادئة</span>
                    <input
                      value={row.prefix}
                      disabled={formDisabled || isSaving}
                      onChange={(event) =>
                        updateSequence(row.voucher_type, "prefix", event.target.value)
                      }
                      className="rounded-md border border-slate-300 px-3 py-2 font-mono uppercase"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>عدد الخانات</span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={row.padding}
                      disabled={formDisabled || isSaving}
                      onChange={(event) =>
                        updateSequence(
                          row.voucher_type,
                          "padding",
                          Number(event.target.value),
                        )
                      }
                      className="rounded-md border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.include_year}
                      disabled={formDisabled || isSaving}
                      onChange={(event) =>
                        updateSequence(
                          row.voucher_type,
                          "include_year",
                          event.target.checked,
                        )
                      }
                    />
                    تضمين السنة
                  </label>
                  <div className="text-sm text-slate-600">
                    <p className="tabular-nums">آخر رقم: {row.last_number}</p>
                    <p className="tabular-nums">سنة التسلسل: {row.sequence_year}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <div className="flex flex-wrap gap-2">
            <PermissionGate permission="vouchers.settings">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={isSaving}
                className="btn btn-primary"
              >
                حفظ الإعدادات
              </button>
            </PermissionGate>
          </div>

          <p className="text-xs text-slate-500">
            شغّل في Supabase:{" "}
            <span className="font-mono">database/setup_all.sql</span>
          </p>
        </>
      )}

      {feedback && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {feedback}
        </p>
      )}
    </main>
  );
}
