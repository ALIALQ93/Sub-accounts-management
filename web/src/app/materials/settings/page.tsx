"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { MaterialsNav } from "@/modules/materials/components/materials-nav";
import { inventorySettingsApi } from "@/modules/materials/services/inventory-settings-api";
import type {
  CompanyInventorySettings,
  InventorySettingsFormValues,
} from "@/modules/materials/types";

const INVENTORY_METHOD_LABELS = {
  periodic: "جرد دوري",
  perpetual: "جرد مستمر",
} as const;

const COSTING_METHOD_LABELS = {
  weighted_avg: "متوسط مرجح",
  // fifo: غير منفَّذ في محرك الترحيل بعد — لا يُعرض حتى يُنفَّذ فعلياً
  standard: "تكلفة معيارية",
  last_purchase: "آخر شراء",
} as const;

function toFormValues(settings: CompanyInventorySettings): InventorySettingsFormValues {
  return {
    inventory_method: settings.inventory_method ?? "",
    costing_method: settings.costing_method ?? "",
    cost_per_warehouse: settings.cost_per_warehouse,
    cost_per_cost_center: settings.cost_per_cost_center,
    cost_per_expiry_date: settings.cost_per_expiry_date ?? false,
    cost_per_serial_number: settings.cost_per_serial_number ?? false,
  };
}

export default function InventorySettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("materials.settings");
  const [settings, setSettings] = useState<CompanyInventorySettings | null>(null);
  const [values, setValues] = useState<InventorySettingsFormValues>({
    inventory_method: "",
    costing_method: "",
    cost_per_warehouse: false,
    cost_per_cost_center: false,
    cost_per_expiry_date: false,
    cost_per_serial_number: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    void inventorySettingsApi
      .getSettings()
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
          setValues(toFormValues(data));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الإعدادات.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const locked = settings?.foundation_locked ?? false;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || locked) return;

    if (!values.inventory_method || !values.costing_method) {
      setError("طريقة الجرد ونظام التكلفة مطلوبان.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await inventorySettingsApi.updateSettings(values);
      setSettings(updated);
      setValues(toFormValues(updated));
      setSuccess("تم حفظ إعدادات الجرد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الإعدادات.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">إعدادات الجرد والتكلفة</h1>
      <MaterialsNav />

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          تُختار قبل أول عملية مخزنية مرحّلة — تُقفَل تلقائياً بعد الترحيل الأول.
        </p>

        {locked && settings && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            الإعدادات <strong>مقفولة</strong> منذ{" "}
            {settings.foundation_locked_at
              ? new Date(settings.foundation_locked_at).toLocaleString("ar-IQ")
              : "—"}
            . لا يمكن تغيير طريقة الجرد أو التكلفة.
          </div>
        )}

        {isLoading && <p className="mt-4 text-sm text-slate-600">جاري التحميل...</p>}

        {!isLoading && (
          <form onSubmit={onSubmit} className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">طريقة الجرد *</span>
              <select
                value={values.inventory_method}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    inventory_method: event.target.value as InventorySettingsFormValues["inventory_method"],
                  }))
                }
                disabled={!canEdit || locked || isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              >
                <option value="">— اختر —</option>
                {Object.entries(INVENTORY_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                المستمر: قيد تكلفة فوري عند البيع. الدوري: تكلفة آخر الفترة.
              </span>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">نظام التكلفة *</span>
              <select
                value={values.costing_method}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    costing_method: event.target.value as InventorySettingsFormValues["costing_method"],
                  }))
                }
                disabled={!canEdit || locked || isSaving}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              >
                <option value="">— اختر —</option>
                {values.costing_method === "fifo" && (
                  <option value="fifo" disabled>
                    FIFO — غير متاح حالياً (محفوظ سابقاً)
                  </option>
                )}
                {Object.entries(COSTING_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {settings?.costing_method === "fifo" && (
                <span className="text-xs text-amber-700">
                  القيمة الحالية «FIFO» محفوظة لكن المحرك يطبّق متوسطاً مرجّحاً حتى
                  يُنفَّذ FIFO لاحقاً — لا تختر FIFO من جديد.
                </span>
              )}
              <span className="text-xs text-slate-500">
                يُقفَل بعد أول عملية مخزنية مرحّلة.
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.cost_per_warehouse}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    cost_per_warehouse: event.target.checked,
                  }))
                }
                disabled={!canEdit || locked || isSaving}
              />
              <span>فصل التكلفة لكل مستودع</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.cost_per_cost_center}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    cost_per_cost_center: event.target.checked,
                  }))
                }
                disabled={!canEdit || locked || isSaving}
              />
              <span>فصل التكلفة لكل مركز كلف</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.cost_per_expiry_date}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    cost_per_expiry_date: event.target.checked,
                  }))
                }
                disabled={!canEdit || locked || isSaving}
              />
              <span>فصل التكلفة على أساس تاريخ الصلاحية</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.cost_per_serial_number}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    cost_per_serial_number: event.target.checked,
                  }))
                }
                disabled={!canEdit || locked || isSaving}
              />
              <span>فصل التكلفة على أساس الرقم التسلسلي</span>
            </label>

            <p className="text-xs text-slate-500">
              فصل التكلفة بالصلاحية أو التسلسلي يتطلب تفعيل التتبع في بطاقة المادة
              وإظهاره في نمط الفاتورة. يُستخدم عند ترحيل الحركات المخزنية.
            </p>

            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            {success && (
              <p className="text-sm text-[var(--success)]">{success}</p>
            )}

            {canEdit && !locked && (
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary w-fit"
              >
                {isSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </button>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
