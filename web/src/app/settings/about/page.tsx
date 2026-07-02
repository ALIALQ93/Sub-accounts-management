"use client";

import Link from "next/link";
import { AppBrandFooter } from "@/components/app-brand-footer";
import { AppBrandLogo } from "@/components/app-brand-logo";
import { APP_BRANDING } from "@/config/app-branding";
import { SettingsNav } from "@/modules/settings/components/settings-nav";

export default function AboutPage() {
  const year = new Date().getFullYear();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-2 md:p-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--brand-navy)]">عن البرنامج</h1>
        <p className="mt-1 text-sm text-slate-600">
          معلومات المنتج والمطوّر والإصدار.
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
            الإصدار v{APP_BRANDING.version}
          </p>
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
