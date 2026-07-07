"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { LogoUploadField } from "@/components/logo-upload-field";
import { SettingsNav } from "@/modules/settings/components/settings-nav";
import { settingsApi } from "@/modules/settings/services/settings-api";
import type { CompanySettings, CompanySettingsFormValues } from "@/modules/settings/types";
import { FISCAL_MONTHS } from "@/modules/settings/types";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import type { Currency } from "@/modules/currencies/types";

export default function CompanySettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("settings.company.edit");
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<CompanySettingsFormValues>({
    legal_name_ar: "",
    legal_name_en: "",
    tax_number: "",
    address: "",
    phone: "",
    email: "",
    fiscal_year_start_month: 1,
    base_currency_id: "",
    logo_url: "",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [settingsData, currenciesData] = await Promise.all([
          settingsApi.getCompanySettings(),
          currencyApi.listActiveCurrencies(),
        ]);
        if (cancelled) return;
        setSettings(settingsData);
        setCurrencies(currenciesData);
        setForm({
          legal_name_ar: settingsData.legal_name_ar,
          legal_name_en: settingsData.legal_name_en ?? "",
          tax_number: settingsData.tax_number ?? "",
          address: settingsData.address ?? "",
          phone: settingsData.phone ?? "",
          email: settingsData.email ?? "",
          fiscal_year_start_month: settingsData.fiscal_year_start_month,
          base_currency_id: settingsData.base_currency_id ?? "",
          logo_url: settingsData.logo_url ?? "",
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الإعدادات.");
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

  const onLogoChange = async (nextLogoUrl: string | null) => {
    if (!canEdit) {
      setError("يتطلب صلاحية تعديل بيانات الشركة.");
      return;
    }

    setError("");
    setSuccess("");
    try {
      const updated = await settingsApi.updateCompanySettings({
        ...form,
        logo_url: nextLogoUrl ?? "",
      });
      setSettings(updated);
      setForm((current) => ({ ...current, logo_url: nextLogoUrl ?? "" }));
      setSuccess(nextLogoUrl ? "تم رفع الشعار." : "تم إزالة الشعار.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الشعار.");
      throw err;
    }
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit) {
      setError("يتطلب صلاحية تعديل بيانات الشركة.");
      return;
    }
    if (!form.legal_name_ar.trim()) {
      setError("الاسم القانوني بالعربية مطلوب.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await settingsApi.updateCompanySettings(form);
      setSettings(updated);
      setSuccess("تم حفظ إعدادات الشركة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحفظ.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">بيانات الشركة</h1>
        <p className="mt-1 text-sm text-slate-600">
          الإعدادات العامة التي تظهر في التقارير والمستندات.
        </p>
      </div>

      <SettingsNav />

      {!canEdit && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          العرض فقط — التعديل يتطلب صلاحية «تعديل بيانات الشركة».
        </p>
      )}

      {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}

      {!isLoading && (
        <form
          onSubmit={(event) => void onSave(event)}
          className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <LogoUploadField
            companyName={form.legal_name_ar || "شركتي"}
            logoUrl={form.logo_url || null}
            disabled={!canEdit || isSaving}
            onLogoChange={onLogoChange}
          />

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">الاسم القانوني (عربي) *</span>
            <input
              value={form.legal_name_ar}
              onChange={(event) =>
                setForm((current) => ({ ...current, legal_name_ar: event.target.value }))
              }
              disabled={!canEdit || isSaving}
              required
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">الاسم القانوني (إنجليزي)</span>
            <input
              value={form.legal_name_en}
              onChange={(event) =>
                setForm((current) => ({ ...current, legal_name_en: event.target.value }))
              }
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
              dir="ltr"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">الرقم الضريبي</span>
              <input
                value={form.tax_number}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tax_number: event.target.value }))
                }
                disabled={!canEdit || isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">الهاتف</span>
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                disabled={!canEdit || isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">العنوان</span>
            <textarea
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
              disabled={!canEdit || isSaving}
              rows={2}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">البريد الإلكتروني</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              disabled={!canEdit || isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
              dir="ltr"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">بداية السنة المالية</span>
              <select
                value={form.fiscal_year_start_month}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fiscal_year_start_month: Number(event.target.value),
                  }))
                }
                disabled={!canEdit || isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                {FISCAL_MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">العملة الأساسية للعرض</span>
              <select
                value={form.base_currency_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    base_currency_id: event.target.value,
                  }))
                }
                disabled={!canEdit || isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">افتراضي من جدول العملات</option>
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.code} — {currency.name_ar}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {settings?.updated_at && (
            <p className="text-xs text-slate-500">
              آخر تحديث: {new Date(settings.updated_at).toLocaleString("ar-IQ")}
            </p>
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

          {canEdit && (
            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary justify-self-start"
            >
              {isSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </button>
          )}
        </form>
      )}
    </main>
  );
}
