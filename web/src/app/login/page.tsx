"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppBrandFooter } from "@/components/app-brand-footer";
import { AppBrandLogo } from "@/components/app-brand-logo";
import { APP_BRANDING } from "@/config/app-branding";
import { settingsApi } from "@/modules/settings/services/settings-api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await settingsApi.signIn(email, password);
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4">
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">البريد الإلكتروني</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="rounded-lg border border-slate-300 px-3 py-2.5 focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-gold)]/20"
          dir="ltr"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">كلمة المرور</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="rounded-lg border border-slate-300 px-3 py-2.5 focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-gold)]/20"
          dir="ltr"
        />
      </label>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-lg bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-navy-light)] disabled:opacity-60"
      >
        {isLoading ? "جاري الدخول..." : "تسجيل الدخول"}
      </button>
    </form>
  );
}

function LoginHeader() {
  const [companyName, setCompanyName] = useState<string>(APP_BRANDING.productNameAr);

  useEffect(() => {
    void settingsApi
      .getCompanySettings()
      .then((settings) => {
        if (settings.legal_name_ar) setCompanyName(settings.legal_name_ar);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <AppBrandLogo variant="full" priority className="mb-4 max-w-[240px]" />
      <h1 className="text-xl font-bold text-[var(--brand-navy)]">{companyName}</h1>
      <p className="mt-1 text-sm text-slate-600">{APP_BRANDING.productTaglineAr}</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[var(--background)] to-[#dce6f2] p-4">
      <section className="w-full max-w-md rounded-2xl border border-[var(--brand-border)] bg-white p-6 shadow-lg shadow-[var(--brand-navy)]/5">
        <LoginHeader />

        <Suspense fallback={<p className="text-sm text-slate-600">جاري التحميل...</p>}>
          <LoginForm />
        </Suspense>

        <p className="mt-5 text-center text-xs text-slate-500">
          أول مستخدم يُسجَّل في النظام يصبح مديراً تلقائياً.
        </p>
      </section>

      <div className="mt-8 w-full max-w-md">
        <AppBrandFooter className="text-center [&_a]:block" />
      </div>
    </main>
  );
}
