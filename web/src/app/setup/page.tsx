"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { APP_BRANDING } from "@/config/app-branding";
import { useAuth } from "@/modules/auth/auth-context";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import type { Currency } from "@/modules/currencies/types";
import { FISCAL_MONTHS } from "@/modules/settings/types";
import { setupApi, emptyWizardState } from "@/modules/setup/services/setup-api";
import {
  SETUP_STEPS,
  type SetupStepId,
  type SetupWizardState,
} from "@/modules/setup/types";

const INVENTORY_METHOD_LABELS = {
  periodic: "جرد دوري",
  perpetual: "جرد مستمر",
} as const;

const COSTING_METHOD_LABELS = {
  weighted_avg: "متوسط مرجح",
  standard: "تكلفة معيارية",
} as const;

export default function SetupWizardPage() {
  const router = useRouter();
  const { profile, isLoading: authLoading } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<SetupWizardState>(emptyWizardState);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const step = SETUP_STEPS[stepIndex];
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const complete = await setupApi.getSetupFlag();
        if (cancelled) return;
        if (complete) {
          router.replace("/");
          return;
        }

        const [wizard, currencyRows] = await Promise.all([
          setupApi.loadWizardState(),
          currencyApi.listActiveCurrencies(),
        ]);
        if (cancelled) return;

        if (!wizard.company.base_currency_id) {
          const base = currencyRows.find((row) => row.is_base) ?? currencyRows[0];
          if (base) {
            wizard.company.base_currency_id = base.id;
          }
        }

        setState(wizard);
        setCurrencies(currencyRows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل معالج الإعداد.");
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const progressLabel = useMemo(
    () => `الخطوة ${stepIndex + 1} من ${SETUP_STEPS.length}`,
    [stepIndex],
  );

  const goNext = () => {
    setError("");
    setStepIndex((current) => Math.min(current + 1, SETUP_STEPS.length - 1));
  };

  const goBack = () => {
    setError("");
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const onSaveStep = async () => {
    if (!isAdmin) {
      setError("يتطلب حساب مدير النظام لإكمال الإعداد.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      switch (step.id as SetupStepId) {
        case "company": {
          if (!state.company.legal_name_ar.trim()) {
            throw new Error("اسم الشركة بالعربية مطلوب.");
          }
          if (!state.company.base_currency_id) {
            throw new Error("العملة الأساسية مطلوبة.");
          }
          await setupApi.saveCompany(state.company);
          goNext();
          break;
        }
        case "admin": {
          if (!profile?.id) {
            throw new Error("تعذّر تحديد حساب المدير الحالي.");
          }
          await setupApi.saveAdmin(profile.id, state.admin);
          goNext();
          break;
        }
        case "branch": {
          const ids = await setupApi.saveBranchAndWarehouse(
            state.branchId,
            state.warehouseId,
            state.branch,
          );
          setState((current) => ({
            ...current,
            branchId: ids.branchId,
            warehouseId: ids.warehouseId,
          }));
          goNext();
          break;
        }
        case "accounts": {
          if (!state.accountsAccepted) {
            throw new Error("يجب قبول دليل الحسابات الافتراضي للمتابعة.");
          }
          goNext();
          break;
        }
        case "inventory": {
          await setupApi.saveInventory(state.inventory);
          goNext();
          break;
        }
        case "opening": {
          goNext();
          break;
        }
        case "finish": {
          if (!state.company.legal_name_ar.trim()) {
            throw new Error("أكمل بيانات الشركة أولاً.");
          }
          if (!state.inventory.inventory_method || !state.inventory.costing_method) {
            throw new Error("أكمل إعدادات المخزون أولاً.");
          }
          await setupApi.completeSetup();
          router.replace("/");
          router.refresh();
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الخطوة.");
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isBootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#e8eef5] via-[var(--background)] to-[#d4e2f0] p-4">
        <p className="text-sm text-slate-600">جاري تحضير معالج الإعداد...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#e8eef5] via-[var(--background)] to-[#d4e2f0] px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--brand-gold)]">
            {APP_BRANDING.productNameAr}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--brand-navy)]">
            معالج الإعداد الأولي
          </h1>
          <p className="mt-1 text-sm text-slate-600">{progressLabel}</p>
        </header>

        <ol className="mb-6 flex flex-wrap justify-center gap-2">
          {SETUP_STEPS.map((item, index) => {
            const active = index === stepIndex;
            const done = index < stepIndex;
            return (
              <li
                key={item.id}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-[var(--brand-navy)] text-white"
                    : done
                      ? "bg-[var(--brand-gold)]/20 text-[var(--brand-navy)]"
                      : "bg-white/80 text-slate-500"
                }`}
              >
                {index + 1}. {item.title}
              </li>
            );
          })}
        </ol>

        <section className="rounded-2xl border border-[var(--brand-border)] bg-white p-6 shadow-lg shadow-[var(--brand-navy)]/5">
          <h2 className="text-lg font-semibold text-[var(--brand-navy)]">{step.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{step.description}</p>

          {!isAdmin && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              يجب أن يكمل مدير النظام هذا المعالج. حسابك الحالي ليس مديراً.
            </div>
          )}

          <div className="mt-5 grid gap-4">
            {step.id === "company" && (
              <>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">اسم الشركة (عربي) *</span>
                  <input
                    value={state.company.legal_name_ar}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        company: {
                          ...current.company,
                          legal_name_ar: event.target.value,
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">الاسم الإنجليزي</span>
                  <input
                    value={state.company.legal_name_en}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        company: {
                          ...current.company,
                          legal_name_en: event.target.value,
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                    dir="ltr"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">العملة الأساسية *</span>
                    <select
                      value={state.company.base_currency_id}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          company: {
                            ...current.company,
                            base_currency_id: event.target.value,
                          },
                        }))
                      }
                      className="rounded-md border border-slate-300 px-3 py-2"
                      disabled={!isAdmin || isSaving}
                    >
                      <option value="">— اختر —</option>
                      {currencies.map((currency) => (
                        <option key={currency.id} value={currency.id}>
                          {currency.code} — {currency.name_ar}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">بداية السنة المالية</span>
                    <select
                      value={state.company.fiscal_year_start_month}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          company: {
                            ...current.company,
                            fiscal_year_start_month: Number(event.target.value),
                          },
                        }))
                      }
                      className="rounded-md border border-slate-300 px-3 py-2"
                      disabled={!isAdmin || isSaving}
                    >
                      {FISCAL_MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">الهاتف</span>
                  <input
                    value={state.company.phone}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        company: { ...current.company, phone: event.target.value },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                    dir="ltr"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">العنوان</span>
                  <textarea
                    value={state.company.address}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        company: {
                          ...current.company,
                          address: event.target.value,
                        },
                      }))
                    }
                    className="min-h-20 rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                  />
                </label>
              </>
            )}

            {step.id === "admin" && (
              <>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">البريد</span>
                  <input
                    value={state.adminEmail || profile?.email || ""}
                    readOnly
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
                    dir="ltr"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">الاسم بالعربية *</span>
                  <input
                    value={state.admin.full_name_ar}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        admin: {
                          ...current.admin,
                          full_name_ar: event.target.value,
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">الاسم بالإنجليزية</span>
                  <input
                    value={state.admin.full_name_en}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        admin: {
                          ...current.admin,
                          full_name_en: event.target.value,
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                    dir="ltr"
                  />
                </label>
                <p className="text-xs text-slate-500">
                  أُنشئ الحساب من لوحة Supabase Auth. أول مستخدم يصبح مديراً تلقائياً.
                </p>
              </>
            )}

            {step.id === "branch" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">رمز الفرع *</span>
                  <input
                    value={state.branch.branch_code}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        branch: {
                          ...current.branch,
                          branch_code: event.target.value,
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                    dir="ltr"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">اسم الفرع *</span>
                  <input
                    value={state.branch.branch_name_ar}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        branch: {
                          ...current.branch,
                          branch_name_ar: event.target.value,
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">رمز المستودع *</span>
                  <input
                    value={state.branch.warehouse_code}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        branch: {
                          ...current.branch,
                          warehouse_code: event.target.value,
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                    dir="ltr"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">اسم المستودع *</span>
                  <input
                    value={state.branch.warehouse_name_ar}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        branch: {
                          ...current.branch,
                          warehouse_name_ar: event.target.value,
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                  />
                </label>
              </div>
            )}

            {step.id === "accounts" && (
              <>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {state.rootAccounts.map((account) => (
                    <li
                      key={account.account_code}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-[var(--brand-navy)]">
                        {account.name_ar}
                      </span>
                      <span className="font-mono text-slate-500" dir="ltr">
                        {account.account_code}
                      </span>
                    </li>
                  ))}
                </ul>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.accountsAccepted}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        accountsAccepted: event.target.checked,
                      }))
                    }
                    disabled={!isAdmin || isSaving}
                    className="mt-1"
                  />
                  <span>
                    أقبل دليل الحسابات الافتراضي (يمكن إضافة حسابات فرعية لاحقاً من
                    شاشة الحسابات).
                  </span>
                </label>
              </>
            )}

            {step.id === "inventory" && (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  بعد أول حركة مخزنية أو فاتورة مرحّلة تُقفل طريقة الجرد ونظام التكلفة
                  تلقائياً ولا يمكن تغييرهما من الواجهة.
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">طريقة الجرد *</span>
                  <select
                    value={state.inventory.inventory_method}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        inventory: {
                          ...current.inventory,
                          inventory_method: event.target
                            .value as SetupWizardState["inventory"]["inventory_method"],
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
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
                    value={state.inventory.costing_method}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        inventory: {
                          ...current.inventory,
                          costing_method: event.target
                            .value as SetupWizardState["inventory"]["costing_method"],
                        },
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2"
                    disabled={!isAdmin || isSaving}
                  >
                    <option value="">— اختر —</option>
                    {Object.entries(COSTING_METHOD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.inventory.cost_per_warehouse}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        inventory: {
                          ...current.inventory,
                          cost_per_warehouse: event.target.checked,
                        },
                      }))
                    }
                    disabled={!isAdmin || isSaving}
                  />
                  تكلفة مختلفة لكل مستودع
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.inventory.cost_per_cost_center}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        inventory: {
                          ...current.inventory,
                          cost_per_cost_center: event.target.checked,
                        },
                      }))
                    }
                    disabled={!isAdmin || isSaving}
                  />
                  تكلفة مختلفة لكل مركز كلفة
                </label>
              </>
            )}

            {step.id === "opening" && (
              <div className="grid gap-3 text-sm text-slate-700">
                <p>
                  القيد الافتتاحي وبضاعة أول المدة اختياريان في هذه المرحلة ويمكن
                  إكمالهما لاحقاً من الشاشات العادية.
                </p>
                <Link
                  href="/vouchers/opening-entry"
                  className="w-fit text-[var(--brand-navy)] underline-offset-2 hover:underline"
                  onClick={(event) => {
                    // لا نغادر الويزارد قبل الإتمام — الرابط للمعرفة فقط بعد الإكمال
                    event.preventDefault();
                    setError(
                      "أكمل المعالج أولاً، ثم افتح القيد الافتتاحي من قائمة السندات.",
                    );
                  }}
                >
                  مسار لاحق: سندات → قيد افتتاحي
                </Link>
                <p className="text-xs text-slate-500">اضغط «متابعة» لتخطي هذه الخطوة.</p>
              </div>
            )}

            {step.id === "finish" && (
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p>
                  <span className="text-slate-500">الشركة:</span>{" "}
                  <strong>{state.company.legal_name_ar || "—"}</strong>
                </p>
                <p>
                  <span className="text-slate-500">المدير:</span>{" "}
                  <strong>{state.admin.full_name_ar || "—"}</strong>
                </p>
                <p>
                  <span className="text-slate-500">الفرع / المستودع:</span>{" "}
                  <strong>
                    {state.branch.branch_name_ar} / {state.branch.warehouse_name_ar}
                  </strong>
                </p>
                <p>
                  <span className="text-slate-500">الجرد / التكلفة:</span>{" "}
                  <strong>
                    {state.inventory.inventory_method
                      ? INVENTORY_METHOD_LABELS[
                          state.inventory.inventory_method as keyof typeof INVENTORY_METHOD_LABELS
                        ]
                      : "—"}
                    {" / "}
                    {state.inventory.costing_method
                      ? COSTING_METHOD_LABELS[
                          state.inventory.costing_method as keyof typeof COSTING_METHOD_LABELS
                        ]
                      : "—"}
                  </strong>
                </p>
                <p className="text-xs text-slate-500">
                  بعد التأكيد لن يُعاد فتح المعالج تلقائياً.
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0 || isSaving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              رجوع
            </button>
            <button
              type="button"
              onClick={() => void onSaveStep()}
              disabled={!isAdmin || isSaving}
              className="rounded-lg bg-[var(--brand-navy)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-navy-light)] disabled:opacity-60"
            >
              {isSaving
                ? "جاري الحفظ..."
                : step.id === "finish"
                  ? "إتمام الإعداد"
                  : step.id === "opening"
                    ? "متابعة"
                    : "حفظ ومتابعة"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
