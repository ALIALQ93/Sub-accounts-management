"use client";

import { Suspense, useEffect, useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { DeveloperCredit } from "@/components/developer-credit";
import { APP_BRANDING } from "@/config/app-branding";
import { settingsApi } from "@/modules/settings/services/settings-api";
import { LoginForm } from "@/app/login/login-form";

function LoginHeader() {
  const [companyName, setCompanyName] = useState<string>(APP_BRANDING.productNameAr);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void settingsApi
      .getCompanySettings()
      .then((settings) => {
        if (settings.legal_name_ar) setCompanyName(settings.legal_name_ar);
        setLogoUrl(settings.logo_url);
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <header className="rounded-t-2xl bg-gradient-to-br from-[var(--brand-navy)] to-[var(--brand-navy-light)] px-6 pb-6 pt-8 text-center text-white">
      <div className="mx-auto flex flex-col items-center">
        {isLoading ? (
          <div className="mb-4 h-24 w-24 animate-pulse rounded-xl bg-white/10" />
        ) : (
          <CompanyLogo
            companyName={companyName}
            logoUrl={logoUrl}
            size="lg"
            priority
            className="mb-4 border-white/20 bg-white shadow-md"
          />
        )}
        <h1 className="text-xl font-bold tracking-tight">{companyName}</h1>
        <p className="mt-1.5 text-sm text-white/75">{APP_BRANDING.productTaglineAr}</p>
        <p className="mt-3 text-xs font-medium uppercase tracking-widest text-[var(--brand-gold-light)]">
          تسجيل الدخول
        </p>
      </div>
    </header>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#e8eef5] via-[var(--background)] to-[#d4e2f0] p-4">
      <section className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white shadow-xl shadow-[var(--brand-navy)]/10">
        <LoginHeader />

        <div className="px-6 py-6">
          <Suspense fallback={<p className="text-sm text-slate-600">جاري التحميل...</p>}>
            <LoginForm />
          </Suspense>

          <p className="mt-5 text-center text-xs text-slate-500">
            أول مستخدم يُسجَّل في النظام يصبح مديراً تلقائياً، ثم يُكمل معالج{" "}
            <span className="font-medium">/setup</span>.
          </p>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <DeveloperCredit variant="inline" />
          </div>
        </div>
      </section>
    </main>
  );
}
