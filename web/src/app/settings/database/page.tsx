"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { SettingsNav } from "@/modules/settings/components/settings-nav";
import { setupApi } from "@/modules/setup/services/setup-api";
import type { SchemaSetupStatus } from "@/modules/setup/types";

export default function DatabaseSettingsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("settings.company.view");
  const [status, setStatus] = useState<SchemaSetupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const next = await setupApi.getSchemaSetupStatus();
      setStatus(next);
    } catch (err) {
      setStatus(null);
      setError(
        err instanceof Error ? err.message : "تعذّر تحميل معلومات قاعدة البيانات.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    void load();
  }, [canView, load]);

  if (!canView) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold text-[var(--brand-navy)]">
          قاعدة البيانات
        </h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          ليس لديك صلاحية عرض هذا القسم.
        </p>
      </main>
    );
  }

  const summary = status?.summary;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-navy)]">
            قاعدة البيانات
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            جاهزية المخطط وإحصاءات سريعة — مصدر التهيئة{" "}
            <code className="text-xs">setup_all.sql</code>.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={isLoading}
          onClick={() => void load()}
        >
          {isLoading ? "جاري التحديث…" : "تحديث"}
        </button>
      </div>

      <SettingsNav />

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {isLoading && !status && (
        <p className="text-sm text-slate-600">جاري تحميل حالة المخطط…</p>
      )}

      {status && (
        <>
          <section
            className={`rounded-xl border px-4 py-3 text-sm ${
              status.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            <p className="font-semibold">
              {status.ok ? "المخطط جاهز" : "المخطط غير مكتمل"}
            </p>
            <p className="mt-1">{status.message_ar}</p>
            <p className="mt-2 text-xs opacity-80">
              المصدر المتوقع: <code>{status.source}</code>
            </p>
          </section>

          {summary && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--brand-navy)]">
                معلومات عامة
              </h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <InfoRow
                  label="اسم الشركة"
                  value={summary.company_name_ar || "—"}
                />
                <InfoRow
                  label="إتمام ويزارد الإعداد"
                  value={summary.is_setup_complete ? "مكتمل" : "غير مكتمل"}
                />
                <InfoRow
                  label="جذور دليل الحسابات"
                  value={String(summary.root_accounts)}
                />
                <InfoRow label="الفروع" value={String(summary.branches)} />
                <InfoRow label="المستودعات" value={String(summary.warehouses)} />
                <InfoRow
                  label="العملات النشطة"
                  value={String(summary.currencies)}
                />
                <InfoRow label="المواد" value={String(summary.materials)} />
                <InfoRow
                  label="فواتير مرحّلة"
                  value={String(summary.posted_invoices)}
                />
                <InfoRow
                  label="حركات مخزون"
                  value={String(summary.inventory_movements)}
                />
              </dl>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--brand-navy)]">
              فحص المكوّنات
            </h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {status.checks.map((check) => (
                <li
                  key={check.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span>{check.label_ar}</span>
                  <span
                    className={
                      check.ok
                        ? "font-medium text-emerald-700"
                        : "font-medium text-[var(--danger)]"
                    }
                  >
                    {check.ok ? "جاهز" : "ناقص"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <h2 className="font-semibold text-[var(--brand-navy)]">
              في مرحلة البناء
            </h2>
            <ol className="mt-2 list-inside list-decimal space-y-1">
              <li>
                أعد توليد الملف:{" "}
                <code className="text-xs">
                  powershell -File database/build_setup_all.ps1
                </code>
              </li>
              <li>
                شغّل{" "}
                <code className="text-xs">database/setup_all.sql</code> في
                Supabase SQL Editor
              </li>
              <li>ارجع هنا واضغط «تحديث»</li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">
              على عميل حي لاحقاً استخدم ملفات <code>patch_*.sql</code> فقط — لا
              تعِد تشغيل <code>setup_all</code>.
            </p>
          </section>
        </>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/settings" className="text-[var(--brand-navy)] hover:underline">
          ← العودة إلى الإعدادات
        </Link>
        <Link
          href="/settings/about"
          className="text-[var(--brand-green)] hover:underline"
        >
          عن البرنامج
        </Link>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
    </div>
  );
}
