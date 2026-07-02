"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
          className="rounded-md border border-slate-300 px-3 py-2"
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
          className="rounded-md border border-slate-300 px-3 py-2"
          dir="ltr"
        />
      </label>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-blue-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {isLoading ? "جاري الدخول..." : "تسجيل الدخول"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9ff] p-4">
      <section className="w-full max-w-md rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Sub Accounts</h1>
          <p className="mt-1 text-sm text-slate-600">تسجيل الدخول إلى نظام المحاسبة</p>
        </div>

        <Suspense fallback={<p className="text-sm text-slate-600">جاري التحميل...</p>}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-slate-500">
          أول مستخدم يُسجَّل في Supabase Auth يصبح مدير النظام تلقائياً.
        </p>
      </section>
    </main>
  );
}
