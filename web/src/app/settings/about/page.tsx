"use client";

import Link from "next/link";
import { AppBrandFooter } from "@/components/app-brand-footer";
import { AppBrandLogo } from "@/components/app-brand-logo";
import { APP_BRANDING } from "@/config/app-branding";
import { APP_RELEASE, formatDisplayVersion, getReleaseId } from "@/config/app-release";
import { SettingsNav } from "@/modules/settings/components/settings-nav";

export default function AboutPage() {
  const year = new Date().getFullYear();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-2 md:p-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--brand-navy)]">عن البرنامج</h1>
        <p className="mt-1 text-sm text-slate-600">
          معلومات المنتج والمطوّر والإصدار وملاحظات التحديث.
        </p>
      </div>

      <SettingsNav />

      <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white shadow-sm">
        <div className="bg-[var(--brand-navy)] px-6 py-8 text-center">
          <div className="mx-auto mb-4 inline-block rounded-xl bg-white/5 p-3">
            <AppBrandLogo variant="full" className="mx-auto max-w-[260px]" />
          </div>
          <h2 className="text-lg font-bold text-white">{APP_BRANDING.productNameAr}</h2>
          <p className="mt-1 text-sm text-white/70">{APP_BRANDING.productTaglineAr}</p>
          <p className="mt-3 font-mono text-sm text-[var(--brand-gold-light)]">
            {formatDisplayVersion()}
          </p>
          <p className="mt-1 font-mono text-xs text-white/50">{getReleaseId()}</p>
          {APP_RELEASE.phase === "trial" && (
            <span className="mt-3 inline-block rounded-full bg-amber-400/20 px-3 py-1 text-xs font-medium text-amber-100">
              {APP_RELEASE.labelAr} — {APP_RELEASE.releasedAt}
            </span>
          )}
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <article>
            <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
              تصميم وتطوير
            </h3>
            <p className="mt-2 font-medium text-[var(--brand-gold)]">
              {APP_BRANDING.developerNameEn}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {APP_BRANDING.developerTaglineAr}
            </p>
            <p className="mt-1 text-xs text-slate-400" dir="ltr">
              {APP_BRANDING.developerTaglineEn}
            </p>
          </article>

          <article>
            <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
              الوظائف الرئيسية
            </h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
              <li>دليل حسابات وشجرة محاسبية</li>
              <li>سندات قبض وصرف وتصفية</li>
              <li>عملاء وموردون مع ربط حسابات الذمم</li>
              <li>تقارير وميزان مراجعة وكشف حساب</li>
              <li>صلاحيات مستخدمين تفصيلية</li>
            </ul>
          </article>
        </div>

        <div className="border-t border-[var(--brand-border)] px-6 py-5">
          <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
            ما الجديد في هذا الإصدار
          </h3>
          <p className="mt-1 text-sm text-slate-600">{APP_RELEASE.summaryAr}</p>
          <ul className="mt-3 space-y-3">
            {APP_RELEASE.highlights.map((item) => (
              <li
                key={item.title}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <p className="font-medium text-slate-900">{item.title}</p>
                {item.details && (
                  <p className="mt-0.5 text-xs text-slate-600">{item.details}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {APP_RELEASE.phase === "trial" && (
          <div className="border-t border-amber-200 bg-amber-50 px-6 py-5">
            <h3 className="text-sm font-semibold text-amber-950">
              تنبيهات التجربة الأولى
            </h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900">
              {APP_RELEASE.trialWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-amber-800">
              إعداد قاعدة البيانات: راجع{" "}
              <code className="rounded bg-white/80 px-1 font-mono">
                database/TRIAL_SETUP.md
              </code>{" "}
              في المستودع.
            </p>
          </div>
        )}

        <div className="border-t border-[var(--brand-border)] bg-slate-50 px-6 py-4">
          <p className="text-xs text-slate-500">
            © {year} {APP_BRANDING.developerNameEn}. جميع الحقوق محفوظة.
          </p>
          {(APP_BRANDING.supportEmail || APP_BRANDING.supportPhone) && (
            <p className="mt-2 text-sm text-slate-600">
              الدعم:{" "}
              {APP_BRANDING.supportEmail && (
                <a
                  href={`mailto:${APP_BRANDING.supportEmail}`}
                  className="text-[var(--brand-navy)] hover:underline"
                  dir="ltr"
                >
                  {APP_BRANDING.supportEmail}
                </a>
              )}
              {APP_BRANDING.supportEmail && APP_BRANDING.supportPhone && " · "}
              {APP_BRANDING.supportPhone && (
                <span dir="ltr">{APP_BRANDING.supportPhone}</span>
              )}
            </p>
          )}
          <Link
            href="/settings"
            className="mt-3 inline-block text-sm text-[var(--brand-green)] hover:underline"
          >
            ← العودة إلى الإعدادات
          </Link>
        </div>
      </section>

      <AppBrandFooter />
    </main>
  );
}
